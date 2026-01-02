using System;
using NUnit.Framework;
using Polytric.OpenWs.Spec;
using Polytric.OpenWs.Spec.Annotations;

namespace Polytric.OpenWs.Spec.Tests
{
    [TestFixture]
    public class GeneratorTests
    {
        [Test]
        public void GenerateSpec_WithValidNetwork_ReturnsSpecWithNetwork()
        {
            var opts = new GeneratorOptions
            {
                Name = "TestSpec",
                NamespacePrefix = "Polytric.OpenWs.Spec.Tests.Generator"
            };

            var spec = Spec.Generator.GenerateSpec(typeof(GeneratorTests).Assembly, opts);

            Assert.IsNotNull(spec);
            Assert.AreEqual("TestSpec", spec.Name);
            Assert.IsTrue(spec.Networks.ContainsKey("testChat"));
        }

        [Test]
        public void GenerateSpec_WithRolesAttribute_DiscoversBothRoles()
        {
            var opts = new GeneratorOptions
            {
                Name = "TestSpec",
                NamespacePrefix = "Polytric.OpenWs.Spec.Tests.Generator"
            };

            var spec = Spec.Generator.GenerateSpec(typeof(GeneratorTests).Assembly, opts);

            var network = spec.Networks["testChat"];
            Assert.AreEqual(2, network.Roles.Count);
            Assert.IsTrue(network.Roles.ContainsKey("client"));
            Assert.IsTrue(network.Roles.ContainsKey("server"));
        }
    }

    // Test fixtures

    [Network("TestChat")]
    [Roles(typeof(TestClientRole), typeof(TestServerRole))]
    public class TestChatNetwork { }

    [Role("client")]
    [Endpoint("ws", "localhost", 8080, "/ws")]
    public class TestClientRole
    {
        [Handler("joinRoom")]
        public void OnJoinRoom(JoinRoomPayload payload) { }
    }

    [Role("server")]
    [Endpoint("ws", "localhost", 8081, "/ws")]
    public class TestServerRole
    {
        [Message("sendMessage")]
        public void SendMessage(SendMessagePayload payload) { }
    }

    // Payload types
    public class JoinRoomPayload
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
    }

    public class SendMessagePayload
    {
        public string RoomId { get; set; }
        public string Text { get; set; }
    }
}

