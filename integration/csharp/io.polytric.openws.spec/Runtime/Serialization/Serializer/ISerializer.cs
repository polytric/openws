namespace Polytric.OpenWs.Spec.Serialization.Serializer {
    public interface ISerializer {
        string Serialize<T>(T data);
        T Deserialize<T>(string data);
    }
}
