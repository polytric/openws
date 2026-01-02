using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Marks an outbound message call (typically on a remote role proxy method).
    /// Message name defaults to the method name (minus Async suffix) unless overridden.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class MessageAttribute : Attribute
    {
        public string Name { get; }
        public string Description { get; }
        public string[] From { get; }

        public MessageAttribute(string name = null, string description = null, string[] from = null)
        {
            Name = name;
            Description = description;
            From = from ?? Array.Empty<string>();
        }
    }
}
