export type RuntimeIssueSeverityV01 = "error" | "warning" | "info";

export type RuntimeIssueDetails =
  | string
  | number
  | boolean
  | null
  | RuntimeIssueDetails[]
  | { [key: string]: RuntimeIssueDetails };

export interface RuntimeIssueV01 {
  severity: RuntimeIssueSeverityV01;
  message: string;
  code?: string;
  details?: RuntimeIssueDetails;
}

export interface RuntimeHealth {
  ok: boolean;
  service: string;
  version: string;
  apiVersion?: string;
}

export interface RuntimeInfo {
  name: string;
  version: string;
  apiVersion: string;
  capabilities: string[];
}

export type RuntimeSessionLifecycleState = "initializing" | "ready" | "closing" | "closed" | "error";
export type RuntimeConnectionProfileMode = "local-managed" | "local-shared" | "remote";
export type RuntimeOwnershipMode = "owned-child" | "external" | "remote";

export interface RuntimeEndpointMetadata {
  url: string;
  canonicalUrl?: string;
  protocol: "http" | "https";
  host?: string;
  port?: number;
  tls?: boolean;
}

export interface RuntimeProcessMetadata {
  ownedByHost: boolean;
  pid?: number;
  executablePath?: string;
  workingDirectory?: string;
  startedAt?: string;
  ownerWindowId?: string;
  platform?: string;
  arch?: string;
}

interface RuntimeConnectionProfileBase {
  displayName?: string;
  endpoint: RuntimeEndpointMetadata;
  process?: RuntimeProcessMetadata | null;
}

export type RuntimeConnectionProfile =
  | (RuntimeConnectionProfileBase & {
      mode: "local-managed";
      ownership: "owned-child";
    })
  | (RuntimeConnectionProfileBase & {
      mode: "local-shared";
      ownership: "external";
    })
  | (RuntimeConnectionProfileBase & {
      mode: "remote";
      ownership: "remote";
    });

export interface RuntimeEventReplayWindow {
  cursorKind: "sequence";
  currentCursor: string;
  earliestSequence: number;
  latestSequence: number;
  replayLimit: number | null;
  overflow?: boolean;
}

export interface RuntimeSessionCapabilitySet {
  sessionAddressing: boolean;
  eventReplay: boolean;
  multiWindow: boolean;
  profiles: RuntimeConnectionProfileMode[];
  authPolicy: "deferred";
}

export interface RuntimeSessionSnapshot {
  sessionRevision: number;
  viewRevision: number;
  controlRevision: number;
  project: unknown;
  issues: RuntimeIssueV01[];
  plan: Record<string, unknown> | null;
}

export interface RuntimeSessionInfoResponse {
  schema: "skenion.runtime.session.info";
  schemaVersion: "0.1.0";
  ok: boolean;
  sessionId: string;
  lifecycle: RuntimeSessionLifecycleState;
  snapshot: RuntimeSessionSnapshot;
  profile: RuntimeConnectionProfile;
  capabilities: RuntimeSessionCapabilitySet;
  eventReplay: RuntimeEventReplayWindow;
  issues: RuntimeIssueV01[];
}

export interface RuntimeHistory {
  schema: "skenion.runtime.history";
  schemaVersion: "0.1.0";
  entries: Record<string, unknown>[];
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export type RuntimeSessionEventKind = "snapshot" | "load" | "clear" | "mutate" | "undo" | "redo";

export interface RuntimeEventReplayGap {
  expectedSequence: number;
  actualSequence: number;
  reason: "retention-overflow" | "stream-reset" | "unknown";
}

export interface RuntimeEventReplayMetadata {
  cursor: string;
  previousCursor: string | null;
  replayed: boolean;
  gap: RuntimeEventReplayGap | null;
  overflow: boolean;
}

export interface RuntimeSessionEvent {
  schema: "skenion.runtime.session.event";
  schemaVersion: "0.1.0";
  id: string;
  sessionId: string;
  sequence: number;
  sessionRevision: number;
  kind: RuntimeSessionEventKind;
  snapshot: RuntimeSessionSnapshot;
  history: RuntimeHistory;
  mutation?: Record<string, unknown>;
  replay: RuntimeEventReplayMetadata;
  issues: RuntimeIssueV01[];
  createdAt: string;
}

export type RuntimeSessionRoute =
  | ""
  | "info"
  | "events/stream"
  | "load"
  | "validate"
  | "plan"
  | "run"
  | "mutate"
  | "operation"
  | "operations"
  | "history"
  | "undo"
  | "redo"
  | "collaboration/presence"
  | "collaboration/selection"
  | "control/event"
  | "control/state"
  | "control/read"
  | "preview"
  | "preview/start"
  | "preview/stop"
  | "preview/restart"
  | "render/generated-shader"
  | "telemetry"
  | "telemetry/stream";

export interface RuntimeSessionAddress {
  sessionId?: string | null;
  route?: RuntimeSessionRoute;
}

export interface RuntimeSessionUrlOptions extends RuntimeSessionAddress {
  after?: RuntimeEventReplayCursorInput;
  search?: Record<string, string | number | boolean | null | undefined>;
}

export interface RuntimeClientOptions {
  baseUrl: string | URL;
  sessionId?: string | null;
}

export interface RuntimeClient {
  readonly baseUrl: string;
  readonly sessionId: string;
  sessionPath(route?: RuntimeSessionRoute): string;
  sessionUrl(options?: Omit<RuntimeSessionUrlOptions, "sessionId">): URL;
  eventsUrl(cursor?: RuntimeEventReplayCursorInput): URL;
  withSession(sessionId: string | null): RuntimeClient;
}

export interface RuntimeEventReplayCursorState {
  cursor: string | null;
  lastEventId: string | null;
  after: string | null;
  gap: RuntimeEventReplayGap | null;
  overflow: boolean;
  replayed: boolean;
}

export type RuntimeEventReplayCursorInput =
  | RuntimeEventReplayCursorState
  | string
  | number
  | null
  | undefined;

export interface RuntimeConnectionProfileSummary {
  mode: RuntimeConnectionProfileMode;
  ownership: RuntimeOwnershipMode;
  endpointUrl: string;
  ownsProcess: boolean;
}

export interface RuntimeSidecarRuntimeInfo {
  name: string;
  version: string;
  apiVersion: string;
}

export interface RuntimeSidecarTokenInfo {
  required: boolean;
  header: string;
  token?: string;
}

export interface RuntimeSidecarShutdownInfo {
  supported: boolean;
  method: string;
  url: string;
  scope: string;
}

export interface RuntimeSidecarHealthInfo {
  ok: boolean;
  url: string;
}

export interface RuntimeSidecarStartupResponse {
  schema: "skenion.runtime.sidecar.startup";
  schemaVersion: "0.1.0";
  ok: boolean;
  runtime: RuntimeSidecarRuntimeInfo;
  endpoint: RuntimeEndpointMetadata;
  profile: RuntimeConnectionProfile;
  defaultSessionId: string;
  defaultSessionUrl: string;
  health: RuntimeSidecarHealthInfo;
  token: RuntimeSidecarTokenInfo;
  shutdown: RuntimeSidecarShutdownInfo;
  issues: RuntimeIssueV01[];
}

export interface RuntimeSidecarHealthResponse {
  schema: "skenion.runtime.sidecar.health";
  schemaVersion: "0.1.0";
  ok: boolean;
  readiness: string;
  runtime: RuntimeSidecarRuntimeInfo;
  endpoint: RuntimeEndpointMetadata;
  profile: RuntimeConnectionProfile;
  issues: RuntimeIssueV01[];
}

export type RuntimeSidecarResponse =
  | RuntimeSidecarStartupResponse
  | RuntimeSidecarHealthResponse;

export interface RuntimeSidecarCapabilitySummary extends RuntimeConnectionProfileSummary {
  ok: boolean;
  runtimeVersion: string;
  apiVersion: string;
  tokenRequired: boolean;
  tokenHeader: string | null;
  shutdownSupported: boolean;
  shutdownScope: string | null;
  defaultSessionId: string | null;
  defaultSessionUrl: string | null;
  healthUrl: string | null;
}

export class SkenionRuntimeClientError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion runtime client value: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeClientError";
    this.errors = errors;
  }
}

export class SkenionRuntimeSessionInfoError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion runtime session info: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeSessionInfoError";
    this.errors = errors;
  }
}

export class SkenionRuntimeSessionEventError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion runtime session event: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeSessionEventError";
    this.errors = errors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function requireRecord(value: unknown, path: string, errors: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push(`${path} must be object`);
  }
  return recordValue(value);
}

function requireString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string") {
    errors.push(`${path} must be string`);
  }
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

function requireBoolean(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be boolean`);
  }
}

function requireStringArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    errors.push(`${path} must be an array of strings`);
  }
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

function runtimeSessionInfoErrors(info: unknown): string[] {
  const errors: string[] = [];
  const value = requireRecord(info, "/", errors);
  const snapshot = requireRecord(value.snapshot, "/snapshot", errors);
  const profile = requireRecord(value.profile, "/profile", errors);
  const endpoint = requireRecord(profile.endpoint, "/profile/endpoint", errors);
  const capabilities = requireRecord(value.capabilities, "/capabilities", errors);
  const replay = requireRecord(value.eventReplay, "/eventReplay", errors);

  requireLiteral(value.schema, "skenion.runtime.session.info", "/schema", errors);
  requireLiteral(value.schemaVersion, "0.1.0", "/schemaVersion", errors);
  requireBoolean(value.ok, "/ok", errors);
  requireNonEmptyString(value.sessionId, "/sessionId", errors);
  requireOneOf(value.lifecycle, ["initializing", "ready", "closing", "closed", "error"], "/lifecycle", errors);
  requireNumber(snapshot.sessionRevision, "/snapshot/sessionRevision", errors);
  requireNumber(snapshot.viewRevision, "/snapshot/viewRevision", errors);
  requireNumber(snapshot.controlRevision, "/snapshot/controlRevision", errors);
  requireString(endpoint.url, "/profile/endpoint/url", errors);
  requireOneOf(profile.mode, ["local-managed", "local-shared", "remote"], "/profile/mode", errors);
  requireOneOf(profile.ownership, ["owned-child", "external", "remote"], "/profile/ownership", errors);
  requireBoolean(capabilities.sessionAddressing, "/capabilities/sessionAddressing", errors);
  requireBoolean(capabilities.eventReplay, "/capabilities/eventReplay", errors);
  requireBoolean(capabilities.multiWindow, "/capabilities/multiWindow", errors);
  requireStringArray(capabilities.profiles, "/capabilities/profiles", errors);
  requireLiteral(capabilities.authPolicy, "deferred", "/capabilities/authPolicy", errors);
  requireLiteral(replay.cursorKind, "sequence", "/eventReplay/cursorKind", errors);
  requireNonEmptyString(replay.currentCursor, "/eventReplay/currentCursor", errors);
  requireNumber(replay.earliestSequence, "/eventReplay/earliestSequence", errors);
  requireNumber(replay.latestSequence, "/eventReplay/latestSequence", errors);

  if (
    replay.replayLimit !== null &&
    (typeof replay.replayLimit !== "number" || !Number.isFinite(replay.replayLimit))
  ) {
    errors.push("/eventReplay/replayLimit must be number or null");
  }

  return errors;
}

function runtimeSessionEventErrors(event: unknown): string[] {
  const errors: string[] = [];
  const value = requireRecord(event, "/", errors);
  const snapshot = requireRecord(value.snapshot, "/snapshot", errors);
  const history = requireRecord(value.history, "/history", errors);
  const replay = requireRecord(value.replay, "/replay", errors);

  requireLiteral(value.schema, "skenion.runtime.session.event", "/schema", errors);
  requireLiteral(value.schemaVersion, "0.1.0", "/schemaVersion", errors);
  requireNonEmptyString(value.id, "/id", errors);
  requireNonEmptyString(value.sessionId, "/sessionId", errors);
  requireNumber(value.sequence, "/sequence", errors);
  requireNumber(value.sessionRevision, "/sessionRevision", errors);
  requireOneOf(value.kind, ["snapshot", "load", "clear", "mutate", "undo", "redo"], "/kind", errors);
  requireNumber(snapshot.sessionRevision, "/snapshot/sessionRevision", errors);
  requireLiteral(history.schema, "skenion.runtime.history", "/history/schema", errors);
  requireLiteral(history.schemaVersion, "0.1.0", "/history/schemaVersion", errors);
  requireNonEmptyString(replay.cursor, "/replay/cursor", errors);
  requireBoolean(replay.replayed, "/replay/replayed", errors);
  requireBoolean(replay.overflow, "/replay/overflow", errors);
  requireString(value.createdAt, "/createdAt", errors);

  if (
    typeof value.sessionRevision === "number" &&
    typeof snapshot.sessionRevision === "number" &&
    value.sessionRevision !== snapshot.sessionRevision
  ) {
    errors.push("/snapshot/sessionRevision must match /sessionRevision");
  }

  return errors;
}

function runtimeHealthErrors(value: unknown): string[] {
  const errors: string[] = [];
  const health = requireRecord(value, "/", errors);
  requireBoolean(health.ok, "/ok", errors);
  requireNonEmptyString(health.service, "/service", errors);
  requireNonEmptyString(health.version, "/version", errors);
  return errors;
}

function runtimeInfoErrors(value: unknown): string[] {
  const errors: string[] = [];
  const info = requireRecord(value, "/", errors);
  requireNonEmptyString(info.name, "/name", errors);
  requireNonEmptyString(info.version, "/version", errors);
  requireNonEmptyString(info.apiVersion, "/apiVersion", errors);
  requireStringArray(info.capabilities, "/capabilities", errors);
  return errors;
}

function normalizedBaseUrl(baseUrl: string | URL): URL {
  const url = new URL(baseUrl);
  url.pathname = trimTrailingSlash(url.pathname);
  url.search = "";
  url.hash = "";
  return url;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value;
}

const DEFAULT_RUNTIME_SESSION_ID = "default";

function normalizeSessionId(sessionId: string | null | undefined): string {
  if (sessionId === null || sessionId === undefined) {
    return DEFAULT_RUNTIME_SESSION_ID;
  }

  const normalized = sessionId.trim();
  if (normalized.length === 0) {
    throw new SkenionRuntimeClientError(["sessionId must not be empty"]);
  }

  return normalized;
}

function normalizeRoute(route: RuntimeSessionRoute | undefined): string {
  return route === undefined ? "" : route.replace(/^\/+|\/+$/g, "");
}

function joinPath(...segments: string[]): string {
  return `/${segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter((segment) => segment.length > 0)
    .join("/")}`;
}

function cursorValue(cursor: RuntimeEventReplayCursorInput): string | null {
  if (cursor === null || cursor === undefined) {
    return null;
  }
  if (typeof cursor === "number") {
    return String(cursor);
  }
  if (typeof cursor === "string") {
    return cursor;
  }
  return cursor.cursor;
}

function assertCursor(cursor: string | null): string | null {
  if (cursor === null) {
    return null;
  }
  if (!/^\d+$/.test(cursor)) {
    throw new SkenionRuntimeClientError(["runtime event replay cursor must be a non-negative integer string"]);
  }
  return cursor;
}

function routeSearch(
  url: URL,
  after: RuntimeEventReplayCursorInput,
  search: Record<string, string | number | boolean | null | undefined> | undefined
): URL {
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const cursor = assertCursor(cursorValue(after));
  if (cursor !== null) {
    url.searchParams.set("after", cursor);
  }

  return url;
}

function runtimeProfileSummary(profile: RuntimeConnectionProfile): RuntimeConnectionProfileSummary {
  const ownsProcess =
    profile.mode === "local-managed" &&
    profile.ownership === "owned-child" &&
    profile.process?.ownedByHost === true;
  return {
    mode: profile.mode,
    ownership: profile.ownership,
    endpointUrl: runtimeEndpointBaseUrl(profile),
    ownsProcess
  };
}

function isStartupResponse(response: RuntimeSidecarResponse): response is RuntimeSidecarStartupResponse {
  return response.schema === "skenion.runtime.sidecar.startup";
}

export function normalizeRuntimeBaseUrl(baseUrl: string | URL): string {
  return normalizedBaseUrl(baseUrl).toString().replace(/\/$/, "");
}

export function runtimeSessionPath(address: RuntimeSessionAddress = {}): string {
  const sessionId = normalizeSessionId(address.sessionId);
  const basePath = `/v0/sessions/${encodeURIComponent(sessionId)}`;
  const route = normalizeRoute(address.route);
  return route.length === 0 ? basePath : `${basePath}/${route}`;
}

export function runtimeSessionUrl(
  baseUrl: string | URL,
  options: RuntimeSessionUrlOptions = {}
): URL {
  const url = normalizedBaseUrl(baseUrl);
  url.pathname = joinPath(url.pathname, runtimeSessionPath(options));
  return routeSearch(url, options.after, options.search);
}

export function runtimeSessionEventsUrl(
  baseUrl: string | URL,
  options: Omit<RuntimeSessionUrlOptions, "route"> = {}
): URL {
  return runtimeSessionUrl(baseUrl, {
    ...options,
    route: "events/stream"
  });
}

export function createRuntimeClient(options: RuntimeClientOptions): RuntimeClient {
  const baseUrl = normalizeRuntimeBaseUrl(options.baseUrl);
  const sessionId = normalizeSessionId(options.sessionId);
  return {
    baseUrl,
    sessionId,
    sessionPath: (route = "") => runtimeSessionPath({ sessionId, route }),
    sessionUrl: (urlOptions = {}) => runtimeSessionUrl(baseUrl, { ...urlOptions, sessionId }),
    eventsUrl: (cursor = null) => runtimeSessionEventsUrl(baseUrl, { sessionId, after: cursor }),
    withSession: (nextSessionId) => createRuntimeClient({ baseUrl, sessionId: nextSessionId })
  };
}

export function createRuntimeEventReplayCursorState(
  cursor: RuntimeEventReplayCursorInput = null
): RuntimeEventReplayCursorState {
  const value = assertCursor(cursorValue(cursor));
  return {
    cursor: value,
    lastEventId: value,
    after: value,
    gap: null,
    overflow: false,
    replayed: false
  };
}

export function advanceRuntimeEventReplayCursorState(
  state: RuntimeEventReplayCursorState,
  event: unknown
): RuntimeEventReplayCursorState {
  const value = readRuntimeSessionEvent(event);
  return {
    ...state,
    cursor: value.replay.cursor,
    lastEventId: value.replay.cursor,
    after: value.replay.cursor,
    gap: value.replay.gap,
    overflow: value.replay.overflow,
    replayed: value.replay.replayed
  };
}

export function runtimeEventReplayCursorFromInfo(info: unknown): RuntimeEventReplayCursorState {
  const value = readRuntimeSessionInfo(info);
  return createRuntimeEventReplayCursorState(value.eventReplay.currentCursor);
}

export function runtimeLastEventIdHeaders(
  cursor: RuntimeEventReplayCursorInput
): Record<string, string> {
  const value = assertCursor(cursorValue(cursor));
  return value === null ? {} : { "Last-Event-ID": value };
}

export function runtimeEventReplaySearch(
  cursor: RuntimeEventReplayCursorInput
): Record<string, string> {
  const value = assertCursor(cursorValue(cursor));
  return value === null ? {} : { after: value };
}

export function readRuntimeSessionInfo(info: unknown): RuntimeSessionInfoResponse {
  const errors = runtimeSessionInfoErrors(info);
  if (errors.length > 0) {
    throw new SkenionRuntimeSessionInfoError(errors);
  }

  return info as RuntimeSessionInfoResponse;
}

export function readRuntimeSessionEvent(event: unknown): RuntimeSessionEvent {
  const errors = runtimeSessionEventErrors(event);
  if (errors.length > 0) {
    throw new SkenionRuntimeSessionEventError(errors);
  }

  return event as RuntimeSessionEvent;
}

export function parseRuntimeSessionEvent(message: string | { data: string }): RuntimeSessionEvent {
  const data = typeof message === "string" ? message : message.data;
  try {
    return readRuntimeSessionEvent(JSON.parse(data));
  } catch (error) {
    if (error instanceof SkenionRuntimeSessionEventError) {
      throw error;
    }
    throw new SkenionRuntimeSessionEventError([`invalid session event JSON: ${String(error)}`]);
  }
}

export function readRuntimeHealth(value: unknown): RuntimeHealth {
  const errors = runtimeHealthErrors(value);
  if (errors.length > 0) {
    throw new SkenionRuntimeClientError(errors);
  }
  return value as RuntimeHealth;
}

export function readRuntimeInfo(value: unknown): RuntimeInfo {
  const errors = runtimeInfoErrors(value);
  if (errors.length > 0) {
    throw new SkenionRuntimeClientError(errors);
  }
  return value as RuntimeInfo;
}

export function runtimeEndpointBaseUrl(profile: RuntimeConnectionProfile): string {
  return normalizeRuntimeBaseUrl(profile.endpoint.canonicalUrl ?? profile.endpoint.url);
}

export function runtimeSessionSupportsProfile(
  capabilities: RuntimeSessionCapabilitySet,
  mode: RuntimeConnectionProfileMode
): boolean {
  return capabilities.profiles.includes(mode);
}

export function summarizeRuntimeConnectionProfile(
  profile: RuntimeConnectionProfile
): RuntimeConnectionProfileSummary {
  return runtimeProfileSummary(profile);
}

export function summarizeRuntimeSidecarCapabilities(
  response: RuntimeSidecarResponse
): RuntimeSidecarCapabilitySummary {
  const profile = runtimeProfileSummary(response.profile);
  const startup = isStartupResponse(response);
  return {
    ...profile,
    ok: response.ok,
    runtimeVersion: response.runtime.version,
    apiVersion: response.runtime.apiVersion,
    tokenRequired: startup ? response.token.required : false,
    tokenHeader: startup ? response.token.header : null,
    shutdownSupported: startup ? response.shutdown.supported : false,
    shutdownScope: startup ? response.shutdown.scope : null,
    defaultSessionId: startup ? response.defaultSessionId : null,
    defaultSessionUrl: startup ? response.defaultSessionUrl : null,
    healthUrl: startup ? response.health.url : null
  };
}

export function runtimeSidecarAuthHeaders(
  response: RuntimeSidecarStartupResponse,
  headers: Record<string, string> = {}
): Record<string, string> {
  if (!response.token.required || response.token.token === undefined) {
    return { ...headers };
  }
  return {
    ...headers,
    [response.token.header]: response.token.token
  };
}
