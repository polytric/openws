using UnityEngine;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Polytric.OpenWs.Core;
using Polytric.OpenWs.Spec.Serialization;
using Polytric.OpenWs.Spec.Serialization.Serializer;

namespace Polytric.OpenWs.Core
{
    public class Runtime
    {
        private Network _network;
        private ISerializer _serializer;
        private ISessionFactory _sessionFactory;
        private List<HostRole> _hostRoles;

        public Runtime(Network network, ISerializer serializer, ISessionFactory sessionFactory)
        {
            _network = network;
            _serializer = serializer;
            _sessionFactory = sessionFactory;
            _hostRoles = network.Roles.Select(T =>
            {
                if (T.IsSubclassOf(typeof(HostRole)))
                {
                    return Activator.CreateInstance(T) as HostRole;
                }
                return null;
            }).Where(r => r != null).ToList();
        }

        public T GetHostRole<T>() where T : HostRole, new()
        {
            return _hostRoles.FirstOrDefault(r => r.GetType() == typeof(T)) as T;
        }

        public async Task<RemoteRoleType> ConnectAsync<RemoteRoleType>(Endpoint endpoint) where RemoteRoleType : RemoteRole, new()
        {
            Debug.Log("Connecting to endpoint: " + endpoint.ToString());
            var session = _sessionFactory.CreateSession(endpoint);
            var remoteRole = new RemoteRoleType();
            remoteRole.RawSendAsync = async (fromRole, messageName, payload) =>
            {
                var envelope = new Envelope { FromRole = fromRole, MessageName = messageName, Payload = payload };
                var serialized = _serializer.Serialize(envelope);
                await session.SendMessageAsync(serialized).ConfigureAwait(false);
            };

            session.OnOpen += async () =>
            {
                Debug.Log("Session opened, host roles: " + _hostRoles.Count);
                foreach (var hostRole in _hostRoles)
                {
                    Debug.Log("Host role: " + hostRole.Name);
                    Debug.Log("Remote role: " + remoteRole.Name);
                    await hostRole.HandleOpenAsync(remoteRole).ConfigureAwait(false);
                }
            };

            session.OnMessage += async (message) =>
            {
                Debug.Log("Session message: " + message);
                foreach (var hostRole in _hostRoles)
                {
                    var envelope = _serializer.Deserialize<Envelope>(message);
                    if (hostRole.RespondsToMessage(envelope.MessageName))
                    {
                        await hostRole.HandleMessageAsync(envelope.MessageName, envelope.Payload, remoteRole).ConfigureAwait(false);
                    }
                }
            };

            session.OnClose += async (reason) =>
            {
                Debug.Log("Session closed: " + reason);
                foreach (var hostRole in _hostRoles)
                {
                    await hostRole.HandleCloseAsync(reason, remoteRole).ConfigureAwait(false);
                }
            };

            session.OnError += async (error) =>
            {
                Debug.Log("Session error: " + error);
                foreach (var hostRole in _hostRoles)
                {
                    await hostRole.HandleErrorAsync(error, remoteRole).ConfigureAwait(false);
                }
            };

            await session.ConnectAsync(endpoint).ConfigureAwait(false);
            return remoteRole;
        }
    }
}
