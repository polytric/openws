using System.Collections.Generic;

namespace Polytric.OpenWs.Spec.Serialization
{
    public class Message
    {
        public string Description { get; set; }
        public object Payload { get; set; } // JSON schema object
        public List<string> From { get; set; } = new List<string>();
    }
}
