export interface SendMessagePayloadInit {
    userId: string
    roomId: string
    text: string
}

export class SendMessagePayload implements SendMessagePayloadInit {
    readonly userId: string
    readonly roomId: string
    readonly text: string

    constructor({ userId, roomId, text }: SendMessagePayloadInit = {} as SendMessagePayloadInit) {
        this.userId = userId
        this.roomId = roomId
        this.text = text
    }
}
