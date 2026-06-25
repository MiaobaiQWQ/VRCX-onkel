import { dbVars } from './index.js';
import sqliteService from '../sqlite.js';

const trackedNonFriends = {
    async addTrackedNonFriend(userId, displayName, location) {
        if (!dbVars.userPrefix || !userId) return;
        // Ensure location is a string and not "[object Object]"
        let loc = location;
        if (typeof loc !== 'string' || loc === '[object Object]') {
            loc = '';
        }
        // Use INSERT OR REPLACE to update name/location if they change or were missing
        // But we want to preserve added_at if it exists
        const existing = await this.isTrackedNonFriend(userId);
        if (existing) {
            await sqliteService.executeNonQuery(
                `UPDATE ${dbVars.userPrefix}_tracked_nonfriends SET 
                    display_name = CASE WHEN display_name = '' OR display_name IS NULL OR @displayName != '' THEN @displayName ELSE display_name END,
                    location = CASE WHEN location = '' OR location IS NULL OR @location != '' THEN @location ELSE location END
                 WHERE user_id = @userId`,
                {
                    '@userId': userId,
                    '@displayName': displayName || '',
                    '@location': loc
                }
            );
        } else {
            await sqliteService.executeNonQuery(
                `INSERT INTO ${dbVars.userPrefix}_tracked_nonfriends (user_id, display_name, added_at, location) VALUES (@userId, @displayName, @addedAt, @location)`,
                {
                    '@userId': userId,
                    '@displayName': displayName || '',
                    '@addedAt': new Date().toISOString(),
                    '@location': loc
                }
            );
        }
    },

    async removeTrackedNonFriend(userId) {
        if (!dbVars.userPrefix || !userId) return;
        await sqliteService.executeNonQuery(
            `DELETE FROM ${dbVars.userPrefix}_tracked_nonfriends WHERE user_id = @userId`,
            { '@userId': userId }
        );
    },

    async getTrackedNonFriends() {
        const results = [];
        if (!dbVars.userPrefix) return results;
        
        const tableName = `${dbVars.userPrefix}_tracked_nonfriends`;

        // Cleanup for "[object Object]"
        try {
            await sqliteService.executeNonQuery(
                `UPDATE ${tableName} SET location = '' WHERE location IS NULL OR location = '' OR location = '[object Object]' OR location LIKE '%[object Object]%'`
            );
        } catch (e) {
            // Table might not exist yet
        }
        
        try {
            await sqliteService.execute(
                (row) => {
                    let loc = row[3];
                    if (loc === '[object Object]') {
                        loc = '';
                    }
                    results.push({
                        userId: row[0],
                        displayName: row[1],
                        addedAt: row[2],
                        location: loc
                    });
                },
                `SELECT user_id, display_name, added_at, location FROM ${tableName} ORDER BY added_at DESC`
            );
        } catch (e) {
            // Table might not exist yet
        }
        return results;
    },

    async isTrackedNonFriend(userId) {
        if (!dbVars.userPrefix || !userId) return false;
        
        const tableName = `${dbVars.userPrefix}_tracked_nonfriends`;
        
        let found = false;
        try {
            await sqliteService.execute(
                () => {
                    found = true;
                },
                `SELECT 1 FROM ${tableName} WHERE user_id = @userId LIMIT 1`,
                { '@userId': userId }
            );
        } catch (e) {
            console.error('Failed to check tracked nonfriend', e);
        }
        return found;
    },

    async updateTrackedNonFriendDisplayName(userId, displayName) {
        if (!dbVars.userPrefix || !userId) return;
        await sqliteService.executeNonQuery(
            `UPDATE ${dbVars.userPrefix}_tracked_nonfriends SET display_name = @displayName WHERE user_id = @userId`,
            {
                '@userId': userId,
                '@displayName': displayName || ''
            }
        );
    },

    async getTrackedNonFriendChangeCounts(userId) {
        if (!dbVars.userPrefix || !userId) return { nameChanges: 0, bioChanges: 0 };
        
        let nameChanges = 0;
        let bioChanges = 0;
        
        try {
            await sqliteService.execute(
                (row) => { nameChanges = row[0]; },
                `SELECT COUNT(*) FROM ${dbVars.userPrefix}_friend_log_history WHERE user_id = @userId AND type = 'DisplayName'`,
                { '@userId': userId }
            );
            
            await sqliteService.execute(
                (row) => { bioChanges = row[0]; },
                `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_bio WHERE user_id = @userId`,
                { '@userId': userId }
            );
        } catch (e) {
            console.error('Failed to get change counts', e);
        }
        
        return { nameChanges, bioChanges };
    },

    async getAllTrackedNonFriendChangeCounts() {
        const results = new Map();
        if (!dbVars.userPrefix) return results;

        try {
            await sqliteService.execute(
                (row) => {
                    const userId = row[0];
                    const count = row[1];
                    if (!results.has(userId)) results.set(userId, { nameChanges: 0, bioChanges: 0 });
                    results.get(userId).nameChanges = count;
                },
                `SELECT user_id, COUNT(*) FROM ${dbVars.userPrefix}_friend_log_history WHERE type = 'DisplayName' GROUP BY user_id`
            );

            await sqliteService.execute(
                (row) => {
                    const userId = row[0];
                    const count = row[1];
                    if (!results.has(userId)) results.set(userId, { nameChanges: 0, bioChanges: 0 });
                    results.get(userId).bioChanges = count;
                },
                `SELECT user_id, COUNT(*) FROM ${dbVars.userPrefix}_feed_bio GROUP BY user_id`
            );
        } catch (e) {
            console.error('Failed to get all change counts', e);
        }

        return results;
    }
};

export { trackedNonFriends };
