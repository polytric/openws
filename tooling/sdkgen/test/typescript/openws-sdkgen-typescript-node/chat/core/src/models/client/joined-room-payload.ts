export interface JoinedRoomPayloadInit {
    joinerId: string
    roomId: string
}

export class JoinedRoomPayload implements JoinedRoomPayloadInit {
    readonly joinerId: string
    readonly roomId: string

    constructor({ joinerId, roomId }: JoinedRoomPayloadInit = {} as JoinedRoomPayloadInit) {
        this.joinerId = joinerId
        this.roomId = roomId
    }
}
