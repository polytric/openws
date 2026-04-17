export class SendMessagePayload {
    constructor({ userId, roomId, text } = {}) {
        this.userId = userId
        this.roomId = roomId
        this.text = text
    }
}
