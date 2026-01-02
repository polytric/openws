using System;
using System.Threading.Tasks;
using Polytric.OpenWs.Spec.Serialization;

namespace Polytric.OpenWs.Core
{
    public interface ISession
    {
        Task ConnectAsync(Endpoint endpoint);
        Task CloseAsync();
        Task SendMessageAsync(string message);

        event Func<Task> OnOpen;
        event Func<string, Task> OnError;
        event Func<string, Task> OnClose;
        event Func<string, Task> OnMessage;
    }
}