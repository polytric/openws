export interface JoinRoomPayloadInit {
    userId: string
    roomId: string
}

export class JoinRoomPayload implements JoinRoomPayloadInit {
    readonly userId: string
    readonly roomId: string

    constructor({ userId, roomId }: JoinRoomPayloadInit = {} as JoinRoomPayloadInit) {
        this.userId = userId
        this.roomId = roomId
    }
}
