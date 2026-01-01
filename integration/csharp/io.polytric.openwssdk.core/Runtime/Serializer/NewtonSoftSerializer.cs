using Newtonsoft.Json;
using Polytric.OpenWsSdk.Core;

namespace Polytric.OpenWsSdk.Core.Serializer {
    public class NewtonSoftSerializer : ISerializer {
        public string Serialize<T>(T data) {
            return JsonConvert.SerializeObject(data);
        }
        public T Deserialize<T>(string data) {
            return JsonConvert.DeserializeObject<T>(data);
        }
    }
}