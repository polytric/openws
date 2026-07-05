# OpenWS SDK Generator

[![npm](https://img.shields.io/npm/v/@polytric/openws-sdkgen)](https://www.npmjs.com/package/@polytric/openws-sdkgen)
[![license](https://img.shields.io/npm/l/@polytric/openws-sdkgen)](https://github.com/polytric/openws/blob/main/LICENSE)

`@polytric/openws-sdkgen` is the OpenWS SDK generator CLI. It takes an OpenWS spec JSON file and produces SDK source code for a target language/environment.

The generator is pipeline-driven:

- Parse CLI arguments
- Load the OpenWS spec
- Build an intermediate representation
- Execute a build plan for the selected language/environment

---

## Install

```bash
pnpm add -g @polytric/openws-sdkgen
```

---

## Usage

```bash
openws-sdkgen \
  --spec ./openws-spec.json \
  --out ./generated \
  --project MyCompany \
  --network core \
  --hostRole server \
  --language csharp \
  --environment unity
```

The CLI exposes the following options:

- `--spec` (string): Path to the OpenWS spec JSON file.
- `--out` (string): Output directory for generated code.
- `--project` (string): Project/namespace prefix for generated code.
- `--network` (string): Network name to generate.
- `--hostRole` (string): Peer role name that represents the host side.
- `--package-name` (string): Optional package name. When present, the selected
  target emits its package manifest (`package.json` for JavaScript/TypeScript,
  Unity UPM `package.json` for C# Unity).
- `--doc-out` (string): Optional rendered documentation output directory. This
  opts into documentation generation.
- `--doc-format` (string): Rendered documentation format (`html` or
  `markdown`). Defaults to `html` when `--doc-out` is set.
- `--rst-out` (string): Optional output directory for the generated RST source
  tree.
- `--rst-in` (string): Optional RST source directory to use as the render input.
  This supports two-pass flows: generate to `--rst-out`, post-process that tree,
  then render the processed tree with `--rst-in`.
- `--language` (string): Target language (`csharp`, `javascript`, or `typescript`).
- `--environment` (string|array): Target environment (`unity`, `node`, `browser`).

---

## Current targets

The generator is wired for:

- C# (Unity) with `newtonsoft` serialization templates.
- JavaScript (Node/browser) packages.
- TypeScript (Node/browser) packages with declaration output.

Generated JavaScript and TypeScript output includes a `tsup` build config. Passing
`--package-name` also emits a package manifest with ESM (`dist/*.js`) and CJS
(`dist/*.cjs`) exports for the root SDK, network metadata, roles, SDK adaptors,
and payload models.

Additional targets are configured through build plans in `tooling/sdkgen/src/plans` and can be expanded as needed.

## Documentation

Passing `--doc-out` generates documentation for the selected OpenWS network. The
default format is HTML, so `--doc-out ./docs` is enough for the normal path.
`--doc-format markdown` writes Markdown instead.

The generator can also emit the intermediate RST source tree. Use `--rst-out`
when another tool or project wants to inspect or transform the RST. If
`--rst-in` is provided, rendered docs use that RST tree instead of the generated
tree. This lets callers run a two-pass flow:

```bash
openws-sdkgen ... --rst-out ./build/openws-rst
# post-process ./build/openws-rst into ./build/openws-rst-custom
openws-sdkgen ... --rst-in ./build/openws-rst-custom --doc-out ./build/openws-docs
```

---

## License

Apache-2.0
