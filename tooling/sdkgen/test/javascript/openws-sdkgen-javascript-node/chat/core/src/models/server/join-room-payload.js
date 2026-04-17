export class JoinRoomPayload {
    constructor({ userId, roomId } = {}) {
        this.userId = userId
        this.roomId = roomId
    }
}
