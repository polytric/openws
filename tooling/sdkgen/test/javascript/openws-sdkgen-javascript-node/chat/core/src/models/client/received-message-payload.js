export class ReceivedMessagePayload {
    constructor({ senderId, roomId, text } = {}) {
        this.senderId = senderId
        this.roomId = roomId
        this.text = text
    }
}
