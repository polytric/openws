using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Declares a role type. Use IsHost to indicate the role implemented by this process.
    /// In Unity clients, the local role is typically the host role.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class RoleAttribute : Attribute
    {
        public string Name { get; }
        public string Description { get; }

        public RoleAttribute(string name = null, string description = null)
        {
            Name = name;
            Description = description;
        }
    }
}
