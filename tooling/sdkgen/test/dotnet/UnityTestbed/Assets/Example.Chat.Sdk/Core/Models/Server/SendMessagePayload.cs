using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Server
{
    public partial class SendMessagePayload
    {
        [JsonProperty("userId")]
        public string UserId;

        [JsonProperty("roomId")]
        public string RoomId;

        [JsonProperty("text")]
        public string Text;

    }
}