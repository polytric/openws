import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '../..')
const generatedPackageFolders = ['Example.Chat.Core.Sdk', 'Example.Chat.Core.Sdk.User']
const guidPrefix = 'openws-sdkgen/unity-meta/'
const importerByExtension = new Map([
    ['.asmdef', 'AssemblyDefinitionImporter'],
    ['.asmref', 'AssemblyDefinitionReferenceImporter'],
    ['.cs', 'MonoImporter'],
    ['.json', 'DefaultImporter'],
    ['.md', 'DefaultImporter'],
])
const outputRoots = [
    {
        label: 'generated C# Unity output',
        root: path.join(packageRoot, 'generated', 'dotnet', 'unity'),
    },
]

for (const outputRoot of outputRoots) {
    test(`${outputRoot.label} has deterministic Unity meta files`, () => {
        const expectedAssets = new Set()

        for (const packageFolder of generatedPackageFolders) {
            const packageRootPath = path.join(outputRoot.root, packageFolder)
            assert.ok(
                existsSync(packageRootPath),
                `${packageFolder} should exist in ${outputRoot.label}`
            )

            for (const asset of listGeneratedUnityAssets(outputRoot.root, packageRootPath)) {
                expectedAssets.add(asset.relativePath)
                const metaPath = `${asset.absolutePath}.meta`
                assert.ok(existsSync(metaPath), `${asset.relativePath} should have a .meta sidecar`)

                const meta = parseMetaFile(metaPath)
                assert.equal(
                    meta.fileFormatVersion,
                    '2',
                    `${asset.relativePath}.meta should use Unity format 2`
                )
                assert.match(
                    meta.guid,
                    /^[0-9a-f]{32}$/,
                    `${asset.relativePath}.meta should have a Unity GUID`
                )
                assert.equal(
                    meta.guid,
                    expectedGuid(asset.relativePath),
                    `${asset.relativePath}.meta should use the sdkgen deterministic GUID rule`
                )
                assert.ok(
                    meta.content.includes(`${asset.importer}:`),
                    `${asset.relativePath}.meta should use ${asset.importer}`
                )

                if (asset.folderAsset) {
                    assert.ok(
                        meta.content.includes('folderAsset: yes'),
                        `${asset.relativePath}.meta should mark folders as folder assets`
                    )
                }
            }

            for (const metaPath of listMetaFiles(packageRootPath)) {
                const assetPath = metaPath.slice(0, -'.meta'.length)
                const relativeAssetPath = normalizeRelativePath(outputRoot.root, assetPath)
                assert.ok(
                    expectedAssets.has(relativeAssetPath),
                    `${relativeAssetPath}.meta should not be orphaned`
                )
            }
        }
    })
}

test('Unity testbed package fixture has deterministic Unity meta files', () => {
    const assetsRoot = path.join(packageRoot, 'test', 'dotnet', 'UnityTestbed', 'Assets')
    const packageRootPath = path.join(assetsRoot, 'Example.Chat.Sdk')
    assert.ok(existsSync(packageRootPath), 'Unity package fixture should exist')

    const rootMeta = parseMetaFile(`${packageRootPath}.meta`)
    assert.equal(rootMeta.fileFormatVersion, '2')
    assert.match(rootMeta.guid, /^[0-9a-f]{32}$/)
    assert.ok(rootMeta.content.includes('DefaultImporter:'))
    assert.ok(rootMeta.content.includes('folderAsset: yes'))

    const expectedAssets = new Set()
    for (const asset of listGeneratedUnityAssets(packageRootPath, packageRootPath, {
        includeRoot: false,
    })) {
        expectedAssets.add(asset.relativePath)
        const metaPath = `${asset.absolutePath}.meta`
        assert.ok(existsSync(metaPath), `${asset.relativePath} should have a .meta sidecar`)

        const meta = parseMetaFile(metaPath)
        assert.equal(
            meta.fileFormatVersion,
            '2',
            `${asset.relativePath}.meta should use Unity format 2`
        )
        assert.match(
            meta.guid,
            /^[0-9a-f]{32}$/,
            `${asset.relativePath}.meta should have a Unity GUID`
        )
        assert.equal(
            meta.guid,
            expectedGuid(asset.relativePath),
            `${asset.relativePath}.meta should use the sdkgen deterministic GUID rule`
        )
        assert.ok(
            meta.content.includes(`${asset.importer}:`),
            `${asset.relativePath}.meta should use ${asset.importer}`
        )

        if (asset.folderAsset) {
            assert.ok(
                meta.content.includes('folderAsset: yes'),
                `${asset.relativePath}.meta should mark folders as folder assets`
            )
        }
    }

    for (const metaPath of listMetaFiles(packageRootPath, { includeRoot: false })) {
        const assetPath = metaPath.slice(0, -'.meta'.length)
        const relativeAssetPath = normalizeRelativePath(packageRootPath, assetPath)
        assert.ok(
            expectedAssets.has(relativeAssetPath),
            `${relativeAssetPath}.meta should not be orphaned`
        )
    }
})

test('generated C# Unity models render generic List types without HTML escaping', () => {
    const modelPath = path.join(
        packageRoot,
        'generated',
        'dotnet',
        'unity',
        'Example.Chat.Core.Sdk',
        'Models',
        'Server',
        'SendMessagePayload.cs'
    )
    const model = readFileSync(modelPath, 'utf8')

    assert.match(model, /^using System\.Collections\.Generic;$/m)
    assert.match(model, /^\s+public List<string> Tags;$/m)
    assert.doesNotMatch(model, /&lt;|&gt;/)
})

function listGeneratedUnityAssets(outputRoot, rootPath, options = {}) {
    const assets = []

    walk(rootPath, absolutePath => {
        if (options.includeRoot === false && absolutePath === rootPath) return

        const stats = statSync(absolutePath)
        if (stats.isDirectory()) {
            assets.push({
                absolutePath,
                folderAsset: true,
                importer: 'DefaultImporter',
                relativePath: normalizeRelativePath(outputRoot, absolutePath),
            })
            return
        }

        const importer = importerByExtension.get(path.extname(absolutePath))
        if (!importer) return

        assets.push({
            absolutePath,
            folderAsset: false,
            importer,
            relativePath: normalizeRelativePath(outputRoot, absolutePath),
        })
    })

    return assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

function listMetaFiles(rootPath, options = {}) {
    const metaFiles = []
    const rootMetaPath = `${rootPath}.meta`
    if (options.includeRoot !== false && existsSync(rootMetaPath)) metaFiles.push(rootMetaPath)

    walk(rootPath, absolutePath => {
        if (statSync(absolutePath).isFile() && absolutePath.endsWith('.meta')) {
            metaFiles.push(absolutePath)
        }
    })

    return metaFiles
}

function walk(directoryPath, visit) {
    visit(directoryPath)
    for (const name of readdirSync(directoryPath)) {
        const absolutePath = path.join(directoryPath, name)
        if (statSync(absolutePath).isDirectory()) {
            walk(absolutePath, visit)
            continue
        }

        visit(absolutePath)
    }
}

function parseMetaFile(metaPath) {
    const content = readFileSync(metaPath, 'utf8')
    return {
        content,
        fileFormatVersion: content.match(/^fileFormatVersion: (.+)$/m)?.[1],
        guid: content.match(/^guid: ([0-9a-f]{32})$/m)?.[1],
    }
}

function expectedGuid(relativeAssetPath) {
    return createHash('md5').update(`${guidPrefix}${relativeAssetPath}`).digest('hex')
}

function normalizeRelativePath(outputRoot, assetPath) {
    return path.relative(outputRoot, assetPath).replaceAll(path.sep, '/')
}
