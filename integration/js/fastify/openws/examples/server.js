const fastify = require('fastify')
const S = require('@pocketgems/schema')
const { WS } = require('@polytric/openws-spec')

const openws = require('../src')

const app = fastify({ logger: true })

const serverRole = WS.role('server')
  .message(WS.message('createRoom')
    .payload(S.obj({
      userId: S.str,
      name: S.str,
    }))
    .desc('A room creation request')
  )
  .message(WS.message('joinRoom')
    .payload(S.obj({
      userId: S.str,
      roomId: S.str.desc('room id'),
    }))
    .desc('A login request')
  )
  .message(WS.message('sendMessage')
    .payload(S.obj({
      userId: S.str,
      roomId: S.str.desc('room id'),
      text: S.str,
    }))
    .desc('A message sent by a user')
  )
  .message(WS.message('requestStats')
    .payload(S.obj({
      roomId: S.str.desc('room id'),
    }))
    .desc('A channel statistics request')
  )

const clientRole = WS.role('client')
  .message(WS.message('roomJoined')
    .payload(S.obj({
      roomId: S.str.desc('room id'),
    }))
    .desc('A message sent by a user')
  )
  .message(WS.message('messageReceived')
    .payload(S.obj({
      roomId: S.str.desc('room id'),
      text: S.str,
      senderId: S.str,
      sentAt: S.int,
    }))
    .desc('A message received by a user')
  )

const portalRole = WS.role('portal')
  .message(WS.message('channelStats')
    .payload(S.obj({
      roomId: S.str.desc('room id'),
      members: S.int,
      messagesLastMinute: S.int,
    }))
    .desc('A channel statistics request')
  )

const network = WS.network('chat')
  .role(serverRole)
  .role(clientRole)
  .role(portalRole)
  .desc('A chat network')

async function main() {
    await app.register(openws)

    const userConnections = {}
    const rooms = {}
    
    function getState(connCtx) {
        const state = {
            onOpen: () => {
                console.log('server opened')
            },
            onClose: () => {
                console.log('server closed')
            },
            onError: (error) => {
                console.error(error)
            },
            onClientCreateRoom: async ({ userId, name }) => {
                userConnections[userId] = connCtx

                if (rooms[name]) {
                    // send error to client
                    return
                }
                const room = {
                    id: "fake-rand-id",
                    name,
                    members: [userId],
                    messages: [],
                }
                rooms[room.id] = room

                await connCtx.sendClientRoomJoined({ roomId: room.id })
            },
            onClientJoinRoom: async ({ userId, roomId }) => {
                userConnections[userId] = connCtx

                const room = rooms[roomId]
                if (!room) {
                    return
                }
                if (room.members.includes(userId)) {
                    return
                }
                room.members.push(userId)
                await connCtx.sendClientRoomJoined({ roomId: room.id })
            },
            onClientSendMessage: async ({ userId, roomId, text }) => {
                const room = rooms[roomId]
                if (!room) {
                    return
                }
                room.messages.push({ userId, text, sentAt: Date.now() })

                console.log(`Sending message to ${roomId}`)
                for (const member of room.members) {
                    const memberCtx = userConnections[member]
                    if (!memberCtx || member === userId) {
                        console.log(`Skipping message to ${member}`)
                        continue
                    }
                    await memberCtx.sendClientMessageReceived({ roomId, text, senderId: userId, sentAt: Date.now() })
                }
            },
            onPortalRequestStats: async ({ roomId }) => {
                const room = rooms[roomId]
                if (!room) {
                    return
                }

                setInterval(async () => {
                    await connCtx.sendPortalChannelStats({ roomId, members: room.members.length, messagesLastMinute: room.messages.length})
                }, 1000)
            }
        }
        return state
    }

    // Register a WS network
    app.openws({
        path: '/chat',
        hostRole: network.roles.server.name,
        network: network,
    },
    getState)

    await app.listen({ port: 8082, host: '0.0.0.0' })
}

main().catch(console.error)
