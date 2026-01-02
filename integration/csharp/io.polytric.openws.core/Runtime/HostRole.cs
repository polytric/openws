using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Core
{
    public class HostRole
    {
        public virtual string Name { get; set; }
        public virtual string Description { get; set; }
        public virtual IReadOnlyList<Endpoint> Endpoints { get; set; } = new List<Endpoint>();

        public virtual Task HandleOpenAsync(RemoteRole remoteRole)
        {
            // Override in subclass
            return Task.CompletedTask;
        }

        public virtual Task HandleMessageAsync(string messageName, JToken payload, RemoteRole remoteRole)
        {
            // Override in subclass to implement dispatch   
            return Task.CompletedTask;
        }

        public virtual Task HandleCloseAsync(string reason, RemoteRole remoteRole)
        {
            // Override in subclass
            return Task.CompletedTask;
        }

        public virtual Task HandleErrorAsync(string error, RemoteRole remoteRole)
        {
            // Override in subclass
            return Task.CompletedTask;
        }

        public virtual bool RespondsToMessage(string messageName)
        {
            return true;
        }
    }
}
