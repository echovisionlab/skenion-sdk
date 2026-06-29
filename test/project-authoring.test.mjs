import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionProjectAuthoringError,
  SkenionRuntimeCollaborationError,
  createDefaultViewStateForGraph,
  createGraphTargetRef,
  createRuntimeCollaborationCausalMetadata,
  createRuntimeCollaborationChangeSetOperation,
  defineGraphDocument,
  defineGraphNode,
  defineNodeDefinition,
  definePatchDefinition,
  definePatchLibrary,
  definePort,
  defineProjectDocument,
  derivePatchContract,
  deriveProjectPatchContracts,
  patchPath,
  readGraphDocument,
  readPatchDefinition,
  readProjectDocument
} from "../dist/index.js";

const valueOutPort = definePort({
  id: "out",
  direction: "output",
  type: "value.core.float32",
  rate: "control",
  accepts: ["value.core.float32"],
  fanOutPolicy: "allow",
  description: "Outputs the current value"
});

const valueInPort = definePort({
  id: "in",
  direction: "input",
  type: "value.core.float32",
  rate: "control",
  defaultValue: 0,
  required: true,
  mergePolicy: "latest",
  triggerMode: "latched",
  latch: true,
  group: "main",
  description: "Receives the incoming value"
});

const inletNode = defineGraphNode({
  id: "patch.inlet",
  kind: "object.core.inlet",
  params: {
    portId: "value",
    label: "Value"
  },
  ports: [valueOutPort]
});

const outletNode = defineGraphNode({
  id: "patch.outlet",
  kind: "object.core.outlet",
  kindVersion: "0.1.0",
  params: {
    portId: "scaled",
    label: "Scaled"
  },
  ports: [valueInPort],
  portGroups: [
    {
      id: "aux",
      direction: "input",
      type: "value.core.float32",
      minPorts: 0,
      maxPorts: 4,
      ordered: true,
      portIdPattern: "aux-{index}",
      createLabel: "Add input",
      defaultPortSpec: valueInPort
    }
  ]
});

const patchEdge = {
  id: "edge.patch.value",
  source: { nodeId: "patch.inlet", portId: "out" },
  target: { nodeId: "patch.outlet", portId: "in" },
  resolvedType: "value.core.float32",
  enabled: true
};

const rootFloatNode = defineGraphNode({
  id: "root.float",
  kind: "object.core.float",
  kindVersion: "0.1.0",
  params: {
    value: 0.5
  },
  ports: [valueOutPort]
});

test("current 0.1 helpers build graph, patch library, project, and patch contracts", () => {
  const emptyGraph = defineGraphDocument({
    id: "graph.empty",
    revision: "rev-empty"
  });
  const patchGraph = defineGraphDocument({
    id: "graph.patch.scale",
    revision: "rev-patch-1",
    nodes: [inletNode, outletNode],
    edges: [patchEdge]
  });
  const rootGraph = defineGraphDocument({
    id: "graph.root",
    revision: "rev-root-1",
    nodes: [rootFloatNode],
    edges: [],
    cableStyles: {
      numeric: {
        color: "#2f80ed",
        pattern: "solid",
        width: 2
      }
    }
  });
  const explicitPatchView = createDefaultViewStateForGraph(patchGraph);
  const patch = definePatchDefinition({
    id: "patch.scale",
    revision: "rev-patch-1",
    metadata: {
      title: "Scale",
      description: "Reusable scale patch"
    },
    graph: patchGraph,
    viewState: explicitPatchView
  });
  const patchWithDefaultView = definePatchDefinition({
    id: "patch.identity",
    revision: "rev-patch-2",
    graph: patchGraph
  });
  const library = definePatchLibrary([patch, patchWithDefaultView]);
  const project = defineProjectDocument({
    id: "project.current",
    documentId: "00000000-0000-4000-8000-000000000201",
    revision: "rev-project-1",
    metadata: {
      title: "Current 0.1 Project",
      updatedAt: "2026-06-22T00:00:00.000Z"
    },
    graph: rootGraph,
    viewState: createDefaultViewStateForGraph(rootGraph),
    patchLibrary: library,
    tutorial: {
      step: 1
    },
    help: {
      readonly: true
    }
  });

  assert.equal(emptyGraph.nodes.length, 0);
  assert.equal(readGraphDocument(rootGraph).schemaVersion, "0.1.0");
  assert.equal(readPatchDefinition(patch).viewState, explicitPatchView);
  assert.equal(patchWithDefaultView.viewState?.canvas.nodes["patch.inlet"].x, 96);
  assert.equal(project.documentId, "00000000-0000-4000-8000-000000000201");
  assert.equal(readProjectDocument(project).patchLibrary.length, 2);
  assert.equal(project.metadata?.title, "Current 0.1 Project");
  assert.equal(project.tutorial?.step, 1);
  assert.equal(project.help?.readonly, true);

  const contract = derivePatchContract(patch);
  assert.deepEqual(contract.ports.map((port) => `${port.direction}:${port.id}`), [
    "input:value",
    "output:scaled"
  ]);
  assert.deepEqual(deriveProjectPatchContracts(project).map((entry) => entry.id), [
    "patch.scale",
    "patch.identity"
  ]);
});

test("current 0.1 node-definition helper validates ports and strict versions", () => {
  const emptyGraphNode = defineGraphNode({
    id: "core.empty",
    kind: "core.empty"
  });
  const minimal = defineNodeDefinition({
    id: "object.core.float",
    version: "0.1.0",
    displayName: "Float",
    category: "Core",
    execution: {
      model: "control"
    }
  });
  const stateDefault = defineNodeDefinition({
    ...minimal,
    id: "core.state-default",
    state: {}
  });
  const full = defineNodeDefinition({
    id: "script.scale",
    version: "0.1.0",
    displayName: "Scale",
    category: "Script",
    ports: [valueInPort, valueOutPort],
    portGroups: [
      {
        id: "inputs",
        direction: "input",
        type: "value.core.float32",
        minPorts: 1,
        maxPorts: 8
      }
    ],
    execution: {
      model: "script_control",
      clock: "frame"
    },
    state: {
      persistent: true
    },
    permissions: [],
    capabilities: ["script.api.v0.1"],
    scriptApiVersion: "0.1.0",
    bundleHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    surface: {
      palette: "direct"
    }
  });

  assert.deepEqual(emptyGraphNode.ports, []);
  assert.equal(minimal.schemaVersion, "0.1.0");
  assert.equal(minimal.state.persistent, false);
  assert.equal(stateDefault.state.persistent, false);
  assert.equal(full.ports[0].type, "value.core.float32");
  assert.equal(full.portGroups?.[0].maxPorts, 8);
  assert.equal(full.surface?.palette, "direct");

  assert.throws(
    () =>
      defineNodeDefinition({
        ...full,
        ports: [valueInPort, { ...valueInPort }]
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineNodeDefinition({
        ...minimal,
        permissions: ["network"]
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineGraphNode({
        id: "core.old",
        kind: "core.old",
        kindVersion: "0.2.0"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineNodeDefinition({
        ...minimal,
        version: "0.2.0"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineNodeDefinition({
        ...minimal,
        scriptApiVersion: "0.2.0"
      }),
    SkenionProjectAuthoringError
  );
});

test("Runtime graph target helpers create current PatchPath targets and reject old target shapes", () => {
  const rootTarget = createGraphTargetRef({
    baseRevision: "rev-root-1"
  });
  const projectPatchTarget = createGraphTargetRef({
    path: patchPath.projectPatch("patch.scale"),
    baseRevision: "rev-patch-1",
    targetRevision: "rev-patch-2"
  });
  const packagePatch = patchPath.packagePatch({
    packageId: "skenion/core",
    patchId: "help.value"
  });
  const versionedPackagePatch = patchPath.packagePatch({
    packageId: "skenion/core",
    patchId: "help.scale",
    version: "0.55.0"
  });
  const embeddedPatch = patchPath.embeddedPatch({
    ownerPath: ["root"],
    nodeId: "subpatch-1"
  });
  const helpCopy = patchPath.helpWorkingCopy({
    workingCopyId: "help-copy-1",
    sourcePackageId: "skenion/core",
    sourcePatchId: "help.value"
  });
  const anonymousHelpCopy = patchPath.helpWorkingCopy({
    workingCopyId: "help-copy-2"
  });
  const causal = createRuntimeCollaborationCausalMetadata({
    baseRevision: "rev-patch-1",
    baseSequence: 2,
    participantId: "participant-a"
  });
  const operation = createRuntimeCollaborationChangeSetOperation({
    operationId: "op-change-patch",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    target: projectPatchTarget,
    changes: [
      {
        op: "node.add",
        changeId: "change-node-1",
        node: rootFloatNode
      }
    ],
    submittedAt: "2026-06-22T00:00:01.000Z"
  });

  assert.equal(rootTarget.path.kind, "root");
  assert.equal(patchPath.root().kind, "root");
  assert.equal(projectPatchTarget.targetRevision, "rev-patch-2");
  assert.equal(packagePatch.kind, "package-patch-definition");
  assert.equal("version" in packagePatch, false);
  assert.equal(versionedPackagePatch.version, "0.55.0");
  assert.equal(embeddedPatch.kind, "embedded-patch-instance");
  assert.equal(helpCopy.sourcePackageId, "skenion/core");
  assert.equal("sourcePackageId" in anonymousHelpCopy, false);
  assert.equal(operation.payload.target.path.kind, "project-patch-definition");

  assert.throws(
    () =>
      createGraphTargetRef({
        path: { graphId: "old.graph" },
        baseRevision: "rev-1"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      createGraphTargetRef({
        path: patchPath.projectPatch("patch.scale"),
        baseRevision: ""
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () => patchPath.projectPatch(""),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      createRuntimeCollaborationChangeSetOperation({
        operationId: "op-old-target",
        sessionId: "session-a",
        participantId: "participant-a",
        causal,
        target: { graphId: "old.graph", baseRevision: "rev-1" },
        changes: [],
        submittedAt: "2026-06-22T00:00:02.000Z"
      }),
    SkenionRuntimeCollaborationError
  );
});

test("current readers reject unsupported graph and project schema versions", () => {
  const graph = defineGraphDocument({
    id: "graph.valid",
    revision: "rev-valid",
    nodes: [rootFloatNode],
    edges: []
  });
  const project = defineProjectDocument({
    id: "project.valid",
    documentId: "00000000-0000-4000-8000-000000000202",
    revision: "rev-valid",
    graph
  });

  assert.throws(
    () => readGraphDocument({ ...graph, schemaVersion: "0.2.0" }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () => readProjectDocument({ ...project, schemaVersion: "0.2.0" }),
    SkenionProjectAuthoringError
  );
});

test("current helpers reject invalid graph, patch, project, and patch-library inputs", () => {
  const validGraph = defineGraphDocument({
    id: "graph.valid",
    revision: "rev-valid",
    nodes: [rootFloatNode],
    edges: []
  });
  const validProject = defineProjectDocument({
    id: "project.minimal",
    documentId: "00000000-0000-4000-8000-000000000203",
    revision: "rev-project-minimal",
    graph: validGraph
  });
  const patch = definePatchDefinition({
    id: "patch.valid",
    revision: "rev-patch-valid",
    graph: validGraph
  });

  assert.deepEqual(definePatchLibrary(), []);
  assert.equal(validProject.viewState.canvas.nodes["root.float"].x, 96);

  assert.throws(
    () =>
      definePort({
        id: "",
        direction: "input",
        type: "value.core.float32"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineGraphNode({
        id: "node.invalid",
        kind: "core.invalid",
        ports: [
          valueInPort,
          {
            ...valueInPort
          }
        ]
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineGraphDocument({
        id: "graph.invalid",
        revision: "rev-invalid",
        nodes: [rootFloatNode],
        edges: [
          {
            id: "edge.invalid",
            source: { nodeId: "missing", portId: "out" },
            target: { nodeId: "root.value", portId: "out" }
          }
        ]
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () => readPatchDefinition({ id: "patch.invalid" }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () => definePatchLibrary([patch, patch]),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineProjectDocument({
        id: "project.invalid",
        documentId: "00000000-0000-4000-8000-000000000204",
        revision: "rev-invalid",
        graph: validGraph,
        viewState: {
          schema: "skenion.view-state",
          schemaVersion: "0.1.0",
          canvas: {
            nodes: {
              missing: { x: 0, y: 0 }
            }
          }
        }
      }),
    SkenionProjectAuthoringError
  );
});
