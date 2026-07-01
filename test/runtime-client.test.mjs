import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionRuntimeClientError,
  SkenionRuntimeSessionEventError,
  SkenionRuntimeSessionInfoError,
  advanceRuntimeEventReplayCursorState,
  createRuntimeClient,
  createRuntimeEventReplayCursorState,
  normalizeRuntimeBaseUrl,
  parseRuntimeSessionEvent,
  readRuntimeHealth,
  readRuntimeInfo,
  readRuntimeSessionEvent,
  readRuntimeSessionInfo,
  runtimeEndpointBaseUrl,
  runtimeEventReplayCursorFromInfo,
  runtimeEventReplaySearch,
  runtimeLastEventIdHeaders,
  runtimeSessionEventsUrl,
  runtimeSessionPath,
  runtimeSessionSupportsProfile,
  runtimeSessionUrl,
  runtimeSidecarAuthHeaders,
  summarizeRuntimeConnectionProfile,
  summarizeRuntimeSidecarCapabilities
} from "../dist/index.js";

const localManagedProfile = {
  mode: "local-managed",
  ownership: "owned-child",
  displayName: "Managed local runtime",
  endpoint: {
    url: "http://127.0.0.1:49231",
    canonicalUrl: "http://127.0.0.1:49231/runtime/",
    protocol: "http",
    host: "127.0.0.1",
    port: 49231,
    tls: false
  },
  process: {
    ownedByHost: true,
    pid: 41820,
    executablePath: "/Applications/skenion Studio.app/Contents/Resources/skenion-runtime",
    workingDirectory: "/var/folders/skenion/session-a",
    startedAt: "2026-06-22T00:00:00.000Z",
    ownerWindowId: "window-a",
    platform: "darwin",
    arch: "aarch64"
  }
};

const remoteProfile = {
  mode: "remote",
  ownership: "remote",
  endpoint: {
    url: "https://runtime.example.com/skenion",
    protocol: "https",
    host: "runtime.example.com",
    tls: true
  },
  process: null
};

const sessionInfo = {
  schema: "skenion.runtime.session.info",
  schemaVersion: "0.1.0",
  ok: true,
  sessionId: "session-a",
  lifecycle: "ready",
  snapshot: {
    sessionRevision: 7,
    viewRevision: 2,
    controlRevision: 4,
    project: null,
    issues: [],
    plan: null
  },
  profile: localManagedProfile,
  capabilities: {
    sessionAddressing: true,
    eventReplay: true,
    multiWindow: true,
    profiles: ["local-managed", "local-shared", "remote"],
    authPolicy: "deferred"
  },
  eventReplay: {
    cursorKind: "sequence",
    currentCursor: "7",
    earliestSequence: 1,
    latestSequence: 7,
    replayLimit: 512,
    overflow: false
  },
  issues: []
};

const sessionEvent = {
  schema: "skenion.runtime.session.event",
  schemaVersion: "0.1.0",
  id: "event-8",
  sessionId: "session-a",
  sequence: 8,
  sessionRevision: 7,
  kind: "snapshot",
  snapshot: {
    sessionRevision: 7,
    viewRevision: 2,
    controlRevision: 4,
    project: null,
    issues: [],
    plan: null
  },
  history: {
    schema: "skenion.runtime.history",
    schemaVersion: "0.1.0",
    entries: [],
    canUndo: false,
    canRedo: false,
    undoDepth: 0,
    redoDepth: 0
  },
  replay: {
    cursor: "8",
    previousCursor: "7",
    replayed: true,
    gap: {
      expectedSequence: 4,
      actualSequence: 8,
      reason: "retention-overflow"
    },
    overflow: true
  },
  issues: [
    {
      severity: "warning",
      message: "Requested replay cursor is older than the retained event window."
    }
  ],
  createdAt: "2026-06-22T00:00:01.000Z"
};

const runtimeInfo = {
  name: "skenion-runtime",
  version: "0.39.0",
  apiVersion: "0.1.0",
  capabilities: [
    "session.addressing",
    "session.events.replay",
    "runtime.profile.localManaged",
    "runtime.profile.localShared",
    "runtime.profile.remote"
  ]
};

const runtimeHealth = {
  ok: true,
  service: "skenion-runtime",
  version: "0.39.0",
  apiVersion: "0.1.0"
};

const startupResponse = {
  schema: "skenion.runtime.sidecar.startup",
  schemaVersion: "0.1.0",
  ok: true,
  runtime: runtimeInfo,
  endpoint: localManagedProfile.endpoint,
  profile: localManagedProfile,
  defaultSessionId: "default",
  defaultSessionUrl: "http://127.0.0.1:49231/v0/sessions/default",
  health: {
    ok: true,
    url: "http://127.0.0.1:49231/v0/sidecar/health"
  },
  token: {
    required: true,
    header: "Authorization",
    token: "Bearer token-a"
  },
  shutdown: {
    supported: true,
    method: "POST",
    url: "http://127.0.0.1:49231/v0/sidecar/shutdown",
    scope: "owned-child-only"
  },
  issues: []
};

const healthResponse = {
  schema: "skenion.runtime.sidecar.health",
  schemaVersion: "0.1.0",
  ok: true,
  readiness: "ready",
  runtime: runtimeInfo,
  endpoint: remoteProfile.endpoint,
  profile: remoteProfile,
  issues: []
};

test("runtime session URL helpers cover default and explicit session routes", () => {
  assert.equal(normalizeRuntimeBaseUrl("http://127.0.0.1:3761/"), "http://127.0.0.1:3761");
  assert.equal(normalizeRuntimeBaseUrl("https://runtime.example.com/skenion/?x=1#hash"), "https://runtime.example.com/skenion");
  assert.equal(runtimeSessionPath(), "/v0/sessions/default");
  assert.equal(runtimeSessionPath({ sessionId: null, route: "info" }), "/v0/sessions/default/info");
  assert.equal(
    runtimeSessionPath({ sessionId: "window/a", route: "events/stream" }),
    "/v0/sessions/window%2Fa/events/stream"
  );

  assert.equal(
    runtimeSessionUrl("https://runtime.example.com/skenion/", {
      route: "info",
      search: {
        profile: "remote",
        dry: true,
        skipNull: null,
        skipUndefined: undefined
      }
    }).toString(),
    "https://runtime.example.com/skenion/v0/sessions/default/info?profile=remote&dry=true"
  );

  assert.equal(
    runtimeSessionEventsUrl("http://127.0.0.1:3761", {
      sessionId: "session-a",
      after: "8"
    }).toString(),
    "http://127.0.0.1:3761/v0/sessions/session-a/events/stream?after=8"
  );

  assert.throws(
    () => runtimeSessionPath({ sessionId: "   " }),
    SkenionRuntimeClientError
  );
  assert.throws(
    () => runtimeSessionEventsUrl("http://127.0.0.1:3761", { after: "cursor-a" }),
    SkenionRuntimeClientError
  );
});

test("runtime client helper carries base URL and switches sessions", () => {
  const client = createRuntimeClient({
    baseUrl: "https://runtime.example.com/skenion/",
    sessionId: "session-a"
  });

  assert.equal(client.baseUrl, "https://runtime.example.com/skenion");
  assert.equal(client.sessionId, "session-a");
  assert.equal(client.sessionPath("operation"), "/v0/sessions/session-a/operation");
  assert.equal(
    client.sessionUrl({ route: "info" }).toString(),
    "https://runtime.example.com/skenion/v0/sessions/session-a/info"
  );
  assert.equal(
    client.eventsUrl(12).toString(),
    "https://runtime.example.com/skenion/v0/sessions/session-a/events/stream?after=12"
  );

  const defaultClient = client.withSession(null);
  assert.equal(defaultClient.sessionId, "default");
  assert.equal(defaultClient.sessionPath(), "/v0/sessions/default");
  assert.equal(
    defaultClient.eventsUrl().toString(),
    "https://runtime.example.com/skenion/v0/sessions/default/events/stream"
  );
});

test("runtime event replay cursor helpers build reconnect headers and queries", () => {
  const empty = createRuntimeEventReplayCursorState();
  assert.deepEqual(empty, {
    cursor: null,
    lastEventId: null,
    after: null,
    gap: null,
    overflow: false,
    replayed: false
  });
  assert.deepEqual(runtimeLastEventIdHeaders(null), {});
  assert.deepEqual(runtimeEventReplaySearch(undefined), {});

  const fromNumber = createRuntimeEventReplayCursorState(7);
  assert.equal(fromNumber.cursor, "7");
  assert.deepEqual(runtimeLastEventIdHeaders(fromNumber), { "Last-Event-ID": "7" });
  assert.deepEqual(runtimeEventReplaySearch("7"), { after: "7" });

  const fromInfo = runtimeEventReplayCursorFromInfo(sessionInfo);
  assert.equal(fromInfo.cursor, "7");

  const advanced = advanceRuntimeEventReplayCursorState(fromInfo, sessionEvent);
  assert.equal(advanced.cursor, "8");
  assert.equal(advanced.lastEventId, "8");
  assert.equal(advanced.after, "8");
  assert.equal(advanced.replayed, true);
  assert.equal(advanced.overflow, true);
  assert.equal(advanced.gap.reason, "retention-overflow");

  assert.throws(
    () => createRuntimeEventReplayCursorState("last"),
    SkenionRuntimeClientError
  );
});

test("runtime session info and event readers validate SDK-owned transport shapes", () => {
  assert.equal(readRuntimeSessionInfo(sessionInfo).sessionId, "session-a");
  assert.equal(readRuntimeSessionEvent(sessionEvent).replay.cursor, "8");
  assert.equal(parseRuntimeSessionEvent(JSON.stringify(sessionEvent)).id, "event-8");
  assert.equal(parseRuntimeSessionEvent({ data: JSON.stringify(sessionEvent) }).sequence, 8);

  assert.throws(
    () => readRuntimeSessionInfo({ ...sessionInfo, sessionId: "" }),
    SkenionRuntimeSessionInfoError
  );
  assert.throws(
    () => readRuntimeSessionInfo({
      ...sessionInfo,
      eventReplay: {
        ...sessionInfo.eventReplay,
        replayLimit: "many"
      }
    }),
    SkenionRuntimeSessionInfoError
  );
  assert.throws(
    () => readRuntimeSessionEvent({
      ...sessionEvent,
      snapshot: { ...sessionEvent.snapshot, sessionRevision: 9 }
    }),
    SkenionRuntimeSessionEventError
  );
  assert.throws(
    () => parseRuntimeSessionEvent(JSON.stringify({ schema: "not-a-session-event" })),
    SkenionRuntimeSessionEventError
  );
  assert.throws(
    () => parseRuntimeSessionEvent("{"),
    SkenionRuntimeSessionEventError
  );
});

test("runtime health and info helpers use SDK-owned runtime HTTP guards", () => {
  assert.equal(readRuntimeHealth(runtimeHealth).service, "skenion-runtime");
  assert.equal(readRuntimeInfo(runtimeInfo).version, "0.39.0");

  assert.throws(
    () => readRuntimeHealth({ ok: true, service: "skenion-runtime" }),
    SkenionRuntimeClientError
  );
  assert.throws(
    () => readRuntimeInfo({ name: "skenion-runtime", version: "0.39.0" }),
    SkenionRuntimeClientError
  );
});

test("runtime profile and sidecar helpers summarize ownership and startup capability", () => {
  assert.equal(runtimeEndpointBaseUrl(localManagedProfile), "http://127.0.0.1:49231/runtime");
  assert.equal(runtimeEndpointBaseUrl(remoteProfile), "https://runtime.example.com/skenion");
  assert.equal(runtimeSessionSupportsProfile(sessionInfo.capabilities, "local-managed"), true);
  assert.equal(runtimeSessionSupportsProfile(sessionInfo.capabilities, "remote"), true);
  assert.equal(runtimeSessionSupportsProfile(
    { ...sessionInfo.capabilities, profiles: ["remote"] },
    "local-managed"
  ), false);

  assert.deepEqual(summarizeRuntimeConnectionProfile(localManagedProfile), {
    mode: "local-managed",
    ownership: "owned-child",
    endpointUrl: "http://127.0.0.1:49231/runtime",
    ownsProcess: true
  });
  assert.deepEqual(summarizeRuntimeConnectionProfile(remoteProfile), {
    mode: "remote",
    ownership: "remote",
    endpointUrl: "https://runtime.example.com/skenion",
    ownsProcess: false
  });

  const startup = summarizeRuntimeSidecarCapabilities(startupResponse);
  assert.equal(startup.ok, true);
  assert.equal(startup.mode, "local-managed");
  assert.equal(startup.ownsProcess, true);
  assert.equal(startup.tokenRequired, true);
  assert.equal(startup.tokenHeader, "Authorization");
  assert.equal(startup.shutdownSupported, true);
  assert.equal(startup.shutdownScope, "owned-child-only");
  assert.equal(startup.defaultSessionId, "default");
  assert.equal(startup.healthUrl, "http://127.0.0.1:49231/v0/sidecar/health");

  const health = summarizeRuntimeSidecarCapabilities(healthResponse);
  assert.equal(health.mode, "remote");
  assert.equal(health.ownsProcess, false);
  assert.equal(health.tokenRequired, false);
  assert.equal(health.tokenHeader, null);
  assert.equal(health.shutdownSupported, false);
  assert.equal(health.defaultSessionId, null);
  assert.equal(health.healthUrl, null);
});

test("sidecar auth headers only include startup tokens when present", () => {
  assert.deepEqual(runtimeSidecarAuthHeaders(startupResponse, { Accept: "application/json" }), {
    Accept: "application/json",
    Authorization: "Bearer token-a"
  });
  assert.deepEqual(
    runtimeSidecarAuthHeaders({
      ...startupResponse,
      token: { required: true, header: "Authorization" }
    }),
    {}
  );
  assert.deepEqual(
    runtimeSidecarAuthHeaders({
      ...startupResponse,
      token: { required: false, header: "Authorization", token: "Bearer ignored" }
    }),
    {}
  );
});
