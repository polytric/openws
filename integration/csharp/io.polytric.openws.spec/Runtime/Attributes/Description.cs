using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Optional description attribute (avoid System.ComponentModel dependency in Unity).
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class DescriptionAttribute : Attribute
    {
        public string Value { get; }
        public DescriptionAttribute(string value) => Value = value;
    }
}