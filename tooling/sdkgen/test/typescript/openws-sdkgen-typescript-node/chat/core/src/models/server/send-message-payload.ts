export interface SendMessagePayloadInit {
    userId: string
    roomId: string
    text: string
    tags?: string[]
}

export class SendMessagePayload implements SendMessagePayloadInit {
    readonly userId: string
    readonly roomId: string
    readonly text: string
    readonly tags?: string[]

    constructor(
        { userId, roomId, text, tags }: SendMessagePayloadInit = {} as SendMessagePayloadInit
    ) {
        this.userId = userId
        this.roomId = roomId
        this.text = text
        this.tags = tags
    }
}
