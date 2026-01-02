using System.Collections.Generic;

namespace Polytric.OpenWs.Spec.Serialization
{
    public class Role
    {
        public string Description { get; set; }
        public List<Endpoint> Endpoints { get; } = new List<Endpoint>();
        public Dictionary<string, Message> Messages { get; } = new Dictionary<string, Message>();
    }
}
