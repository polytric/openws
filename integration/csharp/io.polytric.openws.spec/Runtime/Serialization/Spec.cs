using System.Collections.Generic;

namespace Polytric.OpenWs.Spec.Serialization
{
    public class Spec
    {
        public string Openws { get; set; }
        public string Name { get; set; }
        public string Version { get; set; }
        public string Description { get; set; }
        public Dictionary<string, Network> Networks { get; } = new Dictionary<string, Network>();
    }
}
