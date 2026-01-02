using Newtonsoft.Json.Linq;

namespace Polytric.OpenWs.Core
{
    public class Envelope
    {
        public string FromRole { get; set; }
        public string MessageName { get; set; }
        public JToken Payload { get; set; }
    }
}