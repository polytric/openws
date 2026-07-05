import S from '@pocketgems/schema'

const keyPattern = '[A-Za-z](?:[A-Za-z0-9_-]*[A-Za-z0-9])?'

const messageSchema = S.obj({
    payload: S.obj({}).desc(
        'Must be a valid JSON schema spec. For brevity, openws omits this spec, but implementations should valid this'
    ),
    description: S.str.optional(),
    version: S.str.optional(),
    from: S.arr(S.str).desc('A list of roles that can send this message').optional(),
})

messageSchema.additionalProperties = true

const endpointSchema = S.obj({
    host: S.str,
    port: S.int.min(1).max(65535),
    path: S.str,
})

endpointSchema.additionalProperties = true

const roleSchema = S.obj({
    endpoints: S.arr(endpointSchema)
        .min(1)
        .optional()
        .desc(
            'A role can declare an endpoint to accept connections from remote roles, normally used by servers'
        ),
    messages: S.map
        .keyPattern(keyPattern)
        .value(messageSchema)
        .desc(
            "A message accepted by the role and handled by the role, and roles can send messages to remote roles that accept them. The OpenWS spec only defines the shape of the payload, and how things get encoded / decoded on the wire, it doesn't determine behavior (though description can document the behavior)."
        ),
    description: S.str.optional(),
    version: S.str.optional(),
})

roleSchema.additionalProperties = true

const networkSchema = S.obj({
    roles: S.map
        .min(1)
        .keyPattern(keyPattern)
        .desc(
            'A network is a collection of roles that exchange messages. Multiple roles can coexist in the same network. The simplest network contains a server-client pair.'
        )
        .value(roleSchema),
    description: S.str.optional(),
    version: S.str.optional(),
})

networkSchema.additionalProperties = true

const openWsSchema = S.obj({
    openws: S.str.enum('0.0.1', '0.0.2').desc('The OpenWS schema version'),
    name: S.str.desc('A title for the overall system.').optional(),
    description: S.str
        .desc(
            'A high level description of the overall system, including all networks and all roles'
        )
        .optional(),
    version: S.str.desc('A version string').optional(),
    networks: S.map.min(1).keyPattern(keyPattern).value(networkSchema),
})

openWsSchema.additionalProperties = true

export default openWsSchema
