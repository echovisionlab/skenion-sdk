import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionLegacyMigrationError,
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
  migrateLegacyGraphDocumentV01ToGraph,
  migrateLegacyProjectDocumentV01ToProject,
  patchPath,
  readGraphDocument,
  readLegacyGraphDocumentV01,
  readLegacyProjectDocumentV01,
  readPatchDefinition,
  readProjectDocument
} from "../dist/index.js";

const valueOutPort = definePort({
  id: "out",
  direction: "output",
  type: "number.float",
  rate: "control",
  accepts: ["number.float"],
  fanOutPolicy: "allow",
  description: "Outputs the current value"
});

const valueInPort = definePort({
  id: "in",
  direction: "input",
  type: "number.float",
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
  kind: "core.inlet",
  params: {
    portId: "value",
    label: "Value"
  },
  ports: [valueOutPort]
});

const outletNode = defineGraphNode({
  id: "patch.outlet",
  kind: "core.outlet",
  kindVersion: "0.2.0",
  params: {
    portId: "scaled",
    label: "Scaled"
  },
  ports: [valueInPort],
  portGroups: [
    {
      id: "aux",
      direction: "input",
      type: "number.float",
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
  resolvedType: "number.float",
  enabled: true
};

const rootValueNode = defineGraphNode({
  id: "root.value",
  kind: "core.value",
  kindVersion: "0.2.0",
  params: {
    value: 0.5
  },
  ports: [valueOutPort]
});

test("active v0.2 helpers build graph, patch library, project, and patch contracts", () => {
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
    nodes: [rootValueNode],
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
    id: "project.active",
    revision: "rev-project-1",
    metadata: {
      title: "Active v0.2 Project",
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
  assert.equal(readGraphDocument(rootGraph).schemaVersion, "0.2.0");
  assert.equal(readPatchDefinition(patch).viewState, explicitPatchView);
  assert.equal(patchWithDefaultView.viewState?.canvas.nodes["patch.inlet"].x, 96);
  assert.equal(readProjectDocument(project).patchLibrary.length, 2);
  assert.equal(project.metadata?.title, "Active v0.2 Project");
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

test("active v0.2 node-definition helper uses v0.2 ports and rejects invalid definitions", () => {
  const emptyGraphNode = defineGraphNode({
    id: "core.empty",
    kind: "core.empty"
  });
  const minimal = defineNodeDefinition({
    id: "core.value",
    version: "0.2.0",
    displayName: "Value",
    category: "Core",
    execution: {
      model: "value"
    }
  });
  const stateDefault = defineNodeDefinition({
    ...minimal,
    id: "core.state-default",
    state: {}
  });
  const full = defineNodeDefinition({
    id: "script.scale",
    version: "0.2.0",
    displayName: "Scale",
    category: "Script",
    ports: [valueInPort, valueOutPort],
    portGroups: [
      {
        id: "inputs",
        direction: "input",
        type: "number.float",
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
    capabilities: ["script.api.v0.2"],
    scriptApiVersion: "0.2.0",
    bundleHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    surface: {
      palette: "direct"
    }
  });

  assert.deepEqual(emptyGraphNode.ports, []);
  assert.equal(minimal.schemaVersion, "0.2.0");
  assert.equal(minimal.state.persistent, false);
  assert.equal(stateDefault.state.persistent, false);
  assert.equal(full.ports[0].type, "number.float");
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
});

test("Runtime graph target helpers create v0.2 PatchPath targets and reject legacy target shapes", () => {
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
    version: "0.38.0"
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
        node: rootValueNode
      }
    ],
    submittedAt: "2026-06-22T00:00:01.000Z"
  });

  assert.equal(rootTarget.path.kind, "root");
  assert.equal(patchPath.root().kind, "root");
  assert.equal(projectPatchTarget.targetRevision, "rev-patch-2");
  assert.equal(packagePatch.kind, "package-patch-definition");
  assert.equal("version" in packagePatch, false);
  assert.equal(versionedPackagePatch.version, "0.38.0");
  assert.equal(embeddedPatch.kind, "embedded-patch-instance");
  assert.equal(helpCopy.sourcePackageId, "skenion/core");
  assert.equal("sourcePackageId" in anonymousHelpCopy, false);
  assert.equal(operation.payload.target.path.kind, "project-patch-definition");

  assert.throws(
    () =>
      createGraphTargetRef({
        path: { graphId: "legacy.graph" },
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
        operationId: "op-legacy-target",
        sessionId: "session-a",
        participantId: "participant-a",
        causal,
        target: { graphId: "legacy.graph", baseRevision: "rev-1" },
        changes: [],
        submittedAt: "2026-06-22T00:00:02.000Z"
      }),
    SkenionRuntimeCollaborationError
  );
});

test("legacy v0.1 imports are migration-only and active readers reject them", () => {
  const legacyGraph = {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "legacy.graph",
    revision: "legacy-rev-1",
    nodes: [
      {
        id: "legacy.value",
        kind: "core.value",
        kindVersion: "0.1.0",
        params: {
          value: 1
        },
        ports: [
          {
            id: "out",
            direction: "output",
            label: "Value Out",
            default: {
              value: 1
            },
            required: false,
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          },
          {
            id: "event",
            direction: "output",
            type: {
              flow: "event",
              dataKind: "bang"
            }
          },
          {
            id: "signal",
            direction: "output",
            type: {
              flow: "signal",
              dataKind: "number.f32"
            }
          },
          {
            id: "stream",
            direction: "output",
            type: {
              flow: "stream",
              dataKind: "asset.video"
            }
          },
          {
            id: "gpu",
            direction: "output",
            type: {
              flow: "resource",
              dataKind: "gpu.texture2d"
            }
          },
          {
            id: "asset",
            direction: "output",
            type: {
              flow: "resource",
              dataKind: "asset.video"
            }
          }
        ]
      },
      {
        id: "legacy.sink",
        kind: "core.sink",
        kindVersion: "0.1.0",
        params: {},
        ports: [
          {
            id: "in",
            direction: "input",
            activation: "latched",
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          },
          {
            id: "bang",
            direction: "input",
            activation: "trigger",
            type: {
              flow: "event",
              dataKind: "bang"
            }
          }
        ]
      },
      {
        id: "legacy_value",
        kind: "core.value",
        kindVersion: "0.1.0",
        params: {},
        ports: [
          {
            id: "out",
            direction: "output",
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          }
        ]
      },
      {
        id: "legacy_sink",
        kind: "core.sink",
        kindVersion: "0.1.0",
        params: {},
        ports: [
          {
            id: "in",
            direction: "input",
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          }
        ]
      },
      {
        id: "!!!",
        kind: "core.slug-source",
        kindVersion: "0.1.0",
        params: {},
        ports: [
          {
            id: "###",
            direction: "output",
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          }
        ]
      },
      {
        id: "???",
        kind: "core.slug-target",
        kindVersion: "0.1.0",
        params: {},
        ports: [
          {
            id: "$$$",
            direction: "input",
            type: {
              flow: "value",
              dataKind: "number.f32"
            }
          }
        ]
      }
    ],
    edges: [
      {
        from: { node: "legacy.value", port: "out" },
        to: { node: "legacy.sink", port: "in" }
      },
      {
        from: { node: "legacy_value", port: "out" },
        to: { node: "legacy_sink", port: "in" }
      },
      {
        from: { node: "!!!", port: "###" },
        to: { node: "???", port: "$$$" }
      }
    ]
  };
  const legacyProject = {
    schema: "skenion.project",
    schemaVersion: "0.1.0",
    id: "legacy.project",
    revision: "legacy-rev-1",
    metadata: {
      title: "Legacy Project"
    },
    graph: legacyGraph,
    viewState: {
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        nodes: {
          "legacy.value": {
            x: 10,
            y: 20
          },
          "legacy.sink": {
            x: 120,
            y: 20
          },
          "legacy_value": {
            x: 10,
            y: 70
          },
          "legacy_sink": {
            x: 120,
            y: 70
          },
          "!!!": {
            x: 10,
            y: 120
          },
          "???": {
            x: 120,
            y: 120
          }
        },
        viewport: {
          x: 0,
          y: 0,
          zoom: 1
        }
      }
    },
    tutorial: {
      legacy: true
    },
    help: {
      markdownPath: "help/legacy.md"
    }
  };
  const migratedGraph = migrateLegacyGraphDocumentV01ToGraph(legacyGraph);
  const migratedProject = migrateLegacyProjectDocumentV01ToProject(legacyProject);
  const minimalMigratedProject = migrateLegacyProjectDocumentV01ToProject({
    schema: "skenion.project",
    schemaVersion: "0.1.0",
    id: "legacy.minimal",
    revision: "legacy-rev-minimal",
    graph: legacyGraph,
    viewState: legacyProject.viewState
  });
  const migratedValuePorts = Object.fromEntries(
    migratedGraph.nodes[0].ports.map((port) => [port.id, port])
  );
  const migratedSinkPorts = Object.fromEntries(
    migratedGraph.nodes[1].ports.map((port) => [port.id, port])
  );

  assert.equal(readLegacyGraphDocumentV01(legacyGraph).schemaVersion, "0.1.0");
  assert.equal(readLegacyProjectDocumentV01(legacyProject).schemaVersion, "0.1.0");
  assert.equal(migratedGraph.schemaVersion, "0.2.0");
  assert.equal(migratedValuePorts.out.type, "number.f32");
  assert.equal(migratedValuePorts.out.rate, "control");
  assert.equal(migratedValuePorts.out.label, "Value Out");
  assert.deepEqual(migratedValuePorts.out.defaultValue, { value: 1 });
  assert.equal(migratedValuePorts.out.required, false);
  assert.equal(migratedValuePorts.event.rate, "event");
  assert.equal(migratedValuePorts.signal.rate, "audio");
  assert.equal(migratedValuePorts.stream.rate, "render");
  assert.equal(migratedValuePorts.gpu.rate, "gpu");
  assert.equal(migratedValuePorts.asset.rate, "resource");
  assert.equal(migratedSinkPorts.in.triggerMode, "latched");
  assert.equal(migratedSinkPorts.bang.triggerMode, "trigger");
  assert.deepEqual(migratedGraph.edges.map((edge) => edge.id), [
    "edge_legacy_value_out_to_legacy_sink_in",
    "edge_legacy_value_out_to_legacy_sink_in_2",
    "edge_endpoint_endpoint_to_endpoint_endpoint"
  ]);
  assert.equal(migratedProject.schemaVersion, "0.2.0");
  assert.deepEqual(migratedProject.patchLibrary, []);
  assert.deepEqual(minimalMigratedProject.patchLibrary, []);
  assert.equal("metadata" in minimalMigratedProject, false);
  assert.equal(readProjectDocument(migratedProject).metadata?.title, "Legacy Project");

  assert.throws(
    () => readProjectDocument(legacyProject),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () => readLegacyProjectDocumentV01(migratedProject),
    SkenionLegacyMigrationError
  );
  assert.throws(
    () => readLegacyGraphDocumentV01({ ...legacyGraph, id: "" }),
    SkenionLegacyMigrationError
  );
  assert.throws(
    () => migrateLegacyProjectDocumentV01ToProject({ ...legacyProject, graph: { ...legacyGraph, id: "" } }),
    SkenionLegacyMigrationError
  );
});

test("active v0.2 helpers reject invalid graph, patch, project, and patch-library inputs", () => {
  const validGraph = defineGraphDocument({
    id: "graph.valid",
    revision: "rev-valid",
    nodes: [rootValueNode],
    edges: []
  });
  const validProject = defineProjectDocument({
    id: "project.minimal",
    revision: "rev-project-minimal",
    graph: validGraph
  });
  const patch = definePatchDefinition({
    id: "patch.valid",
    revision: "rev-patch-valid",
    graph: validGraph
  });

  assert.deepEqual(definePatchLibrary(), []);
  assert.equal(validProject.viewState.canvas.nodes["root.value"].x, 96);

  assert.throws(
    () =>
      definePort({
        id: "",
        direction: "input",
        type: "number.float"
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
        nodes: [rootValueNode],
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
