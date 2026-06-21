import {
  isRuntimeHealth,
  isRuntimeInfo,
  validateRuntimeSessionEvent,
  validateRuntimeSessionInfoResponse
} from "@skenion/contracts";
import type {
  RuntimeConnectionProfile,
  RuntimeConnectionProfileMode,
  RuntimeDiagnosticV01,
  RuntimeEndpointMetadata,
  RuntimeEventReplayGap,
  RuntimeHealth,
  RuntimeInfo,
  RuntimeOwnershipMode,
  RuntimeProcessMetadata,
  RuntimeSessionCapabilitySet,
  RuntimeSessionEvent,
  RuntimeSessionInfoResponse
} from "@skenion/contracts";

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
  | "history"
  | "undo"
  | "redo"
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
  readonly sessionId: string | null;
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
  diagnostics: RuntimeDiagnosticV01[];
}

export interface RuntimeSidecarHealthResponse {
  schema: "skenion.runtime.sidecar.health";
  schemaVersion: "0.1.0";
  ok: boolean;
  readiness: string;
  runtime: RuntimeSidecarRuntimeInfo;
  endpoint: RuntimeEndpointMetadata;
  profile: RuntimeConnectionProfile;
  diagnostics: RuntimeDiagnosticV01[];
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
    super(`Invalid Skenion Runtime client value: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeClientError";
    this.errors = errors;
  }
}

export class SkenionRuntimeSessionInfoError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion Runtime session info: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeSessionInfoError";
    this.errors = errors;
  }
}

export class SkenionRuntimeSessionEventError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion Runtime session event: ${errors.join("; ")}`);
    this.name = "SkenionRuntimeSessionEventError";
    this.errors = errors;
  }
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

function normalizeSessionId(sessionId: string | null | undefined): string | null {
  if (sessionId === null || sessionId === undefined) {
    return null;
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
  const basePath = sessionId === null
    ? "/v0/session"
    : `/v0/sessions/${encodeURIComponent(sessionId)}`;
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
  const validation = validateRuntimeSessionInfoResponse(info);
  if (!validation.ok) {
    throw new SkenionRuntimeSessionInfoError(validation.errors);
  }

  return validation.value;
}

export function readRuntimeSessionEvent(event: unknown): RuntimeSessionEvent {
  const validation = validateRuntimeSessionEvent(event);
  if (!validation.ok) {
    throw new SkenionRuntimeSessionEventError(validation.errors);
  }

  return validation.value;
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
  if (!isRuntimeHealth(value)) {
    throw new SkenionRuntimeClientError(["invalid runtime health response"]);
  }
  return value;
}

export function readRuntimeInfo(value: unknown): RuntimeInfo {
  if (!isRuntimeInfo(value)) {
    throw new SkenionRuntimeClientError(["invalid runtime info response"]);
  }
  return value;
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
