using System.Collections.Generic;

namespace Polytric.OpenWs.Spec.Serialization {
    public class Network {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Version { get; set; }
        public Dictionary<string, Role> Roles { get; } = new Dictionary<string, Role>();
    }
}
