using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Client
{
    public class JoinedRoom
    {
        [JsonProperty("joinerId")]
        public string JoinerId;

        [JsonProperty("roomId")]
        public string RoomId;

    }
}