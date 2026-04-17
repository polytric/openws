export interface ReceivedRoomStatsPayloadInit {
    roomId: string
}

export class ReceivedRoomStatsPayload implements ReceivedRoomStatsPayloadInit {
    readonly roomId: string

    constructor({ roomId }: ReceivedRoomStatsPayloadInit = {} as ReceivedRoomStatsPayloadInit) {
        this.roomId = roomId
    }
}
