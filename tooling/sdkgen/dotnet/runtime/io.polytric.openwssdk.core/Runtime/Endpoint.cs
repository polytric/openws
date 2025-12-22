namespace Polytric.OpenWsSdk.Core {
    // An endpoint defined where to connect to a participant on the network.
    public readonly struct Endpoint {
        public string Host { get; }
        public int Port { get; }
        public string Path { get; }

        public Endpoint(string host, int port, string path) {
            Host = host;
            Port = port;
            Path = path;
        }

        public string Url => $"ws://{Host}:{Port}{Path}";
    }
}