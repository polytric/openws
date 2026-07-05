using Newtonsoft.Json;
using System.Collections.Generic;

namespace Example.Chat.Core.Models.Client
{
    public partial class ReceivedMessagePayload
    {
        [JsonProperty("senderId")]
        public string SenderId;

        [JsonProperty("roomId")]
        public string RoomId;

        [JsonProperty("text")]
        public string Text;

    }
}