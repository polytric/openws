using Newtonsoft.Json;

namespace Example.Chat.Core.Models.Client
{
    public partial class JoinedRoomPayload
    {
        [JsonProperty("joinerId")]
        public string JoinerId;

        [JsonProperty("roomId")]
        public string RoomId;

    }
}