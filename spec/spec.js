const S = require("@pocketgems/schema");

const keyPattern = "[a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9]";

const OpenWSSchema = S.obj({
  openws: S.str.enum("0.0.1").desc("The OpenWS schema version"),
  info: S.obj({
    title: S.str.desc("A title for the overall system.").optional(),
    description: S.str
      .desc(
        "A high level description of the overall system, including all networks and all participants"
      )
      .optional(),
    version: S.str.desc("A version string").optional(),
  }),
  networks: S.map
    .min(1)
    .keyPattern(keyPattern)
    .value(
        S.obj({
            participants:         S.map
            .min(2)
            .keyPattern(keyPattern)
            .desc(
              "A participant is a server or client in the network. Multiple server and clients can coexist in the same network. The simplest network contains a server-client pair."
            )
            .value(
              S.obj({
                endpoints: S.arr(
                    S.obj({
                        host: S.str,
                        port: S.int.min(0).max(65535).default(443),
                        path: S.str.default('/'),
                    })
                ).min(1).optional().desc('A participant can declare an endpoint to accept connections from other participants, normally used by servers'),
                handlers: S.map
                  .min(1)
                  .keyPattern(keyPattern)
                  .value(
                    S.obj({
                      payload: S.obj({})
                        .min(1)
                        .desc(
                            "Must be a valid JSON schema spec. For brevity, openws omits this spec, but implementations should valid this"
                        ),
                      description: S.str.optional()
                    })
                  )
                  .desc(
                    "A handler is implemented by a participant, and participants can invoke others handlers. The OpenWS spec only defines the shape of the payload, and how things get encoded / decoded on the wire, it doesn't determine behavior (through through description the behavior can be documented)."
                  ),
              })
            ),    
        })
    ),
});

if (require.main === module) {
  console.log(JSON.stringify(OpenWSSchema.jsonSchema()));
}

module.exports = OpenWSSchema;
