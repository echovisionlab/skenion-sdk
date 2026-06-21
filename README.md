# Skenion SDK

TypeScript SDK for Skenion node authoring, runtime connections, transport
lifecycle, command APIs, and capability negotiation.

The SDK is UI-framework agnostic and does not depend on React or Mantine.

## Initial Surface

The first SDK surface focuses on node and extension package manifests:

- `defineNode()` creates normalized v0.1 node definition manifests.
- `defineExtensionPackage()` creates normalized v0.1 extension package manifests.
- `t.*` builders create canonical `flow + dataKind + constraints` port types.
- Runtime client helpers construct default-session and explicit-session URLs,
  validate session info/events, track replay cursors, and summarize sidecar
  startup/health capability metadata.
- generated manifests are validated through `@skenion/contracts`.
- script lifecycle typing exposes only `onInit`, `onInput`, `onEvent`, and
  `onDispose`.

Canonical examples:

```ts
import { defineNode, t } from "@skenion/sdk";

const node = defineNode({
  id: "script.brightness",
  version: "0.1.0",
  displayName: "Brightness",
  category: "Script",
  ports: [
    {
      id: "enabled",
      direction: "input",
      type: t.value(t.bool()),
      activation: "latched",
      default: true
    },
    {
      id: "pulse",
      direction: "output",
      type: t.event(t.bang())
    }
  ],
  execution: {
    model: "script_control"
  },
  state: {
    persistent: true
  },
  capabilities: ["script.api.v0.1"],
  scriptApiVersion: "0.1.0"
});
```

Extension packages use a package directory with `skenion.extension.json` at the
root. First-party core packages and third-party packages use the same shape:

```ts
import { defineExtensionPackage, defineNode, t } from "@skenion/sdk";

const value = defineNode({
  id: "core.value",
  version: "0.1.0",
  displayName: "Value",
  category: "Core",
  ports: [{ id: "out", direction: "output", type: t.value(t.f32()) }],
  execution: { model: "value" }
});

const manifest = defineExtensionPackage({
  id: "skenion/core",
  version: "0.1.0",
  kind: "core-package",
  nodes: [value],
  help: [{ nodeId: "core.value", markdownPath: "help/value.md" }],
  tests: [
    {
      id: "value-baseline",
      kind: "node",
      target: "core.value",
      fixturePath: "tests/value.input.json",
      expectedPath: "tests/value.expected.json"
    }
  ]
});
```

`t.bool()` emits `dataKind: "boolean"`. GPU textures are resources:
`t.gpu.texture2d()` emits `flow: "resource"` and
`dataKind: "gpu.texture2d"`.

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

Skenion v0.1 does not define a separate `gpu` flow. GPU-backed values are
represented as resource-like typed handles.

For example, `t.gpu.texture2d()` emits:

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
