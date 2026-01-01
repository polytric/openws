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
export type { ApiProto } from './bindings'

export { NetworkBinder } from './bindings'
export { Session, Runtime } from './runtime'
export const bindings = (network: Network): NetworkBinder => {
    return new NetworkBinder(network)
}
export const runtime = (binder: NetworkBinder): Runtime => {
    return new Runtime(binder)
}
