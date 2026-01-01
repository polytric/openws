using UnityEngine;
using System.Collections.Generic;
using Polytric.OpenWsSdk.Core;

namespace Polytric.OpenWsSdk.Unity {
    public class OpenWsRunner : MonoBehaviour {
        public List<IWebSocketTransport> transports = new List<IWebSocketTransport>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Init() {
            var gameObject = new GameObject("OpenWsRunner");
            gameObject.AddComponent<OpenWsRunner>();
            DontDestroyOnLoad(gameObject);
        }

        void Update() {
            foreach (var transport in transports) {
                transport.Update();
            }
        }

        void OnDestroy() {
            foreach (var transport in transports) {
                transport.CloseAsync();
            }
        }

        public static void AddTransport(IWebSocketTransport transport) {
            Debug.Log("Adding transport " + transport.ToString());
            FindObjectOfType<OpenWsRunner>().transports.Add(transport);
        }

        public static void RemoveTransport(IWebSocketTransport transport) {
            Debug.Log("Removing transport " + transport.ToString());
            FindObjectOfType<OpenWsRunner>().transports.Remove(transport);
        }
    }
}