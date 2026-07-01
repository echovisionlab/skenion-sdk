# skenion SDK

TypeScript SDK for skenion node authoring, runtime connections, transport
lifecycle, command APIs, and capability negotiation.

The SDK is UI-framework agnostic and does not depend on React or Mantine.

## Current Authoring Surface

The primary SDK authoring surface targets the current skenion `0.1` graph,
project, patch-library, graph-fragment, and package contracts:

- `defineGraphDocument()` creates normalized current `0.1` graph documents.
- `definePatchDefinition()` and `definePatchLibrary()` create current `0.1`
  patch library entries.
- `defineProjectDocument()` creates current `0.1` project documents.
- `createGraphTargetRef()` and `patchPath.*` create Runtime graph targets for
  root graphs, project patches, package patches, embedded patch instances, and
  help working copies.
- `createGraphFragment()` and `createGraphFragmentFromSelection()` create
  current `0.1` graph fragments for clipboard, help, palette, and paste flows.
- `serializeGraphFragmentClipboard()` and `parseGraphFragmentClipboard()` wrap
  and read the framework-agnostic graph-fragment clipboard JSON envelope.
- `defineObjectNode()` creates graph nodes from user-facing object specs such as
  `manipulator`, `osc~ 440`, and `+ 1`.
- `defineNodeDefinition()` creates current `0.1` implementation definition
  manifests.
- `defineObject()` and `definePackageManifest()` create current package
  manifests with `provides.objects[]` as the object authoring surface.
- `objectSpecForCatalogEntry()`, `createObjectNodeFromCatalogEntry()`, and
  `resolveCatalogObjectSpec()` bridge package/catalog exports into graph nodes.
- `defineExtensionPackage()` creates legacy extension manifests and rejects
  unsupported Runtime ABI versions.
- Runtime client helpers construct default-session and explicit-session URLs,
  validate SDK-owned session info/events, track replay cursors, and summarize
  sidecar startup/health capability metadata.
- Compatibility matrix helpers validate `skenion.compatibility-matrix` `0.1.0`
  documents for promotion checks, including the SDK-supported Contracts range
  and installed Contracts package evidence.
- Shared graph, project, package, manifest, graph-fragment, and paste request
  payloads are validated through `@skenion/contracts`.
- Only current contract helper names are exported; unsupported versions are
  rejected instead of adapted.

Canonical examples:

```ts
import {
  createGraphTargetRef,
  defineGraphDocument,
  defineObjectNode,
  definePatchDefinition,
  defineProjectDocument,
  definePort,
  patchPath
} from "@skenion/sdk";

const valueOut = definePort({
  id: "out",
  direction: "output",
  type: "control.number.float",
  rate: "control",
  description: "Output value"
});

const graph = defineGraphDocument({
  id: "graph.main",
  revision: "rev-1",
  nodes: [
    defineObjectNode({
      id: "osc-1",
      objectSpec: "osc~ 440",
      params: { value: 0.5 },
      ports: [valueOut]
    }),
    defineObjectNode({
      id: "add-1",
      objectSpec: "+ 1"
    })
  ]
});

const patch = definePatchDefinition({
  id: "patch.scale",
  revision: "rev-patch-1",
  graph
});

const project = defineProjectDocument({
  id: "project.demo",
  documentId: "00000000-0000-4000-8000-000000000056",
  revision: "rev-project-1",
  graph,
  patchLibrary: [patch]
});

const target = createGraphTargetRef({
  path: patchPath.projectPatch("patch.scale"),
  baseRevision: "rev-patch-1"
});
```

Package manifests use the same current contract surface:

```ts
import {
  defineObject,
  definePackageManifest,
  defineNodeDefinition,
  definePort
} from "@skenion/sdk";

const oscillatorDefinition = defineNodeDefinition({
  id: "skenion.core.oscillator",
  version: "0.1.0",
  displayName: "Oscillator",
  category: "Audio",
  ports: [
    definePort({
      id: "out",
      direction: "output",
      type: "value.core.float32",
      rate: "audio"
    })
  ],
  execution: { model: "audio_block" }
});

const oscillator = defineObject({
  objectId: "oscillator",
  primaryObjectSpec: "osc~ 440",
  aliases: ["osc~"],
  definition: oscillatorDefinition,
  display: {
    title: "Oscillator",
    description: "Sine oscillator",
    helpId: "help.oscillator"
  }
});

const manifest = definePackageManifest({
  id: "skenion/core",
  version: "0.57.0",
  objects: [oscillator],
  help: [
    {
      id: "help.oscillator",
      path: "help/oscillator.md"
    }
  ]
});
```

Short object specs are the user-facing syntax. Package provider and `objectId`
values identify the stored implementation selected by catalog/package
resolution; they are not the default text users type for an object.

## Runtime Session Helpers

Runtime helpers work with local-managed, local-shared, and remote Runtime base
URLs without requiring a hardcoded client identity:

```ts
import {
  createRuntimeClient,
  parseRuntimeSessionEvent,
  runtimeLastEventIdHeaders
} from "@skenion/sdk";

const runtime = createRuntimeClient({
  baseUrl: "http://127.0.0.1:3761",
  sessionId: "window-a"
});

const infoUrl = runtime.sessionUrl({ route: "info" });
const eventsUrl = runtime.eventsUrl("7");
const reconnectHeaders = runtimeLastEventIdHeaders("7");
```

`sessionId` omitted or `null` resolves to the explicit Runtime default session
id, producing `/v0/sessions/default`. Passing another session id uses the same
explicit session addressing form (`/v0/sessions/{sessionId}`). The removed
`/v0/session` alias is not generated by the SDK. Session info, event, sidecar,
and collaboration transport helpers use SDK-owned transport shapes; shared graph
and paste payloads still use the supported Contracts `0.57` line.

## Compatibility Matrix Helpers

SDK tooling can consume compatibility matrix evidence without making the SDK a
second schema authority. The helper uses the public `@skenion/contracts`
`validateCompatibilityMatrixV01` export, then adds SDK-specific range and
installed-package issues:

```ts
import { readCompatibilityMatrixForSdk } from "@skenion/sdk";

const matrix = readCompatibilityMatrixForSdk(compatibilityMatrixJson, {
  sdkPackageVersion: releaseWorkflow.sdkPackageVersion,
  contractsDependencyRange: releaseWorkflow.contractsDependencyRange,
  contractsPackageVersion: releaseWorkflow.installedContractsVersion
});
```

The SDK peer dependency must declare the supported Contracts line as
`>=0.57.0 <0.58.0`. SDK package versions may differ from Contracts package
versions as long as the matrix `contracts-range`, SDK supported range, and
installed Contracts package version all agree with that line.

## Local Contracts Integration

Default SDK installs, builds, tests, and `pnpm run ci` use the registry
`@skenion/contracts` dependency declared in `package.json` and `pnpm-lock.yaml`.
For explicit in-flight cross-repo validation against a local Contracts checkout,
run:

```sh
pnpm run check:local-contracts -- --contracts-path ../Skenion-contracts/packages/ts
```

If no path is provided, the script checks these local source locations in order:
`.deps/skenion-contracts/packages/ts`, `../Skenion-contracts/packages/ts`, and
`../skenion-contracts/packages/ts`. The local Contracts package must be built
with `dist/index.js` present, must be named `@skenion/contracts`, and its
version must satisfy both the SDK peer and dev dependency ranges. The script
prints Contracts git branch/commit evidence when available, temporarily points
`node_modules/@skenion/contracts` at the local package, runs SDK `ci`, and then
restores the original installed dependency without changing committed manifests
or lockfiles. Release mode rejects this override:
`SKENION_RELEASE_MODE=1 pnpm run check:local-contracts` fails closed.

Paste operation helpers omit attribution by default, but accept SDK-owned
`RuntimeOperationAttribution` metadata when caller context has useful
non-security metadata:

```ts
import { createPasteGraphFragmentOperation } from "@skenion/sdk";

const operation = createPasteGraphFragmentOperation({
  id: "op.paste.1",
  request,
  attribution: {
    actorId: "participant-a",
    clientId: "window-a",
    label: "paste from help"
  }
});
```

## Status

Bootstrap repository for the skenion project. Implementation follows the public architecture and release rules defined in [skenion/skenion](https://github.com/skenion/skenion).

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If skenion helps your artwork, research, publication, installation, or tool, please credit skenion and the skenion contributors.
