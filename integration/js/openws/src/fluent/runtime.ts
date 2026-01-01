import type { ApiProto, NetworkBinder, SendFn } from './bindings'

export class Session {
    private api?: ApiProto
    private fromRole?: string

    constructor(
        private readonly binder: NetworkBinder,
        private readonly rawSend: SendFn
    ) {}

    async open(fromRole: string) {
        if (!this.api) {
            this.fromRole = fromRole
            this.api = this.binder.fromRoles[fromRole].createApi(this.rawSend)
            await this.binder.fromRoles[fromRole].handleOpen?.(fromRole)
        }
    }

    async close() {
        if (!this.fromRole) {
            return // not opened
        }
        await this.binder.fromRoles[this.fromRole].handleClose?.(this.fromRole)
    }

    async error(error: Error) {
        if (!this.fromRole) {
            return // not opened
        }
        await this.binder.fromRoles[this.fromRole].handleError?.(this.fromRole, error)
    }

    handleMessage: SendFn = async (fromRole, messageName, rawPayload) => {
        if (!this.api) {
            throw new Error('Session not opened')
        }
        await this.binder.fromRoles[fromRole].handleMessage(
            messageName,
            JSON.parse(rawPayload),
            this.api
        )
    }
}

export class Runtime {
    constructor(private readonly binder: NetworkBinder) {}

    newSession(rawSend: SendFn) {
        return new Session(this.binder, rawSend)
    }
}
