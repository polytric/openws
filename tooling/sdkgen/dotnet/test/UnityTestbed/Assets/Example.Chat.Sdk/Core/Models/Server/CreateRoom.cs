using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Server
{
    public class CreateRoom
    {
        [JsonProperty("userId")]
        public string UserId;

        [JsonProperty("roomId")]
        public string RoomId;

    }
}