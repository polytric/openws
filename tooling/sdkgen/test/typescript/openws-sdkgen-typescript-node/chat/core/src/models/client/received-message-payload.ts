export interface ReceivedMessagePayloadInit {
    senderId: string
    roomId: string
    text: string
}

export class ReceivedMessagePayload implements ReceivedMessagePayloadInit {
    readonly senderId: string
    readonly roomId: string
    readonly text: string

    constructor(
        { senderId, roomId, text }: ReceivedMessagePayloadInit = {} as ReceivedMessagePayloadInit
    ) {
        this.senderId = senderId
        this.roomId = roomId
        this.text = text
    }
}
