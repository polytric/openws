using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Polytric.OpenWs.Spec.Serialization;
namespace Polytric.OpenWs.Core
{
    public class RemoteRole
    {
        public virtual string Name { get; set; }
        public virtual string Description { get; set; }

        internal Func<string, string, JToken, Task> RawSendAsync { get; set; }
        internal Action<string, string, JToken> RawSend { get; set; }

        // Subclasses call this to send messages to the remote role.
        protected async Task InternalSendMessageAsync<T>(string fromRole, string messageName, T payload)
        {
            if (RawSendAsync == null) throw new InvalidOperationException("RawSendAsync is not set");
            await RawSendAsync(fromRole, messageName, JToken.FromObject(payload)).ConfigureAwait(false);
        }

        protected void InternalQueueMessage<T>(string fromRole, string messageName, T payload)
        {
            if (RawSend == null) throw new InvalidOperationException("RawSend is not set");
            RawSend(fromRole, messageName, JToken.FromObject(payload));
        }
    }
}