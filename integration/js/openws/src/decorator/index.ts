import { disconnect as disconnectPeer } from '../fluent'

export { disconnect, runtime } from '../fluent'
export { bindings } from './bindings'
export * from './network'
export * from './role'
export * from './message'

type ExtractInstance<T> = T extends new (...args: any[]) => infer I ? I : T

/**
 * Type helper for a connected decorated peer role class.
 *
 * `Peer<typeof Client>` maps public instance methods declared on `Client` to
 * async payload-sending methods available inside host handlers.
 */
export type Peer<T> = {
    [K in keyof ExtractInstance<T> as K extends 'constructor'
        ? never
        : ExtractInstance<T>[K] extends (...args: any[]) => any
          ? K
          : never]: (payload: any) => Promise<any>
}

export class HostRole {
    async disconnect(peer: unknown): Promise<void> {
        await disconnectPeer(peer as any)
    }
}
