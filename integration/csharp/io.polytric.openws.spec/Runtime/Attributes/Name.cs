using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Overrides the derived name for a class or method.
    /// Useful when you do not want method-name conventions.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class NameAttribute : Attribute
    {
        public string Value { get; }
        public NameAttribute(string value) => Value = value;
    }
}