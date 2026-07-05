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

test('rst-out writes the generated OpenWS RST source tree', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-out-'))
    try {
        const rstOut = path.join(tempRoot, 'rst')
        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(path.join(tempRoot, 'sdk')),
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
            '--rst-out',
            relativeToPackageRoot(rstOut),
        ])

        assert.ok(existsSync(path.join(rstOut, 'conf.py')))
        assert.match(readFileSync(path.join(rstOut, 'index.rst'), 'utf8'), /Chat Core OpenWS SDK/)
        assert.match(readFileSync(path.join(rstOut, 'core.rst'), 'utf8'), /Client Role/)
        assert.match(readFileSync(path.join(rstOut, 'models.rst'), 'utf8'), /SendMessagePayload/)
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('doc-out defaults to rendered HTML docs', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-doc-out-'))
    try {
        const docOut = path.join(tempRoot, 'docs')
        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(path.join(tempRoot, 'sdk')),
            '--project',
            'Example',
            '--network',
            'core',
            '--hostRole',
            'client',
            '--language',
            'csharp',
            '--environment',
            'unity',
            '--doc-out',
            relativeToPackageRoot(docOut),
        ])

        const indexPath = path.join(docOut, 'index.html')
        assert.ok(existsSync(indexPath))
        assert.match(readFileSync(indexPath, 'utf8'), /Chat Core OpenWS SDK/)
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('rst-in is used as the rendered documentation source', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-in-'))
    try {
        const rstIn = path.join(tempRoot, 'custom-rst')
        const docOut = path.join(tempRoot, 'docs')
        mkdirSync(rstIn, { recursive: true })
        writeFileSync(
            path.join(rstIn, 'index.rst'),
            [
                'Custom OpenWS Docs',
                '==================',
                '',
                'This page came from rst-in.',
                '',
            ].join('\n'),
            'utf8'
        )

        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(path.join(tempRoot, 'sdk')),
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
            '--rst-in',
            relativeToPackageRoot(rstIn),
            '--doc-out',
            relativeToPackageRoot(docOut),
            '--doc-format',
            'markdown',
        ])

        const markdown = readFileSync(path.join(docOut, 'index.md'), 'utf8')
        assert.match(markdown, /# Custom OpenWS Docs/)
        assert.match(markdown, /This page came from rst-in\./)
        assert.doesNotMatch(markdown, /Chat Core OpenWS SDK/)
    } finally {
        rmSync(tempRoot, { recursive: true, force: true })
    }
})

test('rst-in and rst-out may point at the same directory', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-same-'))
    try {
        const rstDir = path.join(tempRoot, 'rst')
        const docOut = path.join(tempRoot, 'docs')
        runCli([
            '--spec',
            './test/spec.json',
            '--out',
            relativeToPackageRoot(path.join(tempRoot, 'sdk')),
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
            '--rst-in',
            relativeToPackageRoot(rstDir),
            '--rst-out',
            relativeToPackageRoot(rstDir),
            '--doc-out',
            relativeToPackageRoot(docOut),
            '--doc-format',
            'markdown',
        ])

        assert.ok(existsSync(path.join(rstDir, 'index.rst')))
        assert.match(readFileSync(path.join(docOut, 'index.md'), 'utf8'), /Chat Core OpenWS SDK/)
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
