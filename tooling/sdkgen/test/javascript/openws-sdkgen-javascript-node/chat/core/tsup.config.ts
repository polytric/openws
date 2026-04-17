import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.js',
        network: 'src/network.js',
        'roles/index': 'src/roles/index.js',
        'sdk/index': 'src/sdk/index.js',
        'roles/server': 'src/roles/server.js',
        'roles/client': 'src/roles/client.js',
        'roles/portal': 'src/roles/portal.js',
        'sdk/client': 'src/sdk/client.js',
        'models/server/index': 'src/models/server/index.js',
        'models/server/create-room-payload': 'src/models/server/create-room-payload.js',
        'models/server/join-room-payload': 'src/models/server/join-room-payload.js',
        'models/server/send-message-payload': 'src/models/server/send-message-payload.js',
        'models/server/request-room-stats-payload':
            'src/models/server/request-room-stats-payload.js',
        'models/client/index': 'src/models/client/index.js',
        'models/client/joined-room-payload': 'src/models/client/joined-room-payload.js',
        'models/client/received-message-payload': 'src/models/client/received-message-payload.js',
        'models/portal/index': 'src/models/portal/index.js',
        'models/portal/received-room-stats-payload':
            'src/models/portal/received-room-stats-payload.js',
    },
    format: ['esm', 'cjs'],
    dts: false,
    clean: true,
    target: 'es2022',
    outDir: 'dist',
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' }
    },
})
