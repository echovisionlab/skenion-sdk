import assert from "node:assert/strict";
import test from "node:test";
import { computeNodeCatalogRevisionV01 } from "@skenion/contracts";
import {
  SkenionObjectCatalogError,
  SkenionProjectAuthoringError,
  createObjectNodeFromCatalogEntry,
  defineNodeDefinition,
  definePort,
  objectSpecForCatalogEntry,
  resolveCatalogObjectSpec
} from "../dist/index.js";

const audioOut = definePort({
  id: "out",
  direction: "output",
  type: "value.core.float32",
  rate: "audio"
});

function definition(id, displayName) {
  return defineNodeDefinition({
    id,
    version: "0.1.0",
    displayName,
    category: "Audio",
    ports: [audioOut],
    execution: {
      model: "audio_block"
    }
  });
}

function snapshot(entries) {
  const document = {
    schema: "skenion.node-catalog.snapshot",
    schemaVersion: "0.1.0",
    catalogRevision: {
      algorithm: "sha256",
      value: "0".repeat(64)
    },
    entries
  };

  return {
    ...document,
    catalogRevision: computeNodeCatalogRevisionV01(document)
  };
}

const manipulatorEntry = {
  catalogId: "skenion.core.manipulator",
  objectId: "manipulator",
  primaryObjectSpec: " [ manipulator ] ",
  aliases: ["manipulator~"],
  provider: {
    kind: "package",
    packageId: "skenion/core",
    version: "0.57.0"
  },
  definition: definition("skenion.core.manipulator", "Manipulator"),
  creatable: true,
  display: {
    title: "Manipulator",
    category: "Core",
    palette: "text",
    helpId: "help.manipulator"
  }
};

test("catalog helpers normalize object specs and create resolved object nodes", () => {
  const node = createObjectNodeFromCatalogEntry(manipulatorEntry, {
    id: "node.manipulator",
    objectSpec: "[ manipulator ]",
    params: {
      gain: 0.5
    }
  });

  assert.equal(objectSpecForCatalogEntry(manipulatorEntry), "manipulator");
  assert.equal(node.objectSpec, "manipulator");
  assert.equal(node.implementation?.provider.kind, "package");
  assert.equal(node.implementation?.objectId, "manipulator");
  assert.equal(node.objectResolution?.status, "resolved");
  assert.equal(node.ports[0].id, "out");
  assert.equal(node.params.gain, 0.5);

  const explicit = createObjectNodeFromCatalogEntry(manipulatorEntry, {
    id: "node.explicit",
    objectSpec: "manipulator~",
    implementation: {
      provider: {
        kind: "core"
      },
      objectId: "manipulator"
    },
    ports: []
  });

  assert.equal(explicit.objectSpec, "manipulator~");
  assert.equal(explicit.implementation?.provider.kind, "core");
  assert.deepEqual(explicit.ports, []);

  const primary = createObjectNodeFromCatalogEntry(manipulatorEntry, {
    id: "node.primary"
  });

  assert.equal(primary.objectSpec, "manipulator");
});

test("catalog resolution treats bracket-equivalent specs as the same object syntax", () => {
  const oscillator = {
    catalogId: "skenion.core.osc",
    objectId: "oscillator",
    primaryObjectSpec: "osc~ 440",
    provider: {
      kind: "package",
      packageId: "skenion/core",
      version: "0.57.0"
    },
    definition: definition("skenion.core.oscillator", "Oscillator"),
    creatable: true,
    display: {
      title: "Oscillator"
    }
  };
  const duplicateOscillator = {
    catalogId: "skenion.extra.osc",
    objectId: "oscillator-plus",
    primaryObjectSpec: "[ osc~ 440 ]",
    provider: {
      kind: "package",
      packageId: "skenion/extra",
      version: "0.57.0"
    },
    definition: definition("skenion.extra.oscillator", "Extra Oscillator"),
    creatable: true,
    display: {
      title: "Extra Oscillator"
    }
  };
  const catalog = snapshot([manipulatorEntry, oscillator, duplicateOscillator]);

  const resolved = resolveCatalogObjectSpec(catalog, " manipulator ");
  const ambiguous = resolveCatalogObjectSpec(catalog, "[osc~ 440]");
  const unresolved = resolveCatalogObjectSpec(catalog, "+ 1");

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.objectSpec, "manipulator");
  assert.equal(resolved.entry.catalogId, "skenion.core.manipulator");
  assert.equal(ambiguous.status, "ambiguous");
  assert.deepEqual(
    ambiguous.entries.map((entry) => entry.catalogId),
    ["skenion.core.osc", "skenion.extra.osc"]
  );
  assert.equal(unresolved.status, "unresolved");

  const invalidSyntax = resolveCatalogObjectSpec(catalog, "[");
  assert.equal(invalidSyntax.status, "unresolved");
  assert.equal(invalidSyntax.parse.ok, false);
});

test("catalog helpers reject invalid catalog snapshots and non-exported specs", () => {
  assert.throws(
    () =>
      resolveCatalogObjectSpec(
        {
          ...snapshot([manipulatorEntry]),
          catalogRevision: {
            algorithm: "sha256",
            value: "3".repeat(64)
          }
        },
        "manipulator"
      ),
    SkenionObjectCatalogError
  );

  assert.throws(
    () =>
      objectSpecForCatalogEntry({
        ...manipulatorEntry,
        primaryObjectSpec: "["
      }),
    SkenionObjectCatalogError
  );

  assert.throws(
    () =>
      createObjectNodeFromCatalogEntry(manipulatorEntry, {
        id: "node.wrong",
        objectSpec: "osc~ 440"
      }),
    SkenionProjectAuthoringError
  );
});
