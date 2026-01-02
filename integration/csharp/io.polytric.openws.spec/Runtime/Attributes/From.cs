using System;
using System.Linq;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Declares an allow-list for who may send a message / invoke a handler ("from" constraint).
    /// Prefer role types so the binder can resolve role names from RoleAttribute.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class FromAttribute : Attribute
    {
        public string[] Roles { get; }

        public FromAttribute(params Type[] roleTypes)
        {
            Roles = roleTypes.Select(t => t.Name).ToArray();
        }

        public FromAttribute(params string[] roleNames)
        {
            Roles = roleNames ?? Array.Empty<string>();
        }
    }
}