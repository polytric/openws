using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Server
{
    public class RequestRoomStats
    {
        [JsonProperty("roomId")]
        public string RoomId;

    }
}