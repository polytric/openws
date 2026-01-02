using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Server
{
    public class SendMessage
    {
        [JsonProperty("userId")]
        public string UserId;

        [JsonProperty("roomId")]
        public string RoomId;

        [JsonProperty("text")]
        public string Text;

    }
}