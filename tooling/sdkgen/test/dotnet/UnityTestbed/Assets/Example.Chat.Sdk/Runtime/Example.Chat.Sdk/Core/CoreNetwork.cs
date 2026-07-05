using Polytric.OpenWs.Core;
using System;
using Example.Chat.Core.Roles;

namespace Example.Chat.Core
{
    public partial class CoreNetwork : Network
    {
        public override string Name { get; set; } = "core";
        public override string Description { get; set; } = "A chat network";
        public override string Version { get; set; } = "1.0.0";
        public override Type[] Roles { get; set; } = new Type[] { typeof(Client), typeof(Server) };
    }
}
