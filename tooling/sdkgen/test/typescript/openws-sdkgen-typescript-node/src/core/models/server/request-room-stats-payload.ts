export interface RequestRoomStatsPayloadInit {
    roomId: string
}

export class RequestRoomStatsPayload implements RequestRoomStatsPayloadInit {
    readonly roomId: string

    constructor({ roomId }: RequestRoomStatsPayloadInit = {} as RequestRoomStatsPayloadInit) {
        this.roomId = roomId
    }
}
