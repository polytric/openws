using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Declares an endpoint associated with a peer role.
    /// Multiple endpoints per role are allowed.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class EndpointAttribute : Attribute
    {
        public string Scheme { get; }
        public string Host { get; }
        public int Port { get; }
        public string Path { get; }

        public EndpointAttribute(string scheme, string host, int port, string path)
        {
            Scheme = scheme;
            Host = host;
            Port = port;
            Path = path;
        }
    }
}
