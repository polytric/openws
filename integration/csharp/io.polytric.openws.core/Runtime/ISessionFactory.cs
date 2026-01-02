using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Core
{
    public interface ISessionFactory
    {
        ISession CreateSession(Endpoint endpoint);
    }
}
