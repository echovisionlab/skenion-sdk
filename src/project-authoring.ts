import {
  createDefaultViewStateForGraph as createDefaultViewStateForGraphContract,
  derivePatchContractV02,
  derivePatchContractsV02,
  validateGraphDocument,
  validateGraphDocumentV02,
  validateNodeDefinitionV02,
  validatePasteGraphFragmentRequest,
  validatePatchDefinitionV02,
  validateProjectDocument,
  validateProjectDocumentV02
} from "@skenion/contracts";
import type {
  CableStyleRegistryV02,
  DataFlow,
  EdgeSpecV02,
  EdgeV01,
  GraphDocumentV01,
  GraphDocumentV02,
  GraphNodeV01,
  GraphFragmentV02,
  GraphNodeV02,
  GraphTargetRef,
  NodeDefinitionManifestV02,
  NodeExecutionV01,
  NodeStateV01,
  NodeSurfaceV01,
  PatchContractV02,
  PatchDefinitionV02,
  PatchPath,
  PortActivation,
  PortGroupSpecV02,
  PortRateV02,
  PortSpecV02,
  PortV01,
  ProjectDocumentV01,
  ProjectDocumentV02,
  ProjectMetadataV02,
  TriggerModeV02,
  ValidationResult,
  ViewStateV01
} from "@skenion/contracts";

export interface DefinePortOptionsV02 extends PortSpecV02 {}

export interface DefineGraphNodeOptionsV02 {
  id: string;
  kind: string;
  kindVersion?: string;
  params?: Record<string, unknown>;
  ports?: PortSpecV02[];
  portGroups?: PortGroupSpecV02[];
}

export interface DefineGraphDocumentOptionsV02 {
  id: string;
  revision: string;
  nodes?: GraphNodeV02[];
  edges?: EdgeSpecV02[];
  cableStyles?: CableStyleRegistryV02;
}

export interface DefinePatchDefinitionOptionsV02 {
  id: string;
  revision: string;
  graph: GraphDocumentV02;
  metadata?: ProjectMetadataV02;
  viewState?: ViewStateV01;
}

export interface DefineProjectDocumentOptionsV02 {
  id: string;
  revision: string;
  graph: GraphDocumentV02;
  metadata?: ProjectMetadataV02;
  viewState?: ViewStateV01;
  patchLibrary?: PatchDefinitionV02[];
  tutorial?: Record<string, unknown>;
  help?: Record<string, unknown>;
}

export interface DefineNodeDefinitionOptionsV02 {
  id: string;
  version: string;
  displayName: string;
  category: string;
  ports?: PortSpecV02[];
  portGroups?: PortGroupSpecV02[];
  execution: NodeExecutionV01;
  state?: Partial<NodeStateV01>;
  permissions?: string[];
  capabilities?: string[];
  scriptApiVersion?: string;
  bundleHash?: string;
  surface?: NodeSurfaceV01;
}

export interface CreateGraphTargetRefOptionsV02 {
  path?: PatchPath;
  baseRevision: string;
  targetRevision?: string;
}

export interface PackagePatchPathOptionsV02 {
  packageId: string;
  patchId: string;
  version?: string;
}

export interface EmbeddedPatchPathOptionsV02 {
  ownerPath: string[];
  nodeId: string;
}

export interface HelpWorkingCopyPathOptionsV02 {
  workingCopyId: string;
  sourcePackageId?: string;
  sourcePatchId?: string;
}

export class SkenionProjectAuthoringError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion v0.2 authoring value: ${errors.join("; ")}`);
    this.name = "SkenionProjectAuthoringError";
    this.errors = errors;
  }
}

export class SkenionLegacyMigrationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid legacy Skenion v0.1 import value: ${errors.join("; ")}`);
    this.name = "SkenionLegacyMigrationError";
    this.errors = errors;
  }
}

function readAuthoringValidation<T>(validation: ValidationResult<T>): T {
  if (!validation.ok) {
    throw new SkenionProjectAuthoringError(validation.errors);
  }

  return validation.value;
}

function readLegacyValidation<T>(validation: ValidationResult<T>): T {
  if (!validation.ok) {
    throw new SkenionLegacyMigrationError(validation.errors);
  }

  return validation.value;
}

function minimalGraphFragment(): GraphFragmentV02 {
  return {
    schema: "skenion.graph.fragment",
    schemaVersion: "0.2.0",
    nodes: [],
    edges: []
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validatePatchPath(path: PatchPath): PatchPath {
  return createGraphTargetRef({
    path,
    baseRevision: "validation"
  }).path;
}

function v02RateForLegacyFlow(flow: DataFlow, dataKind: string): PortRateV02 {
  if (flow === "event") {
    return "event";
  }
  if (flow === "signal") {
    return "audio";
  }
  if (flow === "stream") {
    return "render";
  }
  if (flow === "resource" && dataKind.startsWith("gpu.")) {
    return "gpu";
  }
  if (flow === "resource") {
    return "resource";
  }
  return "control";
}

function v02TriggerModeForLegacyActivation(activation?: PortActivation): TriggerModeV02 | undefined {
  if (activation === "trigger") {
    return "trigger";
  }
  if (activation === "latched") {
    return "latched";
  }
  return undefined;
}

function migrateLegacyPortToV02(port: PortV01): PortSpecV02 {
  const nextPort: PortSpecV02 = {
    id: port.id,
    direction: port.direction,
    type: port.type.dataKind,
    rate: v02RateForLegacyFlow(port.type.flow, port.type.dataKind)
  };

  if (port.label !== undefined) {
    nextPort.label = port.label;
  }
  if (port.default !== undefined) {
    nextPort.defaultValue = cloneJson(port.default);
  }
  if (port.required !== undefined) {
    nextPort.required = port.required;
  }
  const triggerMode = v02TriggerModeForLegacyActivation(port.activation);
  if (triggerMode !== undefined) {
    nextPort.triggerMode = triggerMode;
  }

  return nextPort;
}

function migrateLegacyNodeToV02(node: GraphNodeV01): GraphNodeV02 {
  return {
    id: node.id,
    kind: node.kind,
    kindVersion: node.kindVersion,
    params: cloneJson(node.params),
    ports: node.ports.map(migrateLegacyPortToV02)
  };
}

function slugId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "endpoint";
}

function legacyEdgeId(edge: EdgeV01, index: number, usedIds: Set<string>): string {
  const base = [
    "edge",
    slugId(edge.from.node),
    slugId(edge.from.port),
    "to",
    slugId(edge.to.node),
    slugId(edge.to.port)
  ].join("_");
  let candidate = base;
  let suffix = index + 1;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function migrateLegacyEdgeToV02(edge: EdgeV01, index: number, usedIds: Set<string>): EdgeSpecV02 {
  return {
    id: legacyEdgeId(edge, index, usedIds),
    source: {
      nodeId: edge.from.node,
      portId: edge.from.port
    },
    target: {
      nodeId: edge.to.node,
      portId: edge.to.port
    }
  };
}

function migrateLegacyGraphDocumentToV02(graph: GraphDocumentV01): GraphDocumentV02 {
  const usedEdgeIds = new Set<string>();

  return {
    schema: "skenion.graph",
    schemaVersion: "0.2.0",
    id: graph.id,
    revision: graph.revision,
    nodes: graph.nodes.map(migrateLegacyNodeToV02),
    edges: graph.edges.map((edge, index) => migrateLegacyEdgeToV02(edge, index, usedEdgeIds))
  };
}

function migrateLegacyProjectDocumentToV02(project: ProjectDocumentV01): ProjectDocumentV02 {
  const nextProject: ProjectDocumentV02 = {
    schema: "skenion.project",
    schemaVersion: "0.2.0",
    id: project.id,
    revision: project.revision,
    graph: migrateLegacyGraphDocumentToV02(project.graph),
    viewState: cloneJson(project.viewState),
    patchLibrary: []
  };

  if (project.metadata !== undefined) {
    nextProject.metadata = cloneJson(project.metadata);
  }
  if (project.tutorial !== undefined) {
    nextProject.tutorial = cloneJson(project.tutorial);
  }
  if (project.help !== undefined) {
    nextProject.help = cloneJson(project.help);
  }

  return nextProject;
}

function validateNodePortsForAuthoring(node: GraphNodeV02): void {
  readAuthoringValidation(
    validateNodeDefinitionV02({
      schema: "skenion.node.definition",
      schemaVersion: "0.2.0",
      id: node.id,
      version: node.kindVersion,
      displayName: node.kind,
      category: "Graph",
      ports: node.ports,
      ...(node.portGroups === undefined ? {} : { portGroups: node.portGroups }),
      execution: {
        model: "value"
      },
      state: {
        persistent: false
      },
      permissions: [],
      capabilities: []
    })
  );
}

export function definePort(options: DefinePortOptionsV02): PortSpecV02 {
  const port: PortSpecV02 = {
    ...options,
    ...(options.accepts === undefined ? {} : { accepts: [...options.accepts] })
  };

  defineGraphNode({
    id: "validation.port",
    kind: "validation.port",
    ports: [port]
  });

  return port;
}

export function defineGraphNode(options: DefineGraphNodeOptionsV02): GraphNodeV02 {
  const node: GraphNodeV02 = {
    id: options.id,
    kind: options.kind,
    kindVersion: options.kindVersion ?? "0.2.0",
    params: { ...(options.params ?? {}) },
    ports: [...(options.ports ?? [])],
    ...(options.portGroups === undefined ? {} : { portGroups: [...options.portGroups] })
  };

  validateNodePortsForAuthoring(node);

  return node;
}

export function defineGraphDocument(options: DefineGraphDocumentOptionsV02): GraphDocumentV02 {
  const graph: GraphDocumentV02 = {
    schema: "skenion.graph",
    schemaVersion: "0.2.0",
    id: options.id,
    revision: options.revision,
    nodes: [...(options.nodes ?? [])],
    edges: [...(options.edges ?? [])],
    ...(options.cableStyles === undefined ? {} : { cableStyles: { ...options.cableStyles } })
  };

  return readGraphDocument(graph);
}

export function definePatchDefinition(options: DefinePatchDefinitionOptionsV02): PatchDefinitionV02 {
  const patch: PatchDefinitionV02 = {
    id: options.id,
    revision: options.revision,
    graph: options.graph,
    viewState: options.viewState ?? createDefaultViewStateForGraph(options.graph),
    ...(options.metadata === undefined ? {} : { metadata: { ...options.metadata } })
  };

  return readPatchDefinition(patch);
}

export function definePatchLibrary(patches: PatchDefinitionV02[] = []): PatchDefinitionV02[] {
  const library = patches.map((patch) => readPatchDefinition(patch));
  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const patch of library) {
    if (seen.has(patch.id)) {
      duplicateIds.push(patch.id);
    }
    seen.add(patch.id);
  }

  if (duplicateIds.length > 0) {
    throw new SkenionProjectAuthoringError(
      duplicateIds.map((patchId) => `duplicate patch id: ${patchId}`)
    );
  }

  return library;
}

export function defineProjectDocument(options: DefineProjectDocumentOptionsV02): ProjectDocumentV02 {
  const project: ProjectDocumentV02 = {
    schema: "skenion.project",
    schemaVersion: "0.2.0",
    id: options.id,
    revision: options.revision,
    graph: options.graph,
    viewState: options.viewState ?? createDefaultViewStateForGraph(options.graph),
    patchLibrary: definePatchLibrary(options.patchLibrary ?? []),
    ...(options.metadata === undefined ? {} : { metadata: { ...options.metadata } }),
    ...(options.tutorial === undefined ? {} : { tutorial: { ...options.tutorial } }),
    ...(options.help === undefined ? {} : { help: { ...options.help } })
  };

  return readProjectDocument(project);
}

export function defineNodeDefinition(options: DefineNodeDefinitionOptionsV02): NodeDefinitionManifestV02 {
  const definition: NodeDefinitionManifestV02 = {
    schema: "skenion.node.definition",
    schemaVersion: "0.2.0",
    id: options.id,
    version: options.version,
    displayName: options.displayName,
    category: options.category,
    ports: [...(options.ports ?? [])],
    execution: { ...options.execution },
    state: {
      persistent: options.state?.persistent ?? false
    },
    permissions: [...(options.permissions ?? [])],
    capabilities: [...(options.capabilities ?? [])],
    ...(options.portGroups === undefined ? {} : { portGroups: [...options.portGroups] }),
    ...(options.scriptApiVersion === undefined ? {} : { scriptApiVersion: options.scriptApiVersion }),
    ...(options.bundleHash === undefined ? {} : { bundleHash: options.bundleHash }),
    ...(options.surface === undefined ? {} : { surface: { ...options.surface } })
  };

  return readAuthoringValidation(validateNodeDefinitionV02(definition));
}

export function readGraphDocument(document: unknown): GraphDocumentV02 {
  return readAuthoringValidation(validateGraphDocumentV02(document));
}

export function readPatchDefinition(document: unknown): PatchDefinitionV02 {
  return readAuthoringValidation(validatePatchDefinitionV02(document));
}

export function readProjectDocument(document: unknown): ProjectDocumentV02 {
  return readAuthoringValidation(validateProjectDocumentV02(document));
}

export function createDefaultViewStateForGraph(graph: GraphDocumentV02): ViewStateV01 {
  return createDefaultViewStateForGraphContract(graph);
}

export function derivePatchContract(patch: PatchDefinitionV02): PatchContractV02 {
  return derivePatchContractV02(readPatchDefinition(patch));
}

export function deriveProjectPatchContracts(project: ProjectDocumentV02): PatchContractV02[] {
  return derivePatchContractsV02(readProjectDocument(project));
}

export function createGraphTargetRef(options: CreateGraphTargetRefOptionsV02): GraphTargetRef {
  const target: GraphTargetRef = {
    path: options.path ?? { kind: "root" },
    baseRevision: options.baseRevision,
    ...(options.targetRevision === undefined ? {} : { targetRevision: options.targetRevision })
  };
  const validation = validatePasteGraphFragmentRequest({
    target,
    fragment: minimalGraphFragment()
  });

  if (!validation.ok) {
    throw new SkenionProjectAuthoringError(validation.errors);
  }

  return validation.value.target;
}

export const patchPath = {
  root: (): PatchPath => validatePatchPath({ kind: "root" }),
  projectPatch: (patchId: string): PatchPath =>
    validatePatchPath({ kind: "project-patch-definition", patchId }),
  packagePatch: (options: PackagePatchPathOptionsV02): PatchPath =>
    validatePatchPath({
      kind: "package-patch-definition",
      packageId: options.packageId,
      patchId: options.patchId,
      ...(options.version === undefined ? {} : { version: options.version })
    }),
  embeddedPatch: (options: EmbeddedPatchPathOptionsV02): PatchPath =>
    validatePatchPath({
      kind: "embedded-patch-instance",
      ownerPath: [...options.ownerPath],
      nodeId: options.nodeId
    }),
  helpWorkingCopy: (options: HelpWorkingCopyPathOptionsV02): PatchPath =>
    validatePatchPath({
      kind: "help-working-copy",
      workingCopyId: options.workingCopyId,
      ...(options.sourcePackageId === undefined ? {} : { sourcePackageId: options.sourcePackageId }),
      ...(options.sourcePatchId === undefined ? {} : { sourcePatchId: options.sourcePatchId })
    })
} as const;

export function readLegacyGraphDocumentV01(document: unknown): GraphDocumentV01 {
  return readLegacyValidation(validateGraphDocument(document));
}

export function readLegacyProjectDocumentV01(document: unknown): ProjectDocumentV01 {
  return readLegacyValidation(validateProjectDocument(document));
}

export function migrateLegacyGraphDocumentV01ToGraph(document: unknown): GraphDocumentV02 {
  return readGraphDocument(migrateLegacyGraphDocumentToV02(readLegacyGraphDocumentV01(document)));
}

export function migrateLegacyProjectDocumentV01ToProject(document: unknown): ProjectDocumentV02 {
  return readProjectDocument(migrateLegacyProjectDocumentToV02(readLegacyProjectDocumentV01(document)));
}
