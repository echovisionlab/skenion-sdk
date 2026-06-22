# Skenion SDK

TypeScript SDK for Skenion node authoring, runtime connections, transport
lifecycle, command APIs, and capability negotiation.

The SDK is UI-framework agnostic and does not depend on React or Mantine.

## Current Authoring Surface

The primary SDK authoring surface targets the current Skenion `0.1` graph,
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
- `defineNodeDefinition()` creates current `0.1` node definition manifests.
- `defineExtensionPackage()` creates current package manifests and rejects
  unsupported Runtime ABI versions.
- Runtime client helpers construct default-session and explicit-session URLs,
  validate session info/events, track replay cursors, and summarize sidecar
  startup/health capability metadata.
- Generated documents and manifests are validated through `@skenion/contracts`.
- Only current contract helper names are exported; unsupported versions are
  rejected instead of adapted.

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
      kindVersion: "0.1.0",
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

Package manifests use the same current contract surface:

```ts
import {
  defineExtensionPackage,
  defineNodeDefinition,
  definePort
} from "@skenion/sdk";

const value = defineNodeDefinition({
  id: "core.value",
  version: "0.1.0",
  displayName: "Value",
  category: "Core",
  ports: [
    definePort({
      id: "out",
      direction: "output",
      type: "number.float",
      rate: "control"
    })
  ],
  execution: { model: "value" }
});

const manifest = defineExtensionPackage({
  id: "skenion/core",
  version: "0.55.0",
  kind: "core-package",
  nodes: [value]
});
```

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

## Status

Bootstrap repository for the Skenion project. Implementation follows the public architecture and release rules defined in [EchoVisionLab/skenion](https://github.com/echovisionlab/skenion).

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If Skenion helps your artwork, research, publication, installation, or tool, please credit Skenion and EchoVisionLab.
