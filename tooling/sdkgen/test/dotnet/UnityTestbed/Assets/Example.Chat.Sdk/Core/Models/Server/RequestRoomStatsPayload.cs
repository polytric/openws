using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Server
{
    public partial class RequestRoomStatsPayload
    {
        [JsonProperty("roomId")]
        public string RoomId;

    }
}