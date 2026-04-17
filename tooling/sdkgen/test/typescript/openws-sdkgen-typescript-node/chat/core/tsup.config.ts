import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        network: 'src/network.ts',
        'roles/index': 'src/roles/index.ts',
        'sdk/index': 'src/sdk/index.ts',
        'roles/server': 'src/roles/server.ts',
        'roles/client': 'src/roles/client.ts',
        'roles/portal': 'src/roles/portal.ts',
        'sdk/client': 'src/sdk/client.ts',
        'models/server/index': 'src/models/server/index.ts',
        'models/server/create-room-payload': 'src/models/server/create-room-payload.ts',
        'models/server/join-room-payload': 'src/models/server/join-room-payload.ts',
        'models/server/send-message-payload': 'src/models/server/send-message-payload.ts',
        'models/server/request-room-stats-payload':
            'src/models/server/request-room-stats-payload.ts',
        'models/client/index': 'src/models/client/index.ts',
        'models/client/joined-room-payload': 'src/models/client/joined-room-payload.ts',
        'models/client/received-message-payload': 'src/models/client/received-message-payload.ts',
        'models/portal/index': 'src/models/portal/index.ts',
        'models/portal/received-room-stats-payload':
            'src/models/portal/received-room-stats-payload.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2022',
    outDir: 'dist',
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' }
    },
})
