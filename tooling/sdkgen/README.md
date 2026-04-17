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
- `--hostRole` (string): Participant role name that represents the host side.
- `--language` (string): Target language (`csharp`, `javascript`, or `typescript`).
- `--environment` (string|array): Target environment (`unity`, `node`, `browser`).

---

## Current targets

The generator is wired for:

- C# (Unity) with `newtonsoft` serialization templates.

Additional targets are configured through build plans in `tooling/sdkgen/src/plans` and can be expanded as needed.

---

## License

Apache-2.0
