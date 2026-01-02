namespace Polytric.OpenWs.Spec.Serialization {
    public class Endpoint {
        public string Scheme { get; set; } = "ws";
        public string Host { get; set; }
        public int Port { get; set; }
        public string Path { get; set; }
    }
}
