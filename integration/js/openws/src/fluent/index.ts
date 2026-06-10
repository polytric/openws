import { Network } from '@polytric/openws-spec/builder'

import { NetworkBinder } from './bindings'
import { Runtime } from './runtime'

export {
    Base,
    Network,
    Role,
    Message,
    Endpoint,
    Spec,
    network,
    role,
    message,
    endpoint,
    spec,
} from '@polytric/openws-spec/builder'
export type { DisconnectFn, PeerProto } from './bindings'

export { disconnect, NetworkBinder } from './bindings'
export { Session, Runtime } from './runtime'

/**
 * Creates runtime bindings from a declarative OpenWS network graph.
 *
 * The returned binder keeps the normalized network available for spec export
 * and exposes per-remote-role binders for attaching message and lifecycle
 * behavior.
 */
export const bindings = (network: Network): NetworkBinder => {
    return new NetworkBinder(network)
}

/**
 * Creates a runtime from network bindings.
 *
 * The runtime materializes bindings into connection-scoped peer handles and
 * sessions. Transport glue can use sessions to drive open, close, error, and
 * message dispatch callbacks.
 */
export const runtime = (binder: NetworkBinder): Runtime => {
    return new Runtime(binder)
}
