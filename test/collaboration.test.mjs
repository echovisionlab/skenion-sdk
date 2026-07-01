import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionRuntimeCollaborationError,
  createGraphFragment,
  createPasteGraphFragmentRequest,
  createRuntimeClient,
  createRuntimeCollaborationCausalMetadata,
  createRuntimeCollaborationChangeSetOperation,
  createRuntimeCollaborationOperation,
  createRuntimeCollaborationOperationBatch,
  createRuntimeCollaborationPasteOperation,
  createRuntimeCollaborationPresenceEnvelope,
  createRuntimeCollaborationSelectionEnvelope,
  createRuntimeCollaborationUndoRedoOperation,
  isRuntimeCollaborationRebaseStrategy,
  parseRuntimeCollaborationEvent,
  parseRuntimeCollaborationOperationResult,
  readRuntimeCollaborationEvent,
  readRuntimeCollaborationOperation,
  readRuntimeCollaborationOperationBatch,
  readRuntimeCollaborationOperationBatchResult,
  readRuntimeCollaborationOperationResult,
  readRuntimeCollaborationPresence,
  readRuntimeCollaborationSelection,
  runtimeCollaborationRebaseStrategies
} from "../dist/index.js";

const target = {
  path: { kind: "root" },
  baseRevision: "rev-1"
};

const causal = createRuntimeCollaborationCausalMetadata({
  baseRevision: "rev-1",
  baseSequence: 4,
  participantId: "participant-a",
  participantSequence: 3,
  vector: {
    "participant-b": 2
  },
  observedOperationIds: ["op-observed"]
});

const node = {
  id: "node-1",
  objectSpec: "float",
  params: {},
  ports: [
    {
      id: "out",
      direction: "output",
      type: "value.core.float32"
    }
  ]
};

const edge = {
  id: "edge-1",
  source: { nodeId: "node-1", portId: "out" },
  target: { nodeId: "node-2", portId: "in" }
};

function acceptedResult(operation) {
  return {
    schema: "skenion.runtime.collaboration.operation-result",
    schemaVersion: "0.1.0",
    sessionId: operation.sessionId,
    operationId: operation.operationId,
    participantId: operation.participantId,
    idempotencyKey: operation.idempotencyKey,
    status: "accepted",
    causal: operation.causal,
    ack: {
      sequence: 5,
      revision: "rev-2",
      serverClock: {
        revision: "rev-2",
        sequence: 5,
        vector: {
          "participant-a": 4,
          "participant-b": 2
        }
      },
      appliedAt: "2026-06-22T00:00:02.000Z"
    },
    issues: [],
    createdAt: "2026-06-22T00:00:02.000Z"
  };
}

test("collaboration operation builders preserve idempotency and causal metadata", () => {
  assert.deepEqual(
    createRuntimeCollaborationCausalMetadata({
      baseRevision: "rev-0",
      baseSequence: 0,
      participantId: "participant-zero"
    }),
    {
      baseRevision: "rev-0",
      baseSequence: 0,
      vector: {
        "participant-zero": 0
      },
      observedOperationIds: []
    }
  );

  assert.deepEqual(causal, {
    baseRevision: "rev-1",
    baseSequence: 4,
    vector: {
      "participant-b": 2,
      "participant-a": 3
    },
    observedOperationIds: ["op-observed"]
  });

  const operation = createRuntimeCollaborationChangeSetOperation({
    operationId: "op-change-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    target,
    changes: [
      {
        op: "node.add",
        changeId: "change-node-1",
        node,
        view: { x: 16, y: 24 }
      },
      {
        op: "node.move",
        changeId: "change-node-2",
        nodeId: "node-1",
        from: { x: 16, y: 24 },
        to: { x: 40, y: 64 }
      },
      {
        op: "edge.connect",
        changeId: "change-edge-1",
        edge
      },
      {
        op: "edge.disconnect",
        changeId: "change-edge-2",
        edgeId: "edge-0"
      },
      {
        op: "node.delete",
        changeId: "change-node-3",
        nodeId: "node-old",
        tombstoneId: "tombstone-node-old"
      }
    ],
    authSubject: {
      kind: "user",
      subjectId: "user-a",
      displayName: "Ada"
    },
    correlationId: "corr-change-1",
    submittedAt: "2026-06-22T00:00:00.000Z",
    undoGroupId: "undo-group-1",
    description: "Add and move a value node"
  });

  assert.equal(operation.idempotencyKey, "op-change-1");
  assert.equal(operation.payload.kind, "changeSet");
  assert.equal(operation.payload.changes.length, 5);
  assert.equal(operation.payload.undoGroupId, "undo-group-1");
  assert.equal(operation.authSubject.subjectId, "user-a");
  assert.equal(operation.correlationId, "corr-change-1");
  assert.equal(readRuntimeCollaborationOperation(operation), operation);
});

test("collaboration operation builder accepts explicit payloads and idempotency keys", () => {
  const operation = createRuntimeCollaborationOperation({
    operationId: "op-generic-1",
    idempotencyKey: "idempotency-generic-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    payload: {
      kind: "undoRedo",
      action: "redo",
      scope: {
        kind: "participant",
        participantId: "participant-a"
      },
      maxOperations: 1
    },
    submittedAt: "2026-06-22T00:00:00.100Z"
  });

  assert.equal(operation.idempotencyKey, "idempotency-generic-1");
  assert.equal(operation.payload.kind, "undoRedo");
  assert.equal("authSubject" in operation, false);
  assert.equal("correlationId" in operation, false);
});

test("collaboration readers reject malformed SDK-owned envelopes", () => {
  const fragment = createGraphFragment({
    nodes: [node],
    outsideEndpointPolicy: "omit"
  });

  assert.throws(
    () => readRuntimeCollaborationOperation(null),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () =>
      readRuntimeCollaborationOperationBatch({
        schema: "skenion.runtime.collaboration.operation-batch",
        schemaVersion: "0.1.0",
        sessionId: "session-a",
        operations: "not-an-array"
      }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () =>
      createRuntimeCollaborationOperation({
        operationId: "op-invalid-paste",
        sessionId: "session-a",
        participantId: "participant-a",
        causal: {
          baseRevision: "rev-1",
          baseSequence: "four",
          vector: {
            "participant-a": "four"
          }
        },
        payload: {
          kind: "pasteGraphFragment",
          request: {
            target: {
              path: { kind: "root" },
              baseRevision: ""
            },
            fragment
          }
        },
        submittedAt: "2026-06-22T00:00:00.200Z"
      }),
    SkenionRuntimeCollaborationError
  );
});

test("paste and undo collaboration builders validate SDK envelopes and shared paste payloads", () => {
  const fragment = createGraphFragment({
    nodes: [node],
    outsideEndpointPolicy: "omit"
  });
  const request = createPasteGraphFragmentRequest({
    target,
    fragment,
    placement: {
      kind: "position",
      x: 120,
      y: 80
    },
    options: {
      outsideEndpointPolicy: "omit",
      idConflictPolicy: "remap"
    }
  });
  const paste = createRuntimeCollaborationPasteOperation({
    operationId: "op-paste-1",
    idempotencyKey: "paste-key-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    request,
    submittedAt: "2026-06-22T00:00:01.000Z",
    description: "Paste a copied fragment"
  });
  const undo = createRuntimeCollaborationUndoRedoOperation({
    operationId: "op-undo-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    action: "undo",
    subjectOperationId: "op-paste-1",
    undoGroupId: "undo-group-1",
    maxOperations: 3,
    submittedAt: "2026-06-22T00:00:01.500Z"
  });

  assert.equal(paste.payload.kind, "pasteGraphFragment");
  assert.equal(paste.payload.description, "Paste a copied fragment");
  assert.equal(undo.payload.kind, "undoRedo");
  assert.equal(undo.payload.scope.participantId, "participant-a");
  assert.equal(undo.payload.maxOperations, 3);

  assert.throws(
    () =>
      createRuntimeCollaborationOperation({
        operationId: "op-invalid-undo",
        sessionId: "session-a",
        participantId: "participant-a",
        causal,
        payload: {
          kind: "undoRedo",
          action: "undo",
          scope: {
            kind: "participant",
            participantId: "participant-b"
          }
        },
        submittedAt: "2026-06-22T00:00:01.600Z"
      }),
    SkenionRuntimeCollaborationError
  );
});

test("collaboration batch builder validates session and idempotency consistency", () => {
  const first = createRuntimeCollaborationUndoRedoOperation({
    operationId: "op-batch-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    action: "undo",
    submittedAt: "2026-06-22T00:00:03.000Z"
  });
  const second = createRuntimeCollaborationUndoRedoOperation({
    operationId: "op-batch-2",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    action: "redo",
    submittedAt: "2026-06-22T00:00:03.100Z"
  });
  const batch = createRuntimeCollaborationOperationBatch({
    sessionId: "session-a",
    operations: [first, second],
    submittedAt: "2026-06-22T00:00:03.200Z"
  });

  assert.equal(batch.schema, "skenion.runtime.collaboration.operation-batch");
  assert.deepEqual(batch.operations.map((operation) => operation.operationId), ["op-batch-1", "op-batch-2"]);
  assert.equal(readRuntimeCollaborationOperationBatch(batch), batch);
  assert.throws(
    () =>
      createRuntimeCollaborationOperationBatch({
        sessionId: "session-a",
        operations: [first, { ...second, idempotencyKey: first.idempotencyKey }]
      }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () =>
      readRuntimeCollaborationOperationBatch({
        schema: "skenion.runtime.collaboration.operation-batch",
        schemaVersion: "0.1.0",
        sessionId: "session-a",
        operations: [{ ...first, sessionId: "other-session" }]
      }),
    SkenionRuntimeCollaborationError
  );
});

test("presence and selection builders keep participant metadata separate from auth identity", () => {
  const presence = createRuntimeCollaborationPresenceEnvelope({
    sessionId: "session-a",
    participantId: "participant-a",
    presence: {
      state: "active",
      displayName: "Ada",
      color: "#2f80ed",
      statusText: "Editing",
      capabilities: ["graph-edit", "presence", "selection"],
      connectionId: "connection-a",
      clientWindowId: "window-a"
    },
    authSubject: {
      kind: "user",
      subjectId: "user-a",
      issuer: "runtime-dev"
    },
    updatedAt: "2026-06-22T00:00:04.000Z",
    expiresAt: "2026-06-22T00:00:34.000Z"
  });
  const selection = createRuntimeCollaborationSelectionEnvelope({
    sessionId: "session-a",
    participantId: "participant-a",
    target,
    selection: {
      ranges: [
        {
          kind: "nodes",
          nodeIds: ["node-1"]
        },
        {
          kind: "edges",
          edgeIds: ["edge-1"]
        },
        {
          kind: "ports",
          endpoints: [{ nodeId: "node-1", portId: "out" }]
        },
        {
          kind: "text",
          anchor: { nodeId: "node-1", field: "label", offset: 0 },
          focus: { nodeId: "node-1", field: "label", offset: 4 }
        }
      ],
      activeRangeIndex: 0
    },
    cursor: {
      kind: "canvas",
      x: 240,
      y: 180,
      clientWindowId: "window-a"
    },
    updatedAt: "2026-06-22T00:00:04.000Z",
    expiresAt: "2026-06-22T00:00:14.000Z"
  });

  assert.equal(presence.authSubject.subjectId, "user-a");
  assert.equal(readRuntimeCollaborationPresence(presence), presence);
  assert.deepEqual(selection.selection.ranges.map((range) => range.kind), ["nodes", "edges", "ports", "text"]);
  assert.equal(selection.cursor.kind, "canvas");
  assert.equal(readRuntimeCollaborationSelection(selection), selection);
  assert.throws(
    () =>
      createRuntimeCollaborationPresenceEnvelope({
        ...presence,
        authSubject: {
          kind: "user",
          subjectId: "participant-a"
        }
      }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () =>
      createRuntimeCollaborationSelectionEnvelope({
        ...selection,
        expiresAt: "2026-06-22T00:00:03.000Z"
      }),
    SkenionRuntimeCollaborationError
  );
});

test("collaboration result and event readers parse valid envelopes and reject invalid ones", () => {
  const operation = createRuntimeCollaborationUndoRedoOperation({
    operationId: "op-result-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    action: "redo",
    submittedAt: "2026-06-22T00:00:05.000Z"
  });
  const result = acceptedResult(operation);
  const event = {
    schema: "skenion.runtime.collaboration.event",
    schemaVersion: "0.1.0",
    eventId: "event-6",
    sessionId: "session-a",
    sequence: 6,
    causal,
    kind: "operation-result",
    payload: {
      kind: "operationResult",
      result
    },
    replay: {
      cursor: "6",
      previousCursor: "5",
      replayed: false,
      gap: null,
      overflow: false
    },
    createdAt: "2026-06-22T00:00:06.000Z"
  };
  const batchResult = {
    schema: "skenion.runtime.collaboration.operation-batch-result",
    schemaVersion: "0.1.0",
    sessionId: "session-a",
    results: [result],
    issues: [],
    createdAt: "2026-06-22T00:00:06.100Z"
  };

  assert.equal(readRuntimeCollaborationOperationResult(result), result);
  assert.equal(parseRuntimeCollaborationOperationResult(JSON.stringify(result)).status, "accepted");
  assert.equal(readRuntimeCollaborationOperationBatchResult(batchResult), batchResult);
  assert.equal(readRuntimeCollaborationEvent(event), event);
  assert.equal(parseRuntimeCollaborationEvent({ data: JSON.stringify(event) }).eventId, "event-6");
  assert.throws(
    () => readRuntimeCollaborationOperationResult({ ...result, status: "rejected" }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () => readRuntimeCollaborationOperationResult({ ...result, status: "accepted", nack: { reason: "invalid-operation" } }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () => readRuntimeCollaborationOperationBatchResult({ ...batchResult, results: [{ ...result, sessionId: "other" }] }),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () => parseRuntimeCollaborationEvent("{"),
    SkenionRuntimeCollaborationError
  );
  assert.throws(
    () =>
      readRuntimeCollaborationEvent({
        ...event,
        payload: {
          kind: "operationResult",
          result: {
            ...result,
            sessionId: "other-session"
          }
        }
      }),
    SkenionRuntimeCollaborationError
  );
});

test("collaboration event reader accepts presence and selection payloads", () => {
  const presence = createRuntimeCollaborationPresenceEnvelope({
    sessionId: "session-a",
    participantId: "participant-a",
    presence: {
      state: "active"
    },
    updatedAt: "2026-06-22T00:00:08.000Z",
    expiresAt: "2026-06-22T00:00:38.000Z"
  });
  const selection = createRuntimeCollaborationSelectionEnvelope({
    sessionId: "session-a",
    participantId: "participant-a",
    target,
    selection: {
      ranges: [
        {
          kind: "nodes",
          nodeIds: ["node-1"]
        }
      ]
    },
    updatedAt: "2026-06-22T00:00:08.000Z",
    expiresAt: "2026-06-22T00:00:38.000Z"
  });
  const baseEvent = {
    schema: "skenion.runtime.collaboration.event",
    schemaVersion: "0.1.0",
    eventId: "event-presence",
    sessionId: "session-a",
    sequence: 7,
    causal,
    replay: {
      cursor: "7",
      previousCursor: "6",
      replayed: false,
      gap: null,
      overflow: false
    },
    createdAt: "2026-06-22T00:00:08.000Z"
  };

  assert.equal(
    readRuntimeCollaborationEvent({
      ...baseEvent,
      kind: "presence",
      payload: {
        kind: "presence",
        presence
      }
    }).payload.kind,
    "presence"
  );
  assert.equal(
    readRuntimeCollaborationEvent({
      ...baseEvent,
      eventId: "event-selection",
      kind: "selection",
      payload: {
        kind: "selection",
        selection
      }
    }).payload.kind,
    "selection"
  );
});

test("rebase strategies are SDK-owned and usable in validation", () => {
  const operation = createRuntimeCollaborationUndoRedoOperation({
    operationId: "op-rebase-1",
    sessionId: "session-a",
    participantId: "participant-a",
    causal,
    action: "redo",
    submittedAt: "2026-06-22T00:00:07.000Z"
  });
  const result = {
    ...acceptedResult(operation),
    status: "rebased",
    rebase: {
      from: causal,
      to: createRuntimeCollaborationCausalMetadata({
        baseRevision: "rev-2",
        baseSequence: 5,
        participantId: "participant-a",
        participantSequence: 4
      }),
      strategy: runtimeCollaborationRebaseStrategies[0],
      transformedPayload: operation.payload,
      conflicts: []
    }
  };

  assert.deepEqual([...runtimeCollaborationRebaseStrategies], ["ot-transform", "crdt-merge", "server-reject"]);
  assert.equal(isRuntimeCollaborationRebaseStrategy("ot-transform"), true);
  assert.equal(isRuntimeCollaborationRebaseStrategy("last-write-wins"), false);
  assert.equal(isRuntimeCollaborationRebaseStrategy(1), false);
  assert.equal(readRuntimeCollaborationOperationResult(result).rebase.strategy, "ot-transform");
  assert.throws(
    () =>
      readRuntimeCollaborationOperationResult({
        ...result,
        rebase: {
          ...result.rebase,
          strategy: "last-write-wins"
        }
      }),
    SkenionRuntimeCollaborationError
  );
});

test("runtime client routes include collaboration operation endpoints for all profiles", () => {
  const managed = createRuntimeClient({
    baseUrl: "http://127.0.0.1:49231",
    sessionId: "session-a"
  });
  const shared = managed.withSession("session-shared");
  const remote = createRuntimeClient({
    baseUrl: "https://runtime.example.com/skenion/",
    sessionId: "remote-session"
  });

  assert.equal(managed.sessionPath("operations"), "/v0/sessions/session-a/operations");
  assert.equal(shared.sessionPath("collaboration/presence"), "/v0/sessions/session-shared/collaboration/presence");
  assert.equal(
    remote.sessionUrl({ route: "collaboration/selection" }).toString(),
    "https://runtime.example.com/skenion/v0/sessions/remote-session/collaboration/selection"
  );
});
