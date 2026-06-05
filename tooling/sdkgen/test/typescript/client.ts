import {
    Client as BaseClient,
    type ClientServerPeer,
    JoinedRoomPayload,
    ReceivedMessagePayload,
} from './openws-sdkgen-typescript-node/chat/core/src/sdk/client.ts'
import { SendMessagePayload } from './openws-sdkgen-typescript-node/chat/core/src/models/server/index.ts'

const userId = process.env.OPENWS_USER_ID ?? 'user-a'
const roomId = process.env.OPENWS_ROOM_ID ?? 'room-1'

async function waitFor(condition: () => boolean): Promise<void> {
    while (!condition()) {
        await new Promise(resolve => setTimeout(resolve, 100))
    }
}

class Client extends BaseClient {
    public joined: boolean = false
    public received: boolean = false

    async handleMessageError(error: unknown): Promise<void> {
        console.error('Error handling server message:', error)
        this.transport.close?.()
    }

    async handleSocketError(error: unknown): Promise<void> {
        console.error('Socket error:', error)
        this.transport.close?.()
    }

    async joinedRoom(payload: JoinedRoomPayload, _peer: ClientServerPeer): Promise<void> {
        await super.joinedRoom(payload, _peer)
        console.log(`joined ${payload.roomId} as ${payload.joinerId}`)
        this.joined = true
    }

    async receivedMessage(payload: ReceivedMessagePayload, _peer: ClientServerPeer): Promise<void> {
        await super.receivedMessage(payload, _peer)
        console.log(`${payload.senderId} says: ${payload.text}`)
        this.received = true
    }
}

const client = new Client()

client.onJoinedRoom(payload => {
    console.log(`onJoinedRoom callback saw ${payload.roomId}`)
})

await client.connect('server')

await client.serverPeer.createRoom({
    userId,
    roomId,
})
await waitFor(() => client.joined)

await client.serverPeer.sendMessage(
    new SendMessagePayload({
        userId,
        roomId,
        text: 'hello from the generated SDK',
    })
)
await waitFor(() => client.received)

await client.disconnect('server')
