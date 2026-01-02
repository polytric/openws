using System;

namespace Polytric.OpenWs.Spec.Attributes
{
    /// <summary>
    /// Marks an inbound handler (typically on the local/host role implementation).
    /// Message name defaults to the method name (minus Async suffix) unless overridden.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class HandlerAttribute : Attribute
    {
        public string Name { get; }
        public string Description { get; }
        public string[] From { get; }

        public HandlerAttribute(string name = null, string description = null, string[] from = null)
        {
            Name = name;
            Description = description;
            From = from ?? Array.Empty<string>();
        }
    }
}
