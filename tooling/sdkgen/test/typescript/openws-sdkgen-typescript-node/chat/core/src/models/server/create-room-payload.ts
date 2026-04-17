export interface CreateRoomPayloadInit {
    userId: string
    roomId: string
}

export class CreateRoomPayload implements CreateRoomPayloadInit {
    readonly userId: string
    readonly roomId: string

    constructor({ userId, roomId }: CreateRoomPayloadInit = {} as CreateRoomPayloadInit) {
        this.userId = userId
        this.roomId = roomId
    }
}
