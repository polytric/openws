using UnityEngine;
using System.Collections.Generic;
using Polytric.OpenWs.Core;
using NativeWebSocket;

namespace Polytric.OpenWs.Unity
{
    public class OpenWsRunner : MonoBehaviour
    {
        public List<ISession> sessions = new List<ISession>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Init()
        {
            var gameObject = new GameObject("OpenWsRunner");
            gameObject.AddComponent<OpenWsRunner>();
            DontDestroyOnLoad(gameObject);
        }

        void Update()
        {
            foreach (var session in sessions)
            {
                if (session is NativeWebSocketSession nativeWebSocketSession)
                {
                    nativeWebSocketSession.Update();
                }
            }
        }

        void OnDestroy()
        {
            foreach (var session in sessions)
            {
                session.CloseAsync();
            }
        }

        public static void AddSession(ISession session)
        {
            FindAnyObjectByType<OpenWsRunner>().sessions.Add(session);
        }

        public static void RemoveSession(ISession session)
        {
            FindAnyObjectByType<OpenWsRunner>().sessions.Remove(session);
        }
    }
}
