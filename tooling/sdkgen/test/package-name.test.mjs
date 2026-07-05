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
            dependencies: {},
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

function runCli(args) {
    execFileSync(process.execPath, [cliPath, ...args], {
        cwd: packageRoot,
        stdio: 'pipe',
    })
}

function relativeToPackageRoot(absolutePath) {
    return path.relative(packageRoot, absolutePath)
}
