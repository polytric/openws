using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Client
{
    public class ReceivedMessage
    {
        [JsonProperty("senderId")]
        public string SenderId;

        [JsonProperty("roomId")]
        public string RoomId;

        [JsonProperty("text")]
        public string Text;

    }
}