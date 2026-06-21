# Skenion SDK

TypeScript SDK for Skenion node authoring, runtime connections, transport
lifecycle, command APIs, and capability negotiation.

The SDK is UI-framework agnostic and does not depend on React or Mantine.

## Active Authoring Surface

The primary SDK authoring surface targets Skenion graph v0.2 documents:

- `defineGraphDocument()` creates normalized v0.2 graph documents.
- `definePatchDefinition()` and `definePatchLibrary()` create v0.2 patch
  library entries.
- `defineProjectDocument()` creates v0.2 project documents with a required
  patch library.
- `createGraphTargetRef()` and `patchPath.*` create Runtime graph targets for
  root graphs, project patches, package patches, embedded patch instances, and
  help working copies.
- `createGraphFragment()` and `createGraphFragmentFromSelection()` create v0.2
  graph fragments for clipboard, help, palette, and paste flows.
- `defineNodeDefinition()` creates v0.2 node definition manifests using v0.2
  ports.
- Runtime client helpers construct default-session and explicit-session URLs,
  validate session info/events, track replay cursors, and summarize sidecar
  startup/health capability metadata.
- generated manifests are validated through `@skenion/contracts`.
- script lifecycle typing exposes only `onInit`, `onInput`, `onEvent`, and
  `onDispose`.

Canonical examples:

```ts
import {
  createGraphTargetRef,
  defineGraphDocument,
  defineGraphNode,
  definePatchDefinition,
  defineProjectDocument,
  definePort,
  patchPath
} from "@skenion/sdk";

const valueOut = definePort({
  id: "out",
  direction: "output",
  type: "number.float",
  rate: "control",
  description: "Output value"
});

const graph = defineGraphDocument({
  id: "graph.main",
  revision: "rev-1",
  nodes: [
    defineGraphNode({
      id: "value-1",
      kind: "core.value",
      kindVersion: "0.2.0",
      params: { value: 0.5 },
      ports: [valueOut]
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
  revision: "rev-project-1",
  graph,
  patchLibrary: [patch]
});

const target = createGraphTargetRef({
  path: patchPath.projectPatch("patch.scale"),
  baseRevision: "rev-patch-1"
});
```

## Legacy v0.1 Import And Migration

The v0.1 helpers remain available only for legacy package import and migration
work:

```ts
import {
  defineLegacyExtensionPackageV01,
  defineLegacyNodeV01,
  legacyT,
  migrateLegacyProjectDocumentV01ToProject
} from "@skenion/sdk";

const value = defineLegacyNodeV01({
  id: "core.value",
  version: "0.1.0",
  displayName: "Value",
  category: "Core",
  ports: [{ id: "out", direction: "output", type: legacyT.value(legacyT.f32()) }],
  execution: { model: "value" }
});

const manifest = defineLegacyExtensionPackageV01({
  id: "skenion/core",
  version: "0.1.0",
  kind: "core-package",
  nodes: [value]
});

const activeProject = migrateLegacyProjectDocumentV01ToProject(legacyProject);
```

The historical `defineNode()`, `defineExtensionPackage()`, and `t.*` exports are
deprecated aliases for the explicit legacy helpers. New collaboration,
marketplace, clipboard, help, and Runtime paste helpers should use v0.2
projects, patch paths, graph fragments, and `GraphTargetRef`.

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

`sessionId` omitted or `null` uses the Runtime default-session alias
(`/v0/session`). Passing a session id uses explicit session addressing
(`/v0/sessions/{sessionId}`). Session info and event readers validate through
`@skenion/contracts` 0.38.0.

Paste operation helpers omit attribution by default, but accept the contract
`RuntimeOperationAttribution` fields when caller context has useful non-security
metadata:

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

## GPU Texture Semantics

Skenion v0.1 legacy helpers do not define a separate `gpu` flow. GPU-backed
values are represented as resource-like typed handles in migration inputs.

For example, `legacyT.gpu.texture2d()` emits:

```ts
{
  flow: "resource",
  dataKind: "gpu.texture2d"
}
```

This means the graph carries a GPU resource handle, not CPU pixels. CPU/GPU
crossing must be expressed through explicit converter nodes, such as video
decode and texture upload nodes.

## Status

Bootstrap repository for the Skenion project. Implementation follows the public architecture and release rules defined in [EchoVisionLab/skenion](https://github.com/echovisionlab/skenion).

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If Skenion helps your artwork, research, publication, installation, or tool, please credit Skenion and EchoVisionLab.
