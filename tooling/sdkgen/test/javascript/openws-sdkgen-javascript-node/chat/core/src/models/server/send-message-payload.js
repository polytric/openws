export class SendMessagePayload {
    constructor({ userId, roomId, text, tags } = {}) {
        this.userId = userId
        this.roomId = roomId
        this.text = text
        this.tags = tags
    }
}
