import {
  runtimeCollaborationV0Schema,
  validateRuntimeCollaborationEventEnvelope,
  validateRuntimeCollaborationOperationBatch,
  validateRuntimeCollaborationOperationBatchResult,
  validateRuntimeCollaborationOperationEnvelope,
  validateRuntimeCollaborationOperationResult,
  validateRuntimeCollaborationPresenceEnvelope,
  validateRuntimeCollaborationSelectionEnvelope
} from "@skenion/contracts";
import type {
  GraphTargetRef,
  PasteGraphFragmentRequest,
  RuntimeCollaborationAuthSubject,
  RuntimeCollaborationCausalMetadata,
  RuntimeCollaborationChange,
  RuntimeCollaborationCursor,
  RuntimeCollaborationEventEnvelope,
  RuntimeCollaborationOperationBatch,
  RuntimeCollaborationOperationBatchResult,
  RuntimeCollaborationOperationEnvelope,
  RuntimeCollaborationOperationPayload,
  RuntimeCollaborationOperationResult,
  RuntimeCollaborationPresence,
  RuntimeCollaborationPresenceEnvelope,
  RuntimeCollaborationRebaseStrategy,
  RuntimeCollaborationSelection,
  RuntimeCollaborationSelectionEnvelope,
  RuntimeCollaborationUndoRedoAction,
  ValidationResult
} from "@skenion/contracts";

export const runtimeCollaborationRebaseStrategies = (
  runtimeCollaborationV0Schema.$defs.runtimeCollaborationRebase.properties.strategy.enum
) satisfies readonly RuntimeCollaborationRebaseStrategy[];

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
    super(`Invalid Skenion Runtime collaboration value: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeCollaborationError";
    this.errors = errors;
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function readValidation<T>(validation: ValidationResult<T>): T {
  if (!validation.ok) {
    throw new SkenionRuntimeCollaborationError(validation.errors);
  }

  return validation.value;
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
    schemaVersion: "0.1.0",
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
    schemaVersion: "0.1.0",
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
    schemaVersion: "0.1.0",
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
    schemaVersion: "0.1.0",
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
  return readValidation(validateRuntimeCollaborationOperationEnvelope(value));
}

export function readRuntimeCollaborationOperationBatch(
  value: unknown
): RuntimeCollaborationOperationBatch {
  return readValidation(validateRuntimeCollaborationOperationBatch(value));
}

export function readRuntimeCollaborationOperationResult(
  value: unknown
): RuntimeCollaborationOperationResult {
  return readValidation(validateRuntimeCollaborationOperationResult(value));
}

export function readRuntimeCollaborationOperationBatchResult(
  value: unknown
): RuntimeCollaborationOperationBatchResult {
  return readValidation(validateRuntimeCollaborationOperationBatchResult(value));
}

export function readRuntimeCollaborationPresence(
  value: unknown
): RuntimeCollaborationPresenceEnvelope {
  return readValidation(validateRuntimeCollaborationPresenceEnvelope(value));
}

export function readRuntimeCollaborationSelection(
  value: unknown
): RuntimeCollaborationSelectionEnvelope {
  return readValidation(validateRuntimeCollaborationSelectionEnvelope(value));
}

export function readRuntimeCollaborationEvent(
  value: unknown
): RuntimeCollaborationEventEnvelope {
  return readValidation(validateRuntimeCollaborationEventEnvelope(value));
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
