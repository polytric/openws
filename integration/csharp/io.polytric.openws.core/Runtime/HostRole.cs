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

        public virtual void HandleOpen(RemoteRole remoteRole)
        {
            // Override in subclass
        }

        public virtual void HandleMessage(string messageName, JToken payload, RemoteRole remoteRole)
        {
            // Override in subclass to implement dispatch   
        }

        public virtual void HandleClose(string reason, RemoteRole remoteRole)
        {
            // Override in subclass
        }

        public virtual void HandleError(string error, RemoteRole remoteRole)
        {
            // Override in subclass
        }

        public virtual bool RespondsToMessage(string messageName)
        {
            return true;
        }
    }
}
