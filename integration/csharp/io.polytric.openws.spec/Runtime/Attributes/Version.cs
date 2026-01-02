using System;
using System.Linq;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Optional version attribute.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class VersionAttribute : Attribute
    {
        public string Value { get; }
        public VersionAttribute(string value) => Value = value;
    }
}