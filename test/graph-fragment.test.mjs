import assert from "node:assert/strict";
import test from "node:test";
import {
  SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE,
  SkenionGraphFragmentError,
  SkenionPasteRequestError,
  SkenionPasteResponseError,
  analyzeGraphFragment,
  createGraphFragment,
  createGraphFragmentFromSelection,
  createPasteGraphFragmentOperation,
  createPasteGraphFragmentRequest,
  parseGraphFragmentClipboard,
  readPasteGraphFragmentResponse,
  serializeGraphFragmentClipboard,
  validateGraphFragment,
  withGraphFragmentSourceMetadata
} from "../dist/index.js";

function node(id, portId, direction) {
  return {
    id,
    kind: "core.value",
    kindVersion: "0.1.0",
    params: {},
    ports: [
      {
        id: portId,
        direction,
        type: "number.float"
      }
    ]
  };
}

const sourceNode = node("source", "out", "output");
const middleNode = {
  id: "middle",
  kind: "core.scale",
  kindVersion: "0.1.0",
  params: {},
  ports: [
    {
      id: "in",
      direction: "input",
      type: "number.float"
    },
    {
      id: "out",
      direction: "output",
      type: "number.float"
    }
  ]
};
const targetNode = node("target", "in", "input");

const internalEdge = {
  id: "edge.internal",
  source: { nodeId: "source", portId: "out" },
  target: { nodeId: "middle", portId: "in" }
};
const externalEdge = {
  id: "edge.external",
  source: { nodeId: "middle", portId: "out" },
  target: { nodeId: "target", portId: "in" }
};

const graph = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "graph.main",
  revision: "rev-1",
  nodes: [sourceNode, middleNode, targetNode],
  edges: [internalEdge, externalEdge]
};

const viewState = {
  schema: "skenion.view-state",
  schemaVersion: "0.1.0",
  canvas: {
    nodes: {
      source: { x: 10, y: 20 },
      middle: { x: 80, y: 20 },
      target: { x: 160, y: 20 }
    }
  }
};

const target = {
  path: { kind: "root" },
  baseRevision: "rev-1"
};

test("createGraphFragmentFromSelection preserves internal edges and omits outside endpoints", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    id: "fragment.one",
    selectedNodeIds: ["source", "middle"],
    viewState,
    metadata: {
      label: "copy"
    },
    outsideEndpointPolicy: "omit"
  });

  assert.equal(fragment.schema, "skenion.graph.fragment");
  assert.deepEqual(fragment.nodes.map((entry) => entry.id), ["source", "middle"]);
  assert.deepEqual(fragment.edges.map((entry) => entry.id), ["edge.internal"]);
  assert.deepEqual(fragment.omittedEdges?.map((entry) => entry.id), ["edge.external"]);
  assert.equal(fragment.omittedEdges?.[0].reason, "outside-fragment");
  assert.deepEqual(Object.keys(fragment.view?.nodes ?? {}).sort(), ["middle", "source"]);
  assert.equal(fragment.metadata?.label, "copy");
});

test("createGraphFragment rejects outside endpoints by default", () => {
  assert.throws(
    () =>
      createGraphFragment({
        nodes: [middleNode],
        edges: [externalEdge]
      }),
    SkenionGraphFragmentError
  );
});

test("createGraphFragment records omitted outside edges when requested", () => {
  const fragment = createGraphFragment({
    nodes: [middleNode],
    edges: [externalEdge],
    omittedEdges: [
      {
        id: "edge.previous",
        source: { nodeId: "outside", portId: "out" },
        target: { nodeId: "middle", portId: "in" },
        reason: "policy-omit"
      }
    ],
    outsideEndpointPolicy: "omit"
  });

  assert.deepEqual(fragment.edges, []);
  assert.deepEqual(fragment.omittedEdges?.map((entry) => entry.id), ["edge.previous", "edge.external"]);

  const freshOmit = createGraphFragment({
    nodes: [middleNode],
    edges: [externalEdge],
    outsideEndpointPolicy: "omit"
  });

  assert.deepEqual(freshOmit.omittedEdges?.map((entry) => entry.id), ["edge.external"]);
});

test("createGraphFragment supports source-only metadata and validates clean fragments", () => {
  const fragment = createGraphFragment({
    id: "fragment.clean",
    nodes: [sourceNode],
    sourceMetadata: {
      path: {
        kind: "project-patch-definition",
        patchId: "project.patch"
      }
    }
  });

  assert.equal(fragment.metadata?.source.path.kind, "project-patch-definition");
  assert.equal(validateGraphFragment(fragment).id, "fragment.clean");
});

test("createGraphFragmentFromSelection rejects outside endpoints by default", () => {
  assert.throws(
    () =>
      createGraphFragmentFromSelection(graph, {
        selectedNodeIds: ["source", "middle"]
      }),
    SkenionGraphFragmentError
  );
});

test("createGraphFragmentFromSelection handles selections without view entries", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    selectedNodeIds: ["source"],
    viewState: {
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        nodes: {
          target: { x: 1, y: 2 }
        }
      }
    },
    outsideEndpointPolicy: "omit"
  });

  assert.equal(fragment.view, undefined);
  assert.deepEqual(fragment.edges, []);
});

test("source metadata helpers preserve patch-library and help source identity", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    selectedNodeIds: ["source", "middle"],
    outsideEndpointPolicy: "omit",
    metadata: {
      help: {
        readonly: true
      }
    },
    sourceMetadata: {
      path: {
        kind: "help-working-copy",
        workingCopyId: "help-copy-1",
        sourcePackageId: "skenion/core",
        sourcePatchId: "help.core.value"
      },
      immutable: true
    }
  });

  const updated = withGraphFragmentSourceMetadata(fragment, {
    path: {
      kind: "package-patch-definition",
      packageId: "skenion/core",
      patchId: "examples.scale",
      version: "0.37.0"
    },
    immutable: false
  });

  assert.deepEqual(fragment.metadata?.help, { readonly: true });
  assert.equal(fragment.metadata?.source.immutable, true);
  assert.equal(fragment.metadata?.source.path.kind, "help-working-copy");
  assert.deepEqual(updated.metadata?.help, { readonly: true });
  assert.equal(updated.metadata?.source.path.kind, "package-patch-definition");
});

test("graph fragment clipboard helpers round trip envelopes and raw fragments", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    selectedNodeIds: ["source", "middle"],
    outsideEndpointPolicy: "omit"
  });
  const text = serializeGraphFragmentClipboard(fragment);
  const envelope = JSON.parse(text);

  assert.equal(envelope.type, SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE);
  assert.equal(parseGraphFragmentClipboard(text)?.edges[0]?.id, "edge.internal");
  assert.equal(parseGraphFragmentClipboard(JSON.stringify(fragment))?.nodes[0]?.id, "source");
  assert.equal(
    parseGraphFragmentClipboard(JSON.stringify({ type: "application/vnd.example.other+json", fragment })),
    null
  );
  assert.equal(parseGraphFragmentClipboard("null"), null);
  assert.equal(parseGraphFragmentClipboard("{"), null);
});

test("paste request and session operation omit attribution by default", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    selectedNodeIds: ["source", "middle"],
    outsideEndpointPolicy: "omit"
  });
  const request = createPasteGraphFragmentRequest({
    target,
    fragment,
    placement: {
      kind: "position",
      x: 320,
      y: 240
    },
    options: {
      outsideEndpointPolicy: "omit",
      idConflictPolicy: "remap",
      preserveRelativePositions: true
    }
  });
  const operation = createPasteGraphFragmentOperation({
    id: "op.paste.1",
    request,
    correlationId: "corr-1",
    createdAt: "2026-06-22T00:00:00.000Z"
  });

  assert.equal("actorId" in request, false);
  assert.equal("clientId" in request, false);
  assert.equal("attribution" in operation, false);
  assert.equal(operation.kind, "pasteGraphFragment");
  assert.equal(operation.request.target.baseRevision, "rev-1");
});

test("paste session operation supports optional contract attribution", () => {
  const fragment = createGraphFragmentFromSelection(graph, {
    selectedNodeIds: ["source", "middle"],
    outsideEndpointPolicy: "omit"
  });
  const request = createPasteGraphFragmentRequest({
    target,
    fragment,
    placement: {
      kind: "position",
      x: 320,
      y: 240
    }
  });
  const operation = createPasteGraphFragmentOperation({
    id: "op.paste.attributed",
    request,
    attribution: {
      actorId: "participant-a",
      clientId: "window-a",
      label: "paste from help"
    }
  });

  assert.deepEqual(operation.attribution, {
    actorId: "participant-a",
    clientId: "window-a",
    label: "paste from help"
  });
  assert.equal(operation.kind, "pasteGraphFragment");
});

test("paste helpers support minimal valid request and operation envelopes", () => {
  const fragment = createGraphFragment({
    nodes: [sourceNode],
    edges: []
  });
  const request = createPasteGraphFragmentRequest({
    target,
    fragment
  });
  const operation = createPasteGraphFragmentOperation({
    id: "op.paste.minimal",
    request
  });

  assert.equal("placement" in request, false);
  assert.equal("options" in request, false);
  assert.equal("correlationId" in operation, false);
  assert.equal("createdAt" in operation, false);
});

test("runtime paste response summary exposes id remap and revision information", () => {
  const summary = readPasteGraphFragmentResponse({
    schema: "skenion.runtime.paste-graph-fragment.response",
    schemaVersion: "0.1.0",
    ok: true,
    applied: true,
    conflict: false,
    target,
    revisionBefore: "rev-1",
    revisionAfter: "rev-2",
    historyEntryId: "history-1",
    idRemap: {
      nodeIdMap: {
        source: "source-2"
      },
      edgeIdMap: {
        "edge.internal": "edge.internal-2"
      },
      omittedEdgeIds: ["edge.external"]
    },
    diagnostics: []
  });

  assert.equal(summary.revisionBefore, "rev-1");
  assert.equal(summary.revisionAfter, "rev-2");
  assert.equal(summary.mapNodeId("source"), "source-2");
  assert.equal(summary.mapNodeId("middle"), "middle");
  assert.equal(summary.mapEdgeId("edge.internal"), "edge.internal-2");
  assert.equal(summary.mapEdgeId("edge.unknown"), "edge.unknown");
  assert.equal(summary.idRemap.omittedEdgeIds[0], "edge.external");
});

test("invalid fragments, requests, and responses are rejected", () => {
  assert.throws(
    () =>
      validateGraphFragment({
        schema: "skenion.graph.fragment",
        schemaVersion: "0.2.0",
        nodes: [sourceNode, sourceNode],
        edges: []
      }),
    SkenionGraphFragmentError
  );

  const fragment = createGraphFragment({
    nodes: [sourceNode],
    edges: []
  });
  assert.throws(
    () =>
      createPasteGraphFragmentRequest({
        target: {
          path: { kind: "root" },
          baseRevision: ""
        },
        fragment
      }),
    SkenionPasteRequestError
  );

  assert.throws(
    () =>
      readPasteGraphFragmentResponse({
        schema: "skenion.runtime.paste-graph-fragment.response",
        schemaVersion: "0.1.0",
        ok: true
      }),
    SkenionPasteResponseError
  );

  assert.throws(
    () =>
      createPasteGraphFragmentOperation({
        id: "op.invalid",
        request: {
          target: {
            path: { kind: "root" },
            baseRevision: ""
          },
          fragment
        }
      }),
    SkenionPasteRequestError
  );

  assert.throws(
    () =>
      withGraphFragmentSourceMetadata(
        {
          ...fragment,
          nodes: [sourceNode, sourceNode]
        },
        { immutable: true }
      ),
    SkenionGraphFragmentError
  );
});

test("analyzeGraphFragment returns diagnostics without throwing", () => {
  const result = analyzeGraphFragment(
    {
      schema: "skenion.graph.fragment",
      schemaVersion: "0.1.0",
      nodes: [middleNode],
      edges: [externalEdge]
    },
    { outsideEndpointPolicy: "omit" }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.omittedEdgeIds, ["edge.external"]);
  assert.equal(result.diagnostics[0].severity, "warning");
});
