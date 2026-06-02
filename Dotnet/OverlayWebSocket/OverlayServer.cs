using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using CefSharp;
using NLog;

namespace VRCX;

public class OverlayServer
{
    public static OverlayServer Instance { get; private set; }

    private static readonly Logger logger = LogManager.GetCurrentClassLogger();

    private static readonly Lock SendLock = new();
    private static readonly ConcurrentDictionary<WebSocket, byte> ConnectedWebSockets = new();
    private static CancellationTokenSource _cancellationToken;

    private static OverlayVars _overlayVars;

    static OverlayServer()
    {
        Instance = new OverlayServer();
    }

    public static int Port { get; set; } = 34582;

    public async Task Init()
    {
        if (_cancellationToken != null && _cancellationToken.IsCancellationRequested)
            return;

        _cancellationToken = new CancellationTokenSource();
        var retryCount = 0;
        var maxRetries = 10;
        var currentPort = Port;

        while (retryCount < maxRetries)
        {
            try
            {
                var listener = new HttpListener();
                listener.Prefixes.Add($"http://127.0.0.1:{currentPort}/");
                listener.Start();
                Port = currentPort; // Update the static port once successful
                logger.Info($"Overlay IPC server started on port {Port}");

                if (retryCount > 0)
                {
                    MessageBox.Show(
                        $"Detected an existing VRCX instance. This instance will use port {Port} for overlay IPC.",
                        "VRCX Dual Instance",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                }
                
                _ = Task.Run(async () =>
                {
                    while (_cancellationToken != null && !_cancellationToken.IsCancellationRequested)
                    {
                        try
                        {
                            var listenerContext = await listener.GetContextAsync();
                            if (listenerContext.Request.IsWebSocketRequest)
                            {
                                ProcessRequest(listenerContext);
                            }
                            else
                            {
                                listenerContext.Response.StatusCode = 400;
                                listenerContext.Response.Close();
                            }
                        }
                        catch (HttpListenerException ex) when (ex.ErrorCode == 995) // Operation aborted
                        {
                            break;
                        }
                        catch (Exception e)
                        {
                            logger.Error(e);
                        }
                    }
                    listener.Stop();
                    listener.Close();
                });
                return;
            }
            catch (HttpListenerException e) when (e.ErrorCode == 183 || e.ErrorCode == 32 || e.ErrorCode == 10048) // Port already in use
            {
                logger.Warn($"Port {currentPort} is busy, trying next port...");
                currentPort++;
                retryCount++;
            }
            catch (Exception e)
            {
                logger.Error(e);
                break;
            }
        }
        
        if (retryCount >= maxRetries)
        {
            logger.Fatal($"Failed to find an available port for Overlay IPC after {maxRetries} attempts.");
        }
    }

    public async Task Exit()
    {
        if (_cancellationToken == null || _cancellationToken.IsCancellationRequested)
            return;

        foreach (var webSocket in ConnectedWebSockets.Keys)
        {
            if (webSocket == null || webSocket.State != WebSocketState.Open)
                continue;

            try
            {
                await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server shutting down", CancellationToken.None);
            }
            catch (Exception e)
            {
                logger.Error(e);
            }
        }
        await _cancellationToken.CancelAsync();
        ConnectedWebSockets.Clear();
        _cancellationToken = null;
    }

    private async Task ProcessRequest(HttpListenerContext listenerContext)
    {
        WebSocketContext webSocketContext;
        try
        {
            webSocketContext = await listenerContext.AcceptWebSocketAsync(null);
        }
        catch (Exception e)
        {
            listenerContext.Response.StatusCode = 500;
            listenerContext.Response.Close();
            logger.Error(e);
            return;
        }

        var webSocket = webSocketContext.WebSocket;
        try
        {
            ConnectedWebSockets.TryAdd(webSocket, 0);
            logger.Info("Overlay IPC connected, count: {0}", ConnectedWebSockets.Count);
            var receiveBuffer = new byte[1024 * 5];
            while (webSocket.State == WebSocketState.Open)
            {
                var receiveResult = await webSocket.ReceiveAsync(new ArraySegment<byte>(receiveBuffer), CancellationToken.None);
                switch (receiveResult.MessageType)
                {
                    case WebSocketMessageType.Text:
                        var text = Encoding.UTF8.GetString(receiveBuffer, 0, receiveResult.Count);
                        var message = JsonSerializer.Deserialize<OverlayMessage>(text);
                        HandleMessage(message);
                        continue;

                    case WebSocketMessageType.Close:
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
                        break;

                    case WebSocketMessageType.Binary:
                    default:
                        await webSocket.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Invalid message type", CancellationToken.None);
                        break;
                }
            }
        }
        catch (Exception e)
        {
            logger.Error(e);
        }
        finally
        {
            webSocket.Dispose();
            ConnectedWebSockets.TryRemove(webSocket, out _);
            logger.Info("Overlay IPC disconnected, count: {0}", ConnectedWebSockets.Count);
        }
    }

    private async Task HandleMessage(OverlayMessage message)
    {
        logger.Trace($"Overlay IPC message received: {message.Type.ToString()}");
        switch (message.Type)
        {
            case OverlayMessageType.OverlayConnected:
                var helloMessage = new OverlayMessage
                {
                    Type = OverlayMessageType.UpdateVars,
                    OverlayVars = _overlayVars
                };
                SendMessage(helloMessage);
                if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading &&
                    MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
                    MainForm.Instance.Browser.ExecuteScriptAsync("window?.$pinia?.vr.vrInit();");
                break;

            case OverlayMessageType.IsHmdAfk:
                var isHmdAfk = string.Equals(message.Data, "true", StringComparison.OrdinalIgnoreCase);
                if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading && MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
                    MainForm.Instance.Browser.ExecuteScriptAsync("window?.$pinia?.game.updateIsHmdAfk", isHmdAfk);
                break;

            case OverlayMessageType.JsFunctionCall:
            case OverlayMessageType.UpdateVars:
            default:
                throw new ArgumentOutOfRangeException();
        }
    }

    public void SendMessage(OverlayMessage message)
    {
        lock (SendLock)
        {
            var buffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message)));
            var connectedWebSockets = ConnectedWebSockets.Keys;
            logger.Trace($"Sending message to overlay Clients: {connectedWebSockets.Count}, IPC: {message.Type.ToString()}");
            foreach (var webSocket in connectedWebSockets)
            {
                if (webSocket == null || webSocket.State != WebSocketState.Open)
                    continue;

                webSocket.SendAsync(buffer, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }

    public void UpdateVars(OverlayVars overlayVars)
    {
        _overlayVars = overlayVars;
        if (!IsConnected() && (overlayVars.Active || Program.LaunchDebug))
        {
            OverlayManager.StartOverlay();
            return;
        }

        var helloMessage = new OverlayMessage
        {
            Type = OverlayMessageType.UpdateVars,
            OverlayVars = overlayVars
        };
        SendMessage(helloMessage);
    }

    public static bool IsConnected()
    {
        return ConnectedWebSockets.Keys.Any(webSocket => webSocket != null && webSocket.State == WebSocketState.Open);
    }
}
