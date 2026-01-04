import fs from 'node:fs'

import type { Spec, PipelineContext } from './types.js'
import { toCamelCase } from './utils.js'

export default function loadSpec(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')

    const { specPath } = request
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as Spec

    // normalize
    spec.name = toCamelCase(spec.name)
    for (const [networkName, networkSpec] of Object.entries(spec.networks)) {
        for (const [roleName, roleSpec] of Object.entries(networkSpec.roles)) {
            for (const [messageName, messageSpec] of Object.entries(roleSpec.messages)) {
                delete roleSpec.messages[messageName]
                roleSpec.messages[toCamelCase(messageName)] = {
                    ...messageSpec,
                }
            }
            delete spec.networks[networkName]
            networkSpec.roles[toCamelCase(roleName)] = {
                ...roleSpec,
                name: toCamelCase(roleName),
            }
        }
        delete spec.networks[networkName]
        spec.networks[toCamelCase(networkName)] = {
            ...networkSpec,
            name: toCamelCase(networkName),
        }
    }

    return {
        ...ctx,
        spec,
    }
}
