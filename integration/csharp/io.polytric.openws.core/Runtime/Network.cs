using System;
using System.Threading.Tasks;
using Polytric.OpenWs.Spec.Serialization;
using NetworkBase = Polytric.OpenWs.Spec.Serialization.Network;

namespace Polytric.OpenWs.Core
{
    public class Network
    {
        // annotation for spec generation not required for runtime
        // alternatively, use [Network("name", "description", "version")] attribute
        // or [Name("name"), Description("description"), Version("version")] attribute
        // to specify the network metadata
        public virtual string Name { get; set; }
        public virtual string Description { get; set; }
        public virtual string Version { get; set; }
        public virtual Type[] Roles { get; set; }
    }
}