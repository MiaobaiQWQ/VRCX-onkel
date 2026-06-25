using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using NLog;

namespace VRCX
{
    public partial class AppApi
    {
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();

        public void Init()
        {
        }

        public JsonSerializerSettings JsonSerializerSettings = new JsonSerializerSettings
        {
            Error = delegate (object _, Newtonsoft.Json.Serialization.ErrorEventArgs args)
            {
                args.ErrorContext.Handled = true;
            }
        };

        public int GetColourFromUserID(string userId)
        {
            using var hasher = MD5.Create();
            var hash = hasher.ComputeHash(Encoding.UTF8.GetBytes(userId));
            return (hash[3] << 8) | hash[4];
        }

        public void OpenLink(string url)
        {
            if (url.StartsWith("http://") ||
                url.StartsWith("https://"))
            {
                Process.Start(new ProcessStartInfo(url)
                {
                    UseShellExecute = true
                });
            }
        }

        public void OpenDiscordProfile(string discordId)
        {
            if (!long.TryParse(discordId, out _))
                throw new Exception("Invalid user ID");

            var uri = $"discord://-/users/{discordId}";
            Process.Start(new ProcessStartInfo(uri)
            {
                UseShellExecute = true
            });
        }

        public string GetLaunchCommand()
        {
            var command = StartupArgs.LaunchArguments.LaunchCommand;
            StartupArgs.LaunchArguments.LaunchCommand = string.Empty;
            return command;
        }

        public string GetAppDataDirectory(int instanceIndex = 0)
        {
            if (instanceIndex >= 2)
            {
                return Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), $"VRCX_instance{instanceIndex}");
            }
            return Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VRCX");
        }

        public string GetAppDataDirectory(bool isInstance2)
        {
            return GetAppDataDirectory(isInstance2 ? 2 : 0);
        }

        public int GetInstanceIndex()
        {
            return StartupArgs.LaunchArguments.InstanceIndex;
        }

        public bool GetIsInstance2()
        {
            return StartupArgs.LaunchArguments.IsInstance2;
        }

        public void LaunchInstance2(string customDataDir = "", string customProfile = "", int customPort = 0, int memoryLimit = 0)
        {
            LaunchInstanceN(0, customDataDir, customProfile, customPort, memoryLimit);
        }

        public void LaunchInstanceN(int instanceIndex, string customDataDir = "", string customProfile = "", int customPort = 0, int memoryLimit = 0)
        {
            if (StartupArgs.LaunchArguments.InstanceIndex > 0)
            {
                return;
            }

            var exePath = Process.GetCurrentProcess().MainModule.FileName;
            var args = new StringBuilder();
            args.Append($"--instance-index={instanceIndex}");
            args.Append(" --read-only-sync");

            if (!string.IsNullOrEmpty(customDataDir))
            {
                args.Append($" --user-data-dir=\"{customDataDir}\"");
            }

            if (!string.IsNullOrEmpty(customProfile))
            {
                args.Append($" --profile-directory=\"{customProfile}\"");
            }
            else if (instanceIndex > 1)
            {
                args.Append($" --profile-directory=\"instance{instanceIndex}\"");
            }

            if (customPort > 0)
            {
                args.Append($" --port={customPort}");
            }

            if (memoryLimit > 0)
            {
                args.Append($" --js-flags=\"--max-old-space-size={memoryLimit}\"");
            }

            var startInfo = new ProcessStartInfo(exePath)
            {
                Arguments = args.ToString(),
                UseShellExecute = true
            };
            Process.Start(startInfo);
        }

        public void IPCAnnounceStart()
        {
            IPCServer.Send(new IPCPacket
            {
                Type = "VRCXLaunch",
                MsgType = "VRCXLaunch"
            });
        }

        public void SendIpc(string type, string data)
        {
            IPCServer.Send(new IPCPacket
            {
                Type = "VrcxMessage",
                MsgType = type,
                Data = data
            });
        }

        public string CustomCss()
        {
            var filePath = Path.Join(Program.AppDataDirectory, "custom.css");
            if (File.Exists(filePath))
                return File.ReadAllText(filePath);

            return string.Empty;
        }

        public string CustomScript()
        {
            var filePath = Path.Join(Program.AppDataDirectory, "custom.js");
            if (File.Exists(filePath))
                return File.ReadAllText(filePath);

            return string.Empty;
        }

        public string CurrentCulture()
        {
            var culture = CultureInfo.CurrentCulture.ToString();
            if (string.IsNullOrEmpty(culture))
                culture = "en-US";

            return culture;
        }

        public string CurrentLanguage()
        {
            return CultureInfo.InstalledUICulture.Name;
        }

        public string GetVersion()
        {
            return Program.Version;
        }

        public bool VrcClosedGracefully()
        {
            return LogWatcher.Instance.VrcClosedGracefully;
        }

        public Dictionary<string, int> GetColourBulk(List<object> userIds)
        {
            var output = new Dictionary<string, int>();
            foreach (string userId in userIds)
            {
                output.Add(userId, GetColourFromUserID(userId));
            }

            return output;
        }

        public void SetAppLauncherSettings(bool enabled, bool killOnExit, bool runProcessOnce)
        {
            AutoAppLaunchManager.Instance.Enabled = enabled;
            AutoAppLaunchManager.Instance.KillChildrenOnExit = killOnExit;
            AutoAppLaunchManager.Instance.RunProcessOnce = runProcessOnce;
        }

        public string GetFileBase64(string path)
        {
            if (File.Exists(path))
            {
                return Convert.ToBase64String(File.ReadAllBytes(path));
            }

            return null;
        }

        public Task<bool> TryOpenInstanceInVrc(string launchUrl)
        {
            return VRCIPC.Send(launchUrl);
        }
    }
}
