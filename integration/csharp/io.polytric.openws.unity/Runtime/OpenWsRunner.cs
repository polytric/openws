using UnityEngine;
using System.Collections.Generic;
using Polytric.OpenWs.Core;
using NativeWebSocket;

namespace Polytric.OpenWs.Unity
{
    public class OpenWsRunner : MonoBehaviour
    {
        public List<WebSocket> webSockets = new List<WebSocket>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Init()
        {
            var gameObject = new GameObject("OpenWsRunner");
            gameObject.AddComponent<OpenWsRunner>();
            DontDestroyOnLoad(gameObject);
        }

        void Update()
        {
            foreach (var webSocket in webSockets)
            {
                webSocket.DispatchMessageQueue();
            }
        }

        void OnDestroy()
        {
            foreach (var webSocket in webSockets)
            {
                webSocket.Close();
            }
        }

        public static void AddWebSocket(WebSocket ws)
        {
            Debug.Log("Adding webSocket " + ws.ToString());
            FindObjectOfType<OpenWsRunner>().webSockets.Add(ws);
        }

        public static void RemoveWebSocket(WebSocket ws)
        {
            Debug.Log("Removing webSocket " + ws.ToString());
            FindObjectOfType<OpenWsRunner>().webSockets.Remove(ws);
        }
    }
}