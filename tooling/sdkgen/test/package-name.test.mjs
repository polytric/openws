import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '..')
const cliPath = path.join(packageRoot, 'dist', 'main.cjs')

test('package manifests are generated only when --package-name is provided', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-package-name-'))
    try {
        const noPackageOutput = path.join(tempRoot, 'typescript-no-package')
        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(noPackageOutput),
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--language',
            'typescript',
            '--environment',
            'node',
        ])
        assert.equal(existsSync(path.join(noPackageOutput, 'chat', 'core', 'package.json')), false)

        const packageOutput = path.join(tempRoot, 'typescript-package')
        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(packageOutput),
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--package-name',
            '@example/chat-openws-sdk',
            '--language',
            'typescript',
            '--environment',
            'node',
        ])
        const manifest = JSON.parse(
            readFileSync(path.join(packageOutput, 'chat', 'core', 'package.json'), 'utf8')
        )
        assert.equal(manifest.name, '@example/chat-openws-sdk')
        assert.equal(manifest.version, '1.0.0')
        assert.equal(manifest.dependencies['@polytric/openws'], '^0.0.11')
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('CLI accepts absolute spec and output paths', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-absolute-paths-'))
    try {
        const specPath = path.join(tempRoot, 'spec.json')
        const outPath = path.join(tempRoot, 'typescript-package')
        writeFileSync(specPath, JSON.stringify(loadTestSpec(), null, 4), 'utf8')

        runCli([
            '--spec',
            specPath,
            '--out',
            outPath,
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--package-name',
            '@example/chat-openws-sdk',
            '--language',
            'typescript',
            '--environment',
            'node',
        ])

        assert.ok(existsSync(path.join(outPath, 'chat', 'core', 'package.json')))
        assert.equal(
            existsSync(path.join(packageRoot, outPath, 'chat', 'core', 'package.json')),
            false
        )
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('Unity package mode emits UPM manifest and Runtime asset metadata', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-unity-package-'))
    try {
        mkdirSync(path.join(tempRoot, 'Core'), { recursive: true })
        writeFileSync(path.join(tempRoot, 'Core.meta'), 'stale legacy network meta', 'utf8')
        writeFileSync(path.join(tempRoot, 'Example.Chat.Sdk.asmdef'), 'stale legacy asmdef', 'utf8')
        writeFileSync(
            path.join(tempRoot, 'Example.Chat.Sdk.asmdef.meta'),
            'stale legacy asmdef meta',
            'utf8'
        )

        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(tempRoot),
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--package-name',
            'com.example.chat.sdk',
            '--language',
            'csharp',
            '--environment',
            'unity',
        ])

        const manifest = JSON.parse(readFileSync(path.join(tempRoot, 'package.json'), 'utf8'))
        assert.deepEqual(manifest, {
            name: 'com.example.chat.sdk',
            version: '1.0.0',
            displayName: 'Example Chat SDK',
            description: 'A chat service',
            dependencies: {
                'com.unity.nuget.newtonsoft-json': '3.2.2',
            },
        })
        assert.ok(existsSync(path.join(tempRoot, 'package.json.meta')))
        assert.ok(existsSync(path.join(tempRoot, 'Runtime.meta')))
        assert.equal(existsSync(path.join(tempRoot, 'Core.meta')), false)
        assert.equal(existsSync(path.join(tempRoot, 'Example.Chat.Sdk.asmdef')), false)
        assert.equal(existsSync(path.join(tempRoot, 'Example.Chat.Sdk.asmdef.meta')), false)

        const model = readFileSync(
            path.join(
                tempRoot,
                'Runtime',
                'Example.Chat.Sdk',
                'Core',
                'Models',
                'Server',
                'SendMessagePayload.cs'
            ),
            'utf8'
        )
        assert.match(model, /^\s+public List<string> Tags;$/m)
        assert.doesNotMatch(model, /&lt;|&gt;/)
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('package manifest uses network version before service version', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-network-version-'))
    try {
        const spec = loadTestSpec()
        spec.networks.core.version = '2.5.0'
        const specPath = path.join(tempRoot, 'spec.json')
        writeFileSync(specPath, JSON.stringify(spec, null, 4), 'utf8')

        runCli([
            '--spec',
            relativeToPackageRoot(specPath),
            '--out',
            relativeToPackageRoot(path.join(tempRoot, 'typescript-package')),
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--package-name',
            '@example/chat-openws-sdk',
            '--language',
            'typescript',
            '--environment',
            'node',
        ])

        const packageRoot = path.join(tempRoot, 'typescript-package', 'chat', 'core')
        const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
        assert.equal(manifest.version, '2.5.0')
        assert.match(
            readFileSync(path.join(packageRoot, 'src', 'network.ts'), 'utf8'),
            /networkVersion = '2\.5\.0'/
        )
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('sdkgen requires a service or network version', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-missing-version-'))
    try {
        const spec = loadTestSpec()
        delete spec.version
        delete spec.networks.core.version
        const specPath = path.join(tempRoot, 'spec.json')
        writeFileSync(specPath, JSON.stringify(spec, null, 4), 'utf8')

        assert.throws(
            () =>
                runCli([
                    '--spec',
                    relativeToPackageRoot(specPath),
                    '--out',
                    relativeToPackageRoot(path.join(tempRoot, 'typescript-package')),
                    '--project',
                    'Example',
                    '--network',
                    'core',
                    '--hostRole',
                    'client',
                    '--package-name',
                    '@example/chat-openws-sdk',
                    '--language',
                    'typescript',
                    '--environment',
                    'node',
                ]),
            /Version is required for network "core"/
        )
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

function runCli(args) {
    execFileSync(process.execPath, [cliPath, ...args], {
        cwd: packageRoot,
        stdio: 'pipe',
    })
}

function loadTestSpec() {
    return JSON.parse(readFileSync(path.join(packageRoot, 'test', 'spec.json'), 'utf8'))
}

function relativeToPackageRoot(absolutePath) {
    return path.relative(packageRoot, absolutePath)
}
