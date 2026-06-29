import {
  createDefaultViewStateForGraph as createDefaultViewStateForGraphContract,
  derivePatchContractV01,
  derivePatchContractsV01,
  validateGraphDocument,
  validateNodeDefinition,
  validatePasteGraphFragmentRequest,
  validatePatchDefinitionV01,
  validateProjectDocument,
  validateProjectDocumentV01
} from "@skenion/contracts";
import type {
  CableStyleRegistryV01,
  EdgeSpecV01,
  GraphDocumentV01,
  GraphFragmentV01,
  GraphNodeV01,
  GraphTargetRef,
  NodeDefinitionManifestV01,
  NodeExecutionV01,
  NodeStateV01,
  NodeSurfaceV01,
  PatchContractV01,
  PatchDefinitionV01,
  PatchPath,
  PortGroupSpecV01,
  PortSpecV01,
  ProjectDocumentV01,
  ProjectMetadataV01,
  ValidationResult,
  ViewStateV01
} from "@skenion/contracts";

const CURRENT_SCHEMA_VERSION = "0.1.0";

export interface DefinePortOptions extends PortSpecV01 {}

export interface DefineGraphNodeOptions {
  id: string;
  kind: string;
  kindVersion?: string;
  params?: Record<string, unknown>;
  ports?: PortSpecV01[];
  portGroups?: PortGroupSpecV01[];
}

export interface DefineGraphDocumentOptions {
  id: string;
  revision: string;
  nodes?: GraphNodeV01[];
  edges?: EdgeSpecV01[];
  cableStyles?: CableStyleRegistryV01;
}

export interface DefinePatchDefinitionOptions {
  id: string;
  revision: string;
  graph: GraphDocumentV01;
  metadata?: ProjectMetadataV01;
  viewState?: ViewStateV01;
}

export interface DefineProjectDocumentOptions {
  id: string;
  documentId: string;
  revision: string;
  graph: GraphDocumentV01;
  metadata?: ProjectMetadataV01;
  viewState?: ViewStateV01;
  patchLibrary?: PatchDefinitionV01[];
  tutorial?: Record<string, unknown>;
  help?: Record<string, unknown>;
}

export interface DefineNodeDefinitionOptions {
  id: string;
  version: string;
  displayName: string;
  category: string;
  ports?: PortSpecV01[];
  portGroups?: PortGroupSpecV01[];
  execution: NodeExecutionV01;
  state?: Partial<NodeStateV01>;
  permissions?: string[];
  capabilities?: string[];
  scriptApiVersion?: string;
  bundleHash?: string;
  surface?: NodeSurfaceV01;
}

export interface CreateGraphTargetRefOptions {
  path?: PatchPath;
  baseRevision: string;
  targetRevision?: string;
}

export interface PackagePatchPathOptions {
  packageId: string;
  patchId: string;
  version?: string;
}

export interface EmbeddedPatchPathOptions {
  ownerPath: string[];
  nodeId: string;
}

export interface HelpWorkingCopyPathOptions {
  workingCopyId: string;
  sourcePackageId?: string;
  sourcePatchId?: string;
}

export class SkenionProjectAuthoringError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion 0.1 authoring value: ${errors.join("; ")}`);
    this.name = "SkenionProjectAuthoringError";
    this.errors = errors;
  }
}

function readAuthoringValidation<T>(validation: ValidationResult<T>): T {
  if (!validation.ok) {
    throw new SkenionProjectAuthoringError(validation.errors);
  }

  return validation.value;
}

function minimalGraphFragment(): GraphFragmentV01 {
  return {
    schema: "skenion.graph.fragment",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: [],
    edges: []
  };
}

function validatePatchPath(path: PatchPath): PatchPath {
  return createGraphTargetRef({
    path,
    baseRevision: "validation"
  }).path;
}

function requireCurrentVersion(field: string, value: string): void {
  if (value !== CURRENT_SCHEMA_VERSION) {
    throw new SkenionProjectAuthoringError([
      `${field} must be ${CURRENT_SCHEMA_VERSION}; received ${value}`
    ]);
  }
}

function validateNodePortsForAuthoring(node: GraphNodeV01): void {
  readAuthoringValidation(
    validateNodeDefinition({
      schema: "skenion.node.definition",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: node.id,
      version: node.kindVersion,
      displayName: node.kind,
      category: "Graph",
      ports: node.ports,
      ...(node.portGroups === undefined ? {} : { portGroups: node.portGroups }),
      execution: {
        model: "control"
      },
      state: {
        persistent: false
      },
      permissions: [],
      capabilities: []
    })
  );
}

export function definePort(options: DefinePortOptions): PortSpecV01 {
  const port: PortSpecV01 = {
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

export function defineGraphNode(options: DefineGraphNodeOptions): GraphNodeV01 {
  const kindVersion = options.kindVersion ?? CURRENT_SCHEMA_VERSION;
  requireCurrentVersion("kindVersion", kindVersion);

  const node: GraphNodeV01 = {
    id: options.id,
    kind: options.kind,
    kindVersion,
    params: { ...(options.params ?? {}) },
    ports: [...(options.ports ?? [])],
    ...(options.portGroups === undefined ? {} : { portGroups: [...options.portGroups] })
  };

  validateNodePortsForAuthoring(node);

  return node;
}

export function defineGraphDocument(options: DefineGraphDocumentOptions): GraphDocumentV01 {
  const graph: GraphDocumentV01 = {
    schema: "skenion.graph",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id,
    revision: options.revision,
    nodes: [...(options.nodes ?? [])],
    edges: [...(options.edges ?? [])],
    ...(options.cableStyles === undefined ? {} : { cableStyles: { ...options.cableStyles } })
  };

  return readGraphDocument(graph);
}

export function definePatchDefinition(options: DefinePatchDefinitionOptions): PatchDefinitionV01 {
  const patch: PatchDefinitionV01 = {
    id: options.id,
    revision: options.revision,
    graph: options.graph,
    viewState: options.viewState ?? createDefaultViewStateForGraph(options.graph),
    ...(options.metadata === undefined ? {} : { metadata: { ...options.metadata } })
  };

  return readPatchDefinition(patch);
}

export function definePatchLibrary(patches: PatchDefinitionV01[] = []): PatchDefinitionV01[] {
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

export function defineProjectDocument(options: DefineProjectDocumentOptions): ProjectDocumentV01 {
  const project: ProjectDocumentV01 = {
    schema: "skenion.project",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id,
    documentId: options.documentId,
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

export function defineNodeDefinition(options: DefineNodeDefinitionOptions): NodeDefinitionManifestV01 {
  requireCurrentVersion("version", options.version);
  if (options.scriptApiVersion !== undefined) {
    requireCurrentVersion("scriptApiVersion", options.scriptApiVersion);
  }

  const definition: NodeDefinitionManifestV01 = {
    schema: "skenion.node.definition",
    schemaVersion: CURRENT_SCHEMA_VERSION,
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

  return readAuthoringValidation(validateNodeDefinition(definition));
}

export function readGraphDocument(document: unknown): GraphDocumentV01 {
  return readAuthoringValidation(validateGraphDocument(document));
}

export function readPatchDefinition(document: unknown): PatchDefinitionV01 {
  return readAuthoringValidation(validatePatchDefinitionV01(document));
}

export function readProjectDocument(document: unknown): ProjectDocumentV01 {
  return readAuthoringValidation(validateProjectDocumentV01(document));
}

export function createDefaultViewStateForGraph(graph: GraphDocumentV01): ViewStateV01 {
  return createDefaultViewStateForGraphContract(graph);
}

export function derivePatchContract(patch: PatchDefinitionV01): PatchContractV01 {
  return derivePatchContractV01(readPatchDefinition(patch));
}

export function deriveProjectPatchContracts(project: ProjectDocumentV01): PatchContractV01[] {
  return derivePatchContractsV01(readProjectDocument(project));
}

export function createGraphTargetRef(options: CreateGraphTargetRefOptions): GraphTargetRef {
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
  packagePatch: (options: PackagePatchPathOptions): PatchPath =>
    validatePatchPath({
      kind: "package-patch-definition",
      packageId: options.packageId,
      patchId: options.patchId,
      ...(options.version === undefined ? {} : { version: options.version })
    }),
  embeddedPatch: (options: EmbeddedPatchPathOptions): PatchPath =>
    validatePatchPath({
      kind: "embedded-patch-instance",
      ownerPath: [...options.ownerPath],
      nodeId: options.nodeId
    }),
  helpWorkingCopy: (options: HelpWorkingCopyPathOptions): PatchPath =>
    validatePatchPath({
      kind: "help-working-copy",
      workingCopyId: options.workingCopyId,
      ...(options.sourcePackageId === undefined ? {} : { sourcePackageId: options.sourcePackageId }),
      ...(options.sourcePatchId === undefined ? {} : { sourcePatchId: options.sourcePatchId })
    })
} as const;
