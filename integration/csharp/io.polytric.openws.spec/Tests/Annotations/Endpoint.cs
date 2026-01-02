using NUnit.Framework;
using Polytric.OpenWs.Spec.Annotations;

namespace Polytric.OpenWs.Spec.Tests.Annotations
{
    [TestFixture]
    public class EndpointAttributeTests
    {
        [Test]
        public void Constructor_RequiresAllFields()
        {
            var attr = new EndpointAttribute("wss", "example.com", 443, "/api");

            Assert.AreEqual("wss", attr.Scheme);
            Assert.AreEqual("example.com", attr.Host);
            Assert.AreEqual(443, attr.Port);
            Assert.AreEqual("/api", attr.Path);
        }
    }
}
