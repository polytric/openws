import {
    Client as BaseClient,
    type ClientServerApi,
    JoinedRoomPayload,
    ReceivedMessagePayload,
} from './openws-sdkgen-typescript-node/src/sdk/client.ts'
import { SendMessagePayload } from './openws-sdkgen-typescript-node/src/core/models/server/index.ts'

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

    async messageError(error: unknown): Promise<void> {
        console.error('Error handling server message:', error)
        this.transport.close?.()
    }

    async socketError(error: unknown): Promise<void> {
        console.error('Socket error:', error)
        this.transport.close?.()
    }

    async joinedRoom(payload: JoinedRoomPayload, _api: ClientServerApi): Promise<void> {
        await super.joinedRoom(payload, _api)
        console.log(`joined ${payload.roomId} as ${payload.joinerId}`)
        this.joined = true
    }

    async receivedMessage(payload: ReceivedMessagePayload, _api: ClientServerApi): Promise<void> {
        await super.receivedMessage(payload, _api)
        console.log(`${payload.senderId} says: ${payload.text}`)
        this.received = true
    }
}

const client = new Client()

client.onJoinedRoom(payload => {
    console.log(`onJoinedRoom callback saw ${payload.roomId}`)
})

await client.connect('server')

await client.serverApi.createRoom({
    userId,
    roomId,
})
await waitFor(() => client.joined)

await client.serverApi.sendMessage(
    new SendMessagePayload({
        userId,
        roomId,
        text: 'hello from the generated SDK',
    })
)
await waitFor(() => client.received)

await client.disconnect('server')
