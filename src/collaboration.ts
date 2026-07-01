import { validatePasteGraphFragmentRequest } from "@skenion/contracts";
import type {
  EdgeSpecV01,
  GraphFragmentV01,
  GraphNodeV01,
  GraphTargetRef,
  PasteGraphFragmentRequest
} from "@skenion/contracts";
import type { RuntimeEventReplayMetadata } from "./runtime-client.js";

const CURRENT_SCHEMA_VERSION = "0.1.0";

export interface RuntimeCollaborationCausalMetadata {
  baseRevision: string;
  baseSequence: number;
  vector: Record<string, number>;
  observedOperationIds?: string[];
}

export type RuntimeCollaborationAuthSubjectKind = "anonymous" | "user" | "service" | "deferred";

export interface RuntimeCollaborationAuthSubject {
  kind: RuntimeCollaborationAuthSubjectKind;
  subjectId?: string;
  issuer?: string;
  displayName?: string;
}

export interface RuntimeCollaborationCanvasPosition {
  x: number;
  y: number;
}

export type RuntimeCollaborationChange =
  | {
      op: "node.add";
      changeId: string;
      node: GraphNodeV01;
      view?: RuntimeCollaborationCanvasPosition;
    }
  | {
      op: "node.move";
      changeId: string;
      nodeId: string;
      from?: RuntimeCollaborationCanvasPosition;
      to: RuntimeCollaborationCanvasPosition;
    }
  | {
      op: "node.delete";
      changeId: string;
      nodeId: string;
      tombstoneId?: string;
    }
  | {
      op: "edge.connect";
      changeId: string;
      edge: EdgeSpecV01;
    }
  | {
      op: "edge.disconnect";
      changeId: string;
      edgeId: string;
    };

export interface RuntimeCollaborationChangeSetPayload {
  kind: "changeSet";
  target: GraphTargetRef;
  changes: RuntimeCollaborationChange[];
  undoGroupId?: string;
  description?: string;
}

export interface RuntimeCollaborationPasteGraphFragmentPayload {
  kind: "pasteGraphFragment";
  request: PasteGraphFragmentRequest;
  undoGroupId?: string;
  description?: string;
}

export type RuntimeCollaborationUndoRedoAction = "undo" | "redo";

export interface RuntimeCollaborationUndoScope {
  kind: "participant";
  participantId: string;
}

export interface RuntimeCollaborationUndoRedoPayload {
  kind: "undoRedo";
  action: RuntimeCollaborationUndoRedoAction;
  scope: RuntimeCollaborationUndoScope;
  subjectOperationId?: string;
  undoGroupId?: string;
  maxOperations?: number;
}

export type RuntimeCollaborationOperationPayload =
  | RuntimeCollaborationChangeSetPayload
  | RuntimeCollaborationPasteGraphFragmentPayload
  | RuntimeCollaborationUndoRedoPayload;

export interface RuntimeCollaborationOperationEnvelope {
  schema: "skenion.runtime.collaboration.operation";
  schemaVersion: "0.1.0";
  operationId: string;
  sessionId: string;
  participantId: string;
  idempotencyKey: string;
  causal: RuntimeCollaborationCausalMetadata;
  payload: RuntimeCollaborationOperationPayload;
  authSubject?: RuntimeCollaborationAuthSubject;
  correlationId?: string;
  submittedAt: string;
}

export interface RuntimeCollaborationOperationBatch {
  schema: "skenion.runtime.collaboration.operation-batch";
  schemaVersion: "0.1.0";
  sessionId: string;
  operations: RuntimeCollaborationOperationEnvelope[];
  submittedAt?: string;
}

export type RuntimeCollaborationOperationIssueSeverity = "error" | "warning" | "info";

export type RuntimeCollaborationOperationIssueCode =
  | "base-revision-mismatch"
  | "causality-gap"
  | "duplicate-idempotency-key"
  | "idempotent-replay"
  | "invalid-operation"
  | "operation-rebased"
  | "participant-expired"
  | "participant-mismatch"
  | "presence-expired"
  | "selection-expired"
  | "unsupported-operation";

export interface RuntimeCollaborationOperationIssue {
  severity: RuntimeCollaborationOperationIssueSeverity;
  code: RuntimeCollaborationOperationIssueCode;
  message: string;
  path?: string;
  participantId?: string;
  operationId?: string;
  idempotencyKey?: string;
  expectedRevision?: string;
  actualRevision?: string;
  expectedSequence?: number;
  actualSequence?: number;
}

export interface RuntimeCollaborationServerClock {
  revision: string;
  sequence: number;
  vector: Record<string, number>;
}

export interface RuntimeCollaborationAck {
  sequence: number;
  revision: string;
  serverClock: RuntimeCollaborationServerClock;
  appliedAt: string;
}

export type RuntimeCollaborationNackReason =
  | "base-revision-mismatch"
  | "causality-gap"
  | "duplicate-idempotency-key"
  | "invalid-operation"
  | "participant-expired"
  | "unsupported-operation";

export interface RuntimeCollaborationNack {
  reason: RuntimeCollaborationNackReason;
  retryable?: boolean;
  issues?: RuntimeCollaborationOperationIssue[];
}

export interface RuntimeCollaborationConflict {
  code: string;
  message: string;
  changeIds?: string[];
  nodeIds?: string[];
  edgeIds?: string[];
}

export type RuntimeCollaborationRebaseStrategy = "ot-transform" | "crdt-merge" | "server-reject";

export interface RuntimeCollaborationRebase {
  from: RuntimeCollaborationCausalMetadata;
  to: RuntimeCollaborationCausalMetadata;
  strategy: RuntimeCollaborationRebaseStrategy;
  transformedPayload?: RuntimeCollaborationOperationPayload;
  conflicts: RuntimeCollaborationConflict[];
}

export type RuntimeCollaborationOperationStatus = "accepted" | "duplicate" | "rejected" | "rebased";

export interface RuntimeCollaborationOperationResult {
  schema: "skenion.runtime.collaboration.operation-result";
  schemaVersion: "0.1.0";
  sessionId: string;
  operationId: string;
  participantId: string;
  idempotencyKey: string;
  status: RuntimeCollaborationOperationStatus;
  causal: RuntimeCollaborationCausalMetadata;
  ack?: RuntimeCollaborationAck;
  nack?: RuntimeCollaborationNack;
  rebase?: RuntimeCollaborationRebase;
  issues: RuntimeCollaborationOperationIssue[];
  createdAt: string;
}

export interface RuntimeCollaborationOperationBatchResult {
  schema: "skenion.runtime.collaboration.operation-batch-result";
  schemaVersion: "0.1.0";
  sessionId: string;
  results: RuntimeCollaborationOperationResult[];
  issues: RuntimeCollaborationOperationIssue[];
  createdAt: string;
}

export type RuntimeCollaborationPresenceState = "joined" | "active" | "idle" | "away" | "left" | "expired";

export interface RuntimeCollaborationPresence {
  state: RuntimeCollaborationPresenceState;
  displayName?: string;
  color?: string;
  statusText?: string;
  capabilities?: string[];
  connectionId?: string;
  clientWindowId?: string;
}

export interface RuntimeCollaborationPresenceEnvelope {
  schema: "skenion.runtime.collaboration.presence";
  schemaVersion: "0.1.0";
  sessionId: string;
  participantId: string;
  presence: RuntimeCollaborationPresence;
  authSubject?: RuntimeCollaborationAuthSubject;
  updatedAt: string;
  expiresAt: string;
}

export interface RuntimeCollaborationPortEndpoint {
  nodeId: string;
  portId: string;
}

export interface RuntimeCollaborationTextPosition {
  nodeId: string;
  field: string;
  offset: number;
}

export type RuntimeCollaborationSelectionRange =
  | {
      kind: "nodes";
      nodeIds: string[];
    }
  | {
      kind: "edges";
      edgeIds: string[];
    }
  | {
      kind: "ports";
      endpoints: RuntimeCollaborationPortEndpoint[];
    }
  | {
      kind: "text";
      anchor: RuntimeCollaborationTextPosition;
      focus: RuntimeCollaborationTextPosition;
    };

export interface RuntimeCollaborationSelection {
  ranges: RuntimeCollaborationSelectionRange[];
  activeRangeIndex?: number;
}

export type RuntimeCollaborationCursor =
  | {
      kind: "canvas";
      x: number;
      y: number;
      clientWindowId?: string;
    }
  | {
      kind: "node";
      nodeId: string;
      portId?: string;
      clientWindowId?: string;
    };

export interface RuntimeCollaborationSelectionEnvelope {
  schema: "skenion.runtime.collaboration.selection";
  schemaVersion: "0.1.0";
  sessionId: string;
  participantId: string;
  target: GraphTargetRef;
  selection: RuntimeCollaborationSelection;
  cursor?: RuntimeCollaborationCursor;
  updatedAt: string;
  expiresAt: string;
}

export type RuntimeCollaborationEventPayload =
  | {
      kind: "operationResult";
      result: RuntimeCollaborationOperationResult;
    }
  | {
      kind: "presence";
      presence: RuntimeCollaborationPresenceEnvelope;
    }
  | {
      kind: "selection";
      selection: RuntimeCollaborationSelectionEnvelope;
    };

export type RuntimeCollaborationEventKind = "operation-result" | "presence" | "selection";

export interface RuntimeCollaborationEventEnvelope {
  schema: "skenion.runtime.collaboration.event";
  schemaVersion: "0.1.0";
  eventId: string;
  sessionId: string;
  sequence: number;
  causal: RuntimeCollaborationCausalMetadata;
  kind: RuntimeCollaborationEventKind;
  payload: RuntimeCollaborationEventPayload;
  replay: RuntimeEventReplayMetadata;
  createdAt: string;
}

export const runtimeCollaborationRebaseStrategies = [
  "ot-transform",
  "crdt-merge",
  "server-reject"
] as const satisfies readonly RuntimeCollaborationRebaseStrategy[];

export interface CreateRuntimeCollaborationCausalMetadataOptions {
  baseRevision: string;
  baseSequence: number;
  participantId: string;
  participantSequence?: number;
  vector?: Record<string, number>;
  observedOperationIds?: string[];
}

export interface RuntimeCollaborationOperationBaseOptions {
  operationId: string;
  sessionId: string;
  participantId: string;
  causal: RuntimeCollaborationCausalMetadata;
  idempotencyKey?: string;
  authSubject?: RuntimeCollaborationAuthSubject;
  correlationId?: string;
  submittedAt: string;
}

export interface CreateRuntimeCollaborationOperationOptions extends RuntimeCollaborationOperationBaseOptions {
  payload: RuntimeCollaborationOperationPayload;
}

export interface CreateRuntimeCollaborationChangeSetOperationOptions
  extends RuntimeCollaborationOperationBaseOptions {
  target: GraphTargetRef;
  changes: RuntimeCollaborationChange[];
  undoGroupId?: string;
  description?: string;
}

export interface CreateRuntimeCollaborationPasteOperationOptions
  extends RuntimeCollaborationOperationBaseOptions {
  request: PasteGraphFragmentRequest;
  undoGroupId?: string;
  description?: string;
}

export interface CreateRuntimeCollaborationUndoRedoOperationOptions
  extends RuntimeCollaborationOperationBaseOptions {
  action: RuntimeCollaborationUndoRedoAction;
  subjectOperationId?: string;
  undoGroupId?: string;
  maxOperations?: number;
}

export interface CreateRuntimeCollaborationOperationBatchOptions {
  sessionId: string;
  operations: RuntimeCollaborationOperationEnvelope[];
  submittedAt?: string;
}

export interface CreateRuntimeCollaborationPresenceEnvelopeOptions {
  sessionId: string;
  participantId: string;
  presence: RuntimeCollaborationPresence;
  authSubject?: RuntimeCollaborationAuthSubject;
  updatedAt: string;
  expiresAt: string;
}

export interface CreateRuntimeCollaborationSelectionEnvelopeOptions {
  sessionId: string;
  participantId: string;
  target: GraphTargetRef;
  selection: RuntimeCollaborationSelection;
  cursor?: RuntimeCollaborationCursor;
  updatedAt: string;
  expiresAt: string;
}

export class SkenionRuntimeCollaborationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion runtime collaboration value: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeCollaborationError";
    this.errors = errors;
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string, errors: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push(`${path} must be object`);
  }
  return isRecord(value) ? value : {};
}

function requireNonEmptyString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireNumber(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be number`);
  }
}

function requireArray(value: unknown, path: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be array`);
  }
  return Array.isArray(value) ? value : [];
}

function requireLiteral(value: unknown, expected: string, path: string, errors: string[]): void {
  if (value !== expected) {
    errors.push(`${path} must be ${expected}`);
  }
}

function requireOneOf(value: unknown, allowed: readonly string[], path: string, errors: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
}

function minimalGraphFragment(): GraphFragmentV01 {
  return {
    schema: "skenion.graph.fragment",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: [],
    edges: []
  };
}

function validateGraphTarget(target: unknown, errors: string[]): void {
  const validation = validatePasteGraphFragmentRequest({
    target,
    fragment: minimalGraphFragment()
  });
  if (!validation.ok) {
    errors.push(...validation.errors);
  }
}

function validatePasteRequest(request: unknown, errors: string[]): void {
  const validation = validatePasteGraphFragmentRequest(request);
  if (!validation.ok) {
    errors.push(...validation.errors);
  }
}

function validateCausal(value: unknown, path: string, errors: string[]): void {
  const causal = requireRecord(value, path, errors);
  const vector = requireRecord(causal.vector, `${path}/vector`, errors);
  requireNonEmptyString(causal.baseRevision, `${path}/baseRevision`, errors);
  requireNumber(causal.baseSequence, `${path}/baseSequence`, errors);
  for (const [participantId, sequence] of Object.entries(vector)) {
    if (participantId.length === 0 || typeof sequence !== "number" || !Number.isFinite(sequence)) {
      errors.push(`${path}/vector must map participant ids to numbers`);
    }
  }
}

function validateAuthSubject(value: unknown, path: string, errors: string[]): void {
  const subject = requireRecord(value, path, errors);
  requireOneOf(subject.kind, ["anonymous", "user", "service", "deferred"], `${path}/kind`, errors);
  if (subject.subjectId !== undefined) {
    requireNonEmptyString(subject.subjectId, `${path}/subjectId`, errors);
  }
  if (subject.issuer !== undefined) {
    requireNonEmptyString(subject.issuer, `${path}/issuer`, errors);
  }
  if (subject.displayName !== undefined) {
    requireNonEmptyString(subject.displayName, `${path}/displayName`, errors);
  }
}

function validatePayload(value: unknown, participantId: unknown, errors: string[]): void {
  const payload = requireRecord(value, "/payload", errors);
  requireOneOf(payload.kind, ["changeSet", "pasteGraphFragment", "undoRedo"], "/payload/kind", errors);

  if (payload.kind === "changeSet") {
    validateGraphTarget(payload.target, errors);
    requireArray(payload.changes, "/payload/changes", errors);
  }
  if (payload.kind === "pasteGraphFragment") {
    validatePasteRequest(payload.request, errors);
  }
  if (payload.kind === "undoRedo") {
    requireOneOf(payload.action, ["undo", "redo"], "/payload/action", errors);
    const scope = requireRecord(payload.scope, "/payload/scope", errors);
    requireLiteral(scope.kind, "participant", "/payload/scope/kind", errors);
    requireNonEmptyString(scope.participantId, "/payload/scope/participantId", errors);
    if (scope.participantId !== participantId) {
      errors.push("/payload/scope/participantId must match /participantId");
    }
    if (payload.maxOperations !== undefined) {
      requireNumber(payload.maxOperations, "/payload/maxOperations", errors);
    }
  }
}

function validateOperationEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  const operation = requireRecord(value, "/", errors);
  requireLiteral(operation.schema, "skenion.runtime.collaboration.operation", "/schema", errors);
  requireLiteral(operation.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(operation.operationId, "/operationId", errors);
  requireNonEmptyString(operation.sessionId, "/sessionId", errors);
  requireNonEmptyString(operation.participantId, "/participantId", errors);
  requireNonEmptyString(operation.idempotencyKey, "/idempotencyKey", errors);
  validateCausal(operation.causal, "/causal", errors);
  validatePayload(operation.payload, operation.participantId, errors);
  if (operation.authSubject !== undefined) {
    validateAuthSubject(operation.authSubject, "/authSubject", errors);
  }
  if (operation.correlationId !== undefined) {
    requireNonEmptyString(operation.correlationId, "/correlationId", errors);
  }
  requireNonEmptyString(operation.submittedAt, "/submittedAt", errors);
  return errors;
}

function validateTimestampWindow(
  updatedAt: unknown,
  expiresAt: unknown,
  path: string,
  errors: string[]
): void {
  requireNonEmptyString(updatedAt, `${path}/updatedAt`, errors);
  requireNonEmptyString(expiresAt, `${path}/expiresAt`, errors);
  if (
    typeof updatedAt === "string" &&
    typeof expiresAt === "string" &&
    Number.isFinite(Date.parse(updatedAt)) &&
    Number.isFinite(Date.parse(expiresAt)) &&
    Date.parse(expiresAt) <= Date.parse(updatedAt)
  ) {
    errors.push(`${path}/expiresAt must be after ${path}/updatedAt`);
  }
}

function validatePresenceEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  const envelope = requireRecord(value, "/", errors);
  const presence = requireRecord(envelope.presence, "/presence", errors);
  requireLiteral(envelope.schema, "skenion.runtime.collaboration.presence", "/schema", errors);
  requireLiteral(envelope.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(envelope.sessionId, "/sessionId", errors);
  requireNonEmptyString(envelope.participantId, "/participantId", errors);
  requireOneOf(presence.state, ["joined", "active", "idle", "away", "left", "expired"], "/presence/state", errors);
  if (envelope.authSubject !== undefined) {
    validateAuthSubject(envelope.authSubject, "/authSubject", errors);
    const subject = envelope.authSubject;
    if (isRecord(subject) && subject.subjectId === envelope.participantId) {
      errors.push("/authSubject/subjectId must not duplicate /participantId");
    }
  }
  validateTimestampWindow(envelope.updatedAt, envelope.expiresAt, "", errors);
  return errors;
}

function validateSelectionEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  const envelope = requireRecord(value, "/", errors);
  const selection = requireRecord(envelope.selection, "/selection", errors);
  requireLiteral(envelope.schema, "skenion.runtime.collaboration.selection", "/schema", errors);
  requireLiteral(envelope.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(envelope.sessionId, "/sessionId", errors);
  requireNonEmptyString(envelope.participantId, "/participantId", errors);
  validateGraphTarget(envelope.target, errors);
  requireArray(selection.ranges, "/selection/ranges", errors);
  if (selection.activeRangeIndex !== undefined) {
    requireNumber(selection.activeRangeIndex, "/selection/activeRangeIndex", errors);
  }
  validateTimestampWindow(envelope.updatedAt, envelope.expiresAt, "", errors);
  return errors;
}

function validateOperationResult(value: unknown): string[] {
  const errors: string[] = [];
  const result = requireRecord(value, "/", errors);
  requireLiteral(result.schema, "skenion.runtime.collaboration.operation-result", "/schema", errors);
  requireLiteral(result.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(result.sessionId, "/sessionId", errors);
  requireNonEmptyString(result.operationId, "/operationId", errors);
  requireNonEmptyString(result.participantId, "/participantId", errors);
  requireNonEmptyString(result.idempotencyKey, "/idempotencyKey", errors);
  requireOneOf(result.status, ["accepted", "duplicate", "rejected", "rebased"], "/status", errors);
  validateCausal(result.causal, "/causal", errors);
  requireArray(result.issues, "/issues", errors);
  requireNonEmptyString(result.createdAt, "/createdAt", errors);

  if ((result.status === "accepted" || result.status === "duplicate") && result.nack !== undefined) {
    errors.push("/nack must be omitted for accepted or duplicate results");
  }
  if (result.status === "rejected" && result.ack !== undefined) {
    errors.push("/ack must be omitted for rejected results");
  }
  if (result.status === "rebased") {
    const rebase = requireRecord(result.rebase, "/rebase", errors);
    validateCausal(rebase.from, "/rebase/from", errors);
    validateCausal(rebase.to, "/rebase/to", errors);
    requireOneOf(rebase.strategy, runtimeCollaborationRebaseStrategies, "/rebase/strategy", errors);
    requireArray(rebase.conflicts, "/rebase/conflicts", errors);
  }

  return errors;
}

function validateOperationBatchResult(value: unknown): string[] {
  const errors: string[] = [];
  const batch = requireRecord(value, "/", errors);
  requireLiteral(batch.schema, "skenion.runtime.collaboration.operation-batch-result", "/schema", errors);
  requireLiteral(batch.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(batch.sessionId, "/sessionId", errors);
  const results = requireArray(batch.results, "/results", errors);
  for (const result of results) {
    errors.push(...validateOperationResult(result));
    if (isRecord(result) && result.sessionId !== batch.sessionId) {
      errors.push("/results/sessionId must match /sessionId");
    }
  }
  requireArray(batch.issues, "/issues", errors);
  requireNonEmptyString(batch.createdAt, "/createdAt", errors);
  return errors;
}

function validateOperationBatch(value: unknown): string[] {
  const errors: string[] = [];
  const batch = requireRecord(value, "/", errors);
  requireLiteral(batch.schema, "skenion.runtime.collaboration.operation-batch", "/schema", errors);
  requireLiteral(batch.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(batch.sessionId, "/sessionId", errors);
  const operations = requireArray(batch.operations, "/operations", errors);
  const idempotencyKeys = new Set<string>();
  for (const operation of operations) {
    errors.push(...validateOperationEnvelope(operation));
    if (isRecord(operation)) {
      if (operation.sessionId !== batch.sessionId) {
        errors.push("/operations/sessionId must match /sessionId");
      }
      if (typeof operation.idempotencyKey === "string") {
        if (idempotencyKeys.has(operation.idempotencyKey)) {
          errors.push("/operations/idempotencyKey values must be unique");
        }
        idempotencyKeys.add(operation.idempotencyKey);
      }
    }
  }
  return errors;
}

function validateReplay(value: unknown, errors: string[]): void {
  const replay = requireRecord(value, "/replay", errors);
  requireNonEmptyString(replay.cursor, "/replay/cursor", errors);
}

function validateEventEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  const event = requireRecord(value, "/", errors);
  const payload = requireRecord(event.payload, "/payload", errors);
  requireLiteral(event.schema, "skenion.runtime.collaboration.event", "/schema", errors);
  requireLiteral(event.schemaVersion, CURRENT_SCHEMA_VERSION, "/schemaVersion", errors);
  requireNonEmptyString(event.eventId, "/eventId", errors);
  requireNonEmptyString(event.sessionId, "/sessionId", errors);
  requireNumber(event.sequence, "/sequence", errors);
  validateCausal(event.causal, "/causal", errors);
  requireOneOf(event.kind, ["operation-result", "presence", "selection"], "/kind", errors);
  requireOneOf(payload.kind, ["operationResult", "presence", "selection"], "/payload/kind", errors);
  if (payload.kind === "operationResult") {
    errors.push(...validateOperationResult(payload.result));
    if (isRecord(payload.result) && payload.result.sessionId !== event.sessionId) {
      errors.push("/payload/result/sessionId must match /sessionId");
    }
  }
  if (payload.kind === "presence") {
    errors.push(...validatePresenceEnvelope(payload.presence));
  }
  if (payload.kind === "selection") {
    errors.push(...validateSelectionEnvelope(payload.selection));
  }
  validateReplay(event.replay, errors);
  requireNonEmptyString(event.createdAt, "/createdAt", errors);
  return errors;
}

function readOrThrow<T>(value: unknown, errors: string[]): T {
  if (errors.length > 0) {
    throw new SkenionRuntimeCollaborationError(errors);
  }
  return value as T;
}

function parseJsonMessage(message: string | { data: string }, label: string): unknown {
  const data = typeof message === "string" ? message : message.data;
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new SkenionRuntimeCollaborationError([`invalid ${label} JSON: ${String(error)}`]);
  }
}

export function isRuntimeCollaborationRebaseStrategy(
  value: unknown
): value is RuntimeCollaborationRebaseStrategy {
  return typeof value === "string" &&
    (runtimeCollaborationRebaseStrategies as readonly string[]).includes(value);
}

export function createRuntimeCollaborationCausalMetadata(
  options: CreateRuntimeCollaborationCausalMetadataOptions
): RuntimeCollaborationCausalMetadata {
  return {
    baseRevision: options.baseRevision,
    baseSequence: options.baseSequence,
    vector: {
      ...(options.vector ?? {}),
      [options.participantId]: options.participantSequence ?? options.baseSequence
    },
    observedOperationIds: [...(options.observedOperationIds ?? [])]
  };
}

export function createRuntimeCollaborationOperation(
  options: CreateRuntimeCollaborationOperationOptions
): RuntimeCollaborationOperationEnvelope {
  const operation = compact({
    schema: "skenion.runtime.collaboration.operation",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    operationId: options.operationId,
    sessionId: options.sessionId,
    participantId: options.participantId,
    idempotencyKey: options.idempotencyKey ?? options.operationId,
    causal: options.causal,
    payload: options.payload,
    authSubject: options.authSubject,
    correlationId: options.correlationId,
    submittedAt: options.submittedAt
  }) as RuntimeCollaborationOperationEnvelope;

  return readRuntimeCollaborationOperation(operation);
}

export function createRuntimeCollaborationChangeSetOperation(
  options: CreateRuntimeCollaborationChangeSetOperationOptions
): RuntimeCollaborationOperationEnvelope {
  return createRuntimeCollaborationOperation({
    ...options,
    payload: compact({
      kind: "changeSet",
      target: options.target,
      changes: [...options.changes],
      undoGroupId: options.undoGroupId,
      description: options.description
    }) as RuntimeCollaborationOperationPayload
  });
}

export function createRuntimeCollaborationPasteOperation(
  options: CreateRuntimeCollaborationPasteOperationOptions
): RuntimeCollaborationOperationEnvelope {
  return createRuntimeCollaborationOperation({
    ...options,
    payload: compact({
      kind: "pasteGraphFragment",
      request: options.request,
      undoGroupId: options.undoGroupId,
      description: options.description
    }) as RuntimeCollaborationOperationPayload
  });
}

export function createRuntimeCollaborationUndoRedoOperation(
  options: CreateRuntimeCollaborationUndoRedoOperationOptions
): RuntimeCollaborationOperationEnvelope {
  return createRuntimeCollaborationOperation({
    ...options,
    payload: compact({
      kind: "undoRedo",
      action: options.action,
      scope: {
        kind: "participant",
        participantId: options.participantId
      },
      subjectOperationId: options.subjectOperationId,
      undoGroupId: options.undoGroupId,
      maxOperations: options.maxOperations
    }) as RuntimeCollaborationOperationPayload
  });
}

export function createRuntimeCollaborationOperationBatch(
  options: CreateRuntimeCollaborationOperationBatchOptions
): RuntimeCollaborationOperationBatch {
  const batch = compact({
    schema: "skenion.runtime.collaboration.operation-batch",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId: options.sessionId,
    operations: [...options.operations],
    submittedAt: options.submittedAt
  }) as RuntimeCollaborationOperationBatch;

  return readRuntimeCollaborationOperationBatch(batch);
}

export function createRuntimeCollaborationPresenceEnvelope(
  options: CreateRuntimeCollaborationPresenceEnvelopeOptions
): RuntimeCollaborationPresenceEnvelope {
  const presence = compact({
    schema: "skenion.runtime.collaboration.presence",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId: options.sessionId,
    participantId: options.participantId,
    presence: options.presence,
    authSubject: options.authSubject,
    updatedAt: options.updatedAt,
    expiresAt: options.expiresAt
  }) as RuntimeCollaborationPresenceEnvelope;

  return readRuntimeCollaborationPresence(presence);
}

export function createRuntimeCollaborationSelectionEnvelope(
  options: CreateRuntimeCollaborationSelectionEnvelopeOptions
): RuntimeCollaborationSelectionEnvelope {
  const selection = compact({
    schema: "skenion.runtime.collaboration.selection",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId: options.sessionId,
    participantId: options.participantId,
    target: options.target,
    selection: options.selection,
    cursor: options.cursor,
    updatedAt: options.updatedAt,
    expiresAt: options.expiresAt
  }) as RuntimeCollaborationSelectionEnvelope;

  return readRuntimeCollaborationSelection(selection);
}

export function readRuntimeCollaborationOperation(
  value: unknown
): RuntimeCollaborationOperationEnvelope {
  return readOrThrow(value, validateOperationEnvelope(value));
}

export function readRuntimeCollaborationOperationBatch(
  value: unknown
): RuntimeCollaborationOperationBatch {
  return readOrThrow(value, validateOperationBatch(value));
}

export function readRuntimeCollaborationOperationResult(
  value: unknown
): RuntimeCollaborationOperationResult {
  return readOrThrow(value, validateOperationResult(value));
}

export function readRuntimeCollaborationOperationBatchResult(
  value: unknown
): RuntimeCollaborationOperationBatchResult {
  return readOrThrow(value, validateOperationBatchResult(value));
}

export function readRuntimeCollaborationPresence(
  value: unknown
): RuntimeCollaborationPresenceEnvelope {
  return readOrThrow(value, validatePresenceEnvelope(value));
}

export function readRuntimeCollaborationSelection(
  value: unknown
): RuntimeCollaborationSelectionEnvelope {
  return readOrThrow(value, validateSelectionEnvelope(value));
}

export function readRuntimeCollaborationEvent(
  value: unknown
): RuntimeCollaborationEventEnvelope {
  return readOrThrow(value, validateEventEnvelope(value));
}

export function parseRuntimeCollaborationOperationResult(
  message: string | { data: string }
): RuntimeCollaborationOperationResult {
  return readRuntimeCollaborationOperationResult(
    parseJsonMessage(message, "Runtime collaboration operation result")
  );
}

export function parseRuntimeCollaborationEvent(
  message: string | { data: string }
): RuntimeCollaborationEventEnvelope {
  return readRuntimeCollaborationEvent(
    parseJsonMessage(message, "Runtime collaboration event")
  );
}
