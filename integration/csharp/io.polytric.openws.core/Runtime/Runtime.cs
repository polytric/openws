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
        private List<RemoteRole> _remoteRoles;

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
            _remoteRoles = new();
        }

        public T GetHostRole<T>() where T : HostRole, new()
        {
            return _hostRoles.FirstOrDefault(r => r.GetType() == typeof(T)) as T;
        }

        public async Task<RemoteRoleType> ConnectAsync<RemoteRoleType>(Endpoint endpoint) where RemoteRoleType : RemoteRole, new()
        {
            var session = _sessionFactory.CreateSession();
            var remoteRole = new RemoteRoleType();
            remoteRole.RawSendAsync = async (fromRole, messageName, payload) =>
            {
                var envelope = new Envelope { FromRole = fromRole, MessageName = messageName, Payload = payload };
                var serialized = _serializer.Serialize(envelope);
                await session.SendMessageAsync(serialized).ConfigureAwait(false);
            };
            remoteRole.RawSend = (fromRole, messageName, payload) =>
            {
                var envelope = new Envelope { FromRole = fromRole, MessageName = messageName, Payload = payload };
                var serialized = _serializer.Serialize(envelope);
                session.QueueMessage(serialized);
            };
            _remoteRoles.Add(remoteRole);

            session.OnOpen += () =>
            {
                foreach (var hostRole in _hostRoles)
                {
                    hostRole.HandleOpen(remoteRole);
                }
            };

            session.OnMessage += (message) =>
            {
                foreach (var hostRole in _hostRoles)
                {
                    var envelope = _serializer.Deserialize<Envelope>(message);
                    if (hostRole.RespondsToMessage(envelope.MessageName))
                    {
                        hostRole.HandleMessage(envelope.MessageName, envelope.Payload, remoteRole);
                    }
                }
            };

            session.OnClose += (reason) =>
            {
                foreach (var hostRole in _hostRoles)
                {
                    hostRole.HandleClose(reason, remoteRole);
                }
            };

            session.OnError += (error) =>
            {
                foreach (var hostRole in _hostRoles)
                {
                    hostRole.HandleError(error, remoteRole);
                }
            };

            await session.ConnectAsync(endpoint).ConfigureAwait(false);
            return remoteRole;
        }
    }
}
