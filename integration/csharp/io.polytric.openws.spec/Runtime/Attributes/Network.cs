using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class NetworkAttribute : Attribute
    {
        public string Name { get; }
        public string Description { get; }
        public string Version { get; }
        public Type[] Roles { get; }

        public NetworkAttribute(string name = null, string description = null, string version = null, Type[] roles = null)
        {
            Name = name;
            Description = description;
            Version = version;
            Roles = roles ?? Array.Empty<Type>();
        }
    }
}
