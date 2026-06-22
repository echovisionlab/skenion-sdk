import {
  analyzeGraphFragmentV01,
  validateGraphFragmentV01,
  validatePasteGraphFragmentRequest,
  validatePasteGraphFragmentResponse,
  validateRuntimeOperationEnvelope
} from "@skenion/contracts";
import type {
  EdgeSpecV01,
  GraphDocumentV01,
  GraphFragmentOmittedEdgeV01,
  GraphFragmentOutsideEndpointPolicyV01,
  GraphFragmentV01,
  GraphFragmentValidationOptionsV01,
  GraphFragmentValidationResultV01,
  GraphFragmentViewV01,
  GraphNodeV01,
  GraphTargetRef,
  IdRemapResult,
  PasteGraphFragmentOptions,
  PasteGraphFragmentRequest,
  PasteGraphFragmentResponse,
  PastePlacement,
  RuntimeOperationAttribution,
  RuntimeOperationEnvelope,
  ViewStateV01
} from "@skenion/contracts";

const CURRENT_SCHEMA_VERSION = "0.1.0";

export interface CreateGraphFragmentOptions {
  id?: string;
  nodes: GraphNodeV01[];
  edges?: EdgeSpecV01[];
  view?: GraphFragmentViewV01;
  omittedEdges?: GraphFragmentOmittedEdgeV01[];
  metadata?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
  outsideEndpointPolicy?: GraphFragmentOutsideEndpointPolicyV01;
}

export interface GraphFragmentSelectionOptions {
  id?: string;
  selectedNodeIds: string[];
  viewState?: ViewStateV01;
  metadata?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
  outsideEndpointPolicy?: GraphFragmentOutsideEndpointPolicyV01;
}

export interface CreatePasteGraphFragmentRequestOptions {
  target: GraphTargetRef;
  fragment: GraphFragmentV01;
  placement?: PastePlacement;
  options?: PasteGraphFragmentOptions;
}

export interface CreatePasteGraphFragmentOperationOptions {
  id: string;
  request: PasteGraphFragmentRequest;
  attribution?: RuntimeOperationAttribution;
  correlationId?: string;
  createdAt?: string;
}

export interface PasteGraphFragmentResponseSummary {
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  target: GraphTargetRef;
  revisionBefore: string;
  revisionAfter: string | null;
  historyEntryId: string | null;
  idRemap: IdRemapResult;
  diagnostics: PasteGraphFragmentResponse["diagnostics"];
  mapNodeId(id: string): string;
  mapEdgeId(id: string): string;
}

export class SkenionGraphFragmentError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion graph fragment: ${errors.join("; ")}`);
    this.name = "SkenionGraphFragmentError";
    this.errors = errors;
  }
}

export class SkenionPasteRequestError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion paste request: ${errors.join("; ")}`);
    this.name = "SkenionPasteRequestError";
    this.errors = errors;
  }
}

export class SkenionPasteResponseError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion paste response: ${errors.join("; ")}`);
    this.name = "SkenionPasteResponseError";
    this.errors = errors;
  }
}

function mergeMetadata(
  metadata: Record<string, unknown> | undefined,
  sourceMetadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata && !sourceMetadata) {
    return undefined;
  }

  return {
    ...(metadata ?? {}),
    ...(sourceMetadata === undefined
      ? {}
      : { source: { ...sourceRecord(metadata?.source), ...sourceMetadata } })
  };
}

function sourceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nodeIdSet(nodes: GraphNodeV01[]): Set<string> {
  return new Set(nodes.map((node) => node.id));
}

function edgeIsInternal(edge: EdgeSpecV01, selectedNodeIds: Set<string>): boolean {
  return selectedNodeIds.has(edge.source.nodeId) && selectedNodeIds.has(edge.target.nodeId);
}

function omittedEdge(edge: EdgeSpecV01, reason: GraphFragmentOmittedEdgeV01["reason"]): GraphFragmentOmittedEdgeV01 {
  return {
    id: edge.id,
    source: { ...edge.source },
    target: { ...edge.target },
    reason
  };
}

function normalizeExternalEdges(
  fragment: GraphFragmentV01,
  outsideEndpointPolicy: GraphFragmentOutsideEndpointPolicyV01
): GraphFragmentV01 {
  const selectedNodeIds = nodeIdSet(fragment.nodes);
  const internalEdges: EdgeSpecV01[] = [];
  const externalEdges: EdgeSpecV01[] = [];

  for (const edge of fragment.edges) {
    if (edgeIsInternal(edge, selectedNodeIds)) {
      internalEdges.push(edge);
    } else {
      externalEdges.push(edge);
    }
  }

  if (outsideEndpointPolicy === "reject" && externalEdges.length > 0) {
    throw new SkenionGraphFragmentError(
      externalEdges.map((edge) => `edge ${edge.id} references an endpoint outside the graph fragment`)
    );
  }

  if (externalEdges.length === 0) {
    return fragment;
  }

  return {
    ...fragment,
    edges: internalEdges,
    omittedEdges: [
      ...(fragment.omittedEdges ?? []),
      ...externalEdges.map((edge) => omittedEdge(edge, "outside-fragment"))
    ]
  };
}

function validateFragmentOrThrow(
  fragment: GraphFragmentV01,
  options: GraphFragmentValidationOptionsV01
): GraphFragmentV01 {
  const validation = validateGraphFragmentV01(fragment, options);
  if (!validation.ok) {
    throw new SkenionGraphFragmentError(validation.errors);
  }

  return validation.value;
}

function viewForSelection(
  selectedNodeIds: Set<string>,
  viewState: ViewStateV01 | undefined
): GraphFragmentViewV01 | undefined {
  if (!viewState) {
    return undefined;
  }

  const nodes: GraphFragmentViewV01["nodes"] = {};
  for (const [nodeId, view] of Object.entries(viewState.canvas.nodes)) {
    if (selectedNodeIds.has(nodeId)) {
      nodes[nodeId] = { ...view };
    }
  }

  return Object.keys(nodes).length === 0 ? undefined : { nodes };
}

export function analyzeGraphFragment(
  fragment: GraphFragmentV01,
  options: GraphFragmentValidationOptionsV01 = {}
): GraphFragmentValidationResultV01 {
  return analyzeGraphFragmentV01(fragment, options);
}

export function validateGraphFragment(
  fragment: unknown,
  options: GraphFragmentValidationOptionsV01 = {}
): GraphFragmentV01 {
  const validation = validateGraphFragmentV01(fragment, options);
  if (!validation.ok) {
    throw new SkenionGraphFragmentError(validation.errors);
  }

  return validation.value;
}

export function createGraphFragment(options: CreateGraphFragmentOptions): GraphFragmentV01 {
  const outsideEndpointPolicy = options.outsideEndpointPolicy ?? "reject";
  const fragment: GraphFragmentV01 = {
    schema: "skenion.graph.fragment",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: [...options.nodes],
    edges: [...(options.edges ?? [])],
    ...(options.id === undefined ? {} : { id: options.id }),
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.omittedEdges === undefined ? {} : { omittedEdges: [...options.omittedEdges] }),
    ...(() => {
      const metadata = mergeMetadata(options.metadata, options.sourceMetadata);
      return metadata === undefined ? {} : { metadata };
    })()
  };

  return validateFragmentOrThrow(
    normalizeExternalEdges(fragment, outsideEndpointPolicy),
    { outsideEndpointPolicy }
  );
}

export function createGraphFragmentFromSelection(
  graph: GraphDocumentV01,
  options: GraphFragmentSelectionOptions
): GraphFragmentV01 {
  const selectedNodeIds = new Set(options.selectedNodeIds);
  const nodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id));
  const internalEdges: EdgeSpecV01[] = [];
  const externalEdges: EdgeSpecV01[] = [];

  for (const edge of graph.edges) {
    const sourceSelected = selectedNodeIds.has(edge.source.nodeId);
    const targetSelected = selectedNodeIds.has(edge.target.nodeId);

    if (sourceSelected && targetSelected) {
      internalEdges.push(edge);
    } else if (sourceSelected || targetSelected) {
      externalEdges.push(edge);
    }
  }

  if ((options.outsideEndpointPolicy ?? "reject") === "reject" && externalEdges.length > 0) {
    throw new SkenionGraphFragmentError(
      externalEdges.map((edge) => `edge ${edge.id} references an endpoint outside the graph fragment`)
    );
  }

  return createGraphFragment({
    id: options.id,
    nodes,
    edges: internalEdges,
    view: viewForSelection(selectedNodeIds, options.viewState),
    omittedEdges: externalEdges.map((edge) => omittedEdge(edge, "outside-fragment")),
    metadata: options.metadata,
    sourceMetadata: options.sourceMetadata,
    outsideEndpointPolicy: options.outsideEndpointPolicy
  });
}

export function withGraphFragmentSourceMetadata(
  fragment: GraphFragmentV01,
  sourceMetadata: Record<string, unknown>
): GraphFragmentV01 {
  return validateFragmentOrThrow(
    {
      ...fragment,
      metadata: mergeMetadata(fragment.metadata, sourceMetadata)
    },
    {}
  );
}

export function createPasteGraphFragmentRequest(
  options: CreatePasteGraphFragmentRequestOptions
): PasteGraphFragmentRequest {
  const request: PasteGraphFragmentRequest = {
    target: options.target,
    fragment: options.fragment,
    ...(options.placement === undefined ? {} : { placement: options.placement }),
    ...(options.options === undefined ? {} : { options: options.options })
  };

  const validation = validatePasteGraphFragmentRequest(request);
  if (!validation.ok) {
    throw new SkenionPasteRequestError(validation.errors);
  }

  return validation.value;
}

export function createPasteGraphFragmentOperation(
  options: CreatePasteGraphFragmentOperationOptions
): RuntimeOperationEnvelope {
  const operation: RuntimeOperationEnvelope = {
    schema: "skenion.runtime.operation",
    schemaVersion: "0.1.0",
    id: options.id,
    kind: "pasteGraphFragment",
    request: options.request,
    ...(options.attribution === undefined ? {} : { attribution: options.attribution }),
    ...(options.correlationId === undefined ? {} : { correlationId: options.correlationId }),
    ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt })
  };

  const validation = validateRuntimeOperationEnvelope(operation);
  if (!validation.ok) {
    throw new SkenionPasteRequestError(validation.errors);
  }

  return validation.value;
}

export function readPasteGraphFragmentResponse(
  response: unknown
): PasteGraphFragmentResponseSummary {
  const validation = validatePasteGraphFragmentResponse(response);
  if (!validation.ok) {
    throw new SkenionPasteResponseError(validation.errors);
  }

  const value = validation.value;
  return {
    ok: value.ok,
    applied: value.applied,
    conflict: value.conflict,
    target: value.target,
    revisionBefore: value.revisionBefore,
    revisionAfter: value.revisionAfter,
    historyEntryId: value.historyEntryId,
    idRemap: value.idRemap,
    diagnostics: value.diagnostics,
    mapNodeId: (id: string) => value.idRemap.nodeIdMap[id] ?? id,
    mapEdgeId: (id: string) => value.idRemap.edgeIdMap[id] ?? id
  };
}
