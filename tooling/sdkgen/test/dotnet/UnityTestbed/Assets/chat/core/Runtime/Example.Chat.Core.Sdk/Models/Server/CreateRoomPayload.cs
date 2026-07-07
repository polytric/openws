using Newtonsoft.Json;
using System.Collections.Generic;

namespace Example.Chat.Core.Models.Server
{
    public partial class CreateRoomPayload
    {
        [JsonProperty("userId")]
        public string UserId;

        [JsonProperty("roomId")]
        public string RoomId;

    }
}