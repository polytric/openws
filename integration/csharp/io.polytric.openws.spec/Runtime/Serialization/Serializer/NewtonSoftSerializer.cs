using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Polytric.OpenWs.Spec.Serialization.Serializer
{
    public class NewtonSoftSerializer : ISerializer
    {
        private static readonly JsonSerializerSettings Settings = new JsonSerializerSettings
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver()
        };

        public string Serialize<T>(T data)
        {
            return JsonConvert.SerializeObject(data, Settings);
        }
        public T Deserialize<T>(string data)
        {
            return JsonConvert.DeserializeObject<T>(data, Settings);
        }
    }
}
