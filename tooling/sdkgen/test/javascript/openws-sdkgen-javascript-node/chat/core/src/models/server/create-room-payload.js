export class CreateRoomPayload {
    constructor({ userId, roomId } = {}) {
        this.userId = userId
        this.roomId = roomId
    }
}
