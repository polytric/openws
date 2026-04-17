export class JoinedRoomPayload {
    constructor({ joinerId, roomId } = {}) {
        this.joinerId = joinerId
        this.roomId = roomId
    }
}
