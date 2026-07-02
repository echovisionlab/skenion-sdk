import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionPackageManifestError,
  defineObject,
  definePackageManifest,
  defineNodeDefinition,
  definePort
} from "../dist/index.js";

const signalOut = definePort({
  id: "out",
  direction: "output",
  type: "value.core.float32",
  rate: "audio"
});

const oscillatorDefinition = defineNodeDefinition({
  id: "skenion.core.oscillator",
  version: "0.1.0",
  displayName: "Oscillator",
  category: "Audio",
  ports: [signalOut],
  execution: {
    model: "audio_block"
  },
  state: {
    persistent: true
  }
});

const checksum = (value) => ({
  algorithm: "sha256",
  value: value.repeat(64)
});

const manifestChecksum = {
  id: "manifest",
  path: "skenion.package.json",
  checksum: checksum("1")
};

const manifestEvidence = {
  id: "manifest-checksum",
  kind: "checksum",
  path: "checksums/SHA256SUMS",
  checksum: checksum("2")
};

test("object package helpers author provides.objects without teaching nodes as object exports", () => {
  const oscillator = defineObject({
    objectId: "oscillator",
    primaryObjectSpec: " [ osc~ 440 ] ",
    aliases: ["osc~"],
    definition: oscillatorDefinition,
    display: {
      title: "Oscillator",
      category: "Audio",
      description: "Sine oscillator",
      helpId: "help.oscillator"
    }
  });
  const manipulator = defineObject({
    objectId: "manipulator",
    primaryObjectSpec: "manipulator",
    definition: defineNodeDefinition({
      ...oscillatorDefinition,
      id: "skenion.core.manipulator",
      displayName: "Manipulator"
    })
  });

  const manifest = definePackageManifest({
    id: "skenion/core",
    version: "0.61.0",
    objects: [oscillator, manipulator],
    help: [
      {
        id: "help.oscillator",
        path: "help/oscillator.md"
      }
    ],
    checksums: [manifestChecksum],
    evidence: [manifestEvidence]
  });

  assert.equal(oscillator.primaryObjectSpec, "osc~ 440");
  assert.deepEqual(oscillator.aliases, ["osc~"]);
  assert.equal(manifest.contracts.version, "0.61.0");
  assert.equal(manifest.provides.objects?.[0].objectId, "oscillator");
  assert.equal(manifest.provides.objects?.[0].primaryObjectSpec, "osc~ 440");
  assert.equal(manifest.provides.objects?.[0].helpId, "help.oscillator");
  assert.equal(manifest.provides.objects?.[1].objectId, "manipulator");
  assert.equal("aliases" in manifest.provides.objects?.[1], false);
  assert.equal("nodes" in manifest.provides, false);
});

test("package manifest helper requires object helpId to resolve to provided help", () => {
  const oscillator = defineObject({
    objectId: "oscillator",
    primaryObjectSpec: "osc~ 440",
    definition: oscillatorDefinition,
    display: {
      helpId: "help.missing"
    }
  });

  assert.throws(
    () =>
      definePackageManifest({
        id: "skenion/core",
        version: "0.61.0",
        objects: [oscillator]
      }),
    SkenionPackageManifestError
  );
});

test("package manifest helper preserves optional package fields for native manifests", () => {
  const manifest = definePackageManifest({
    id: "example/native-audio",
    version: "0.61.0",
    displayName: "Native Audio",
    category: "native",
    contracts: {
      version: "0.61.0"
    },
    runtimeAbiRange: ">=0.61.0 <0.62.0",
    targets: ["aarch64-apple-darwin"],
    patches: [
      {
        id: "help.oscillator",
        path: "patches/help.oscillator.json"
      }
    ],
    resources: [
      {
        id: "wavetable.default",
        path: "resources/wavetable-default.bin"
      }
    ],
    paths: {
      docs: ["README.md"],
      tests: ["tests/native-audio.json"]
    },
    checksums: [manifestChecksum],
    evidence: [manifestEvidence],
    nativeArtifacts: [
      {
        target: "aarch64-apple-darwin",
        path: "native/libskenion_audio.dylib",
        entrypoint: "skenion_extension_init",
        checksum: checksum("4"),
        evidenceRefs: ["manifest-checksum"]
      }
    ],
    issues: [
      {
        severity: "info",
        code: "native-package-smoke",
        message: "Native artifact included for validation"
      }
    ]
  });

  assert.equal(manifest.displayName, "Native Audio");
  assert.equal(manifest.category, "native");
  assert.equal(manifest.runtimeAbiRange, ">=0.61.0 <0.62.0");
  assert.equal(manifest.targets?.[0], "aarch64-apple-darwin");
  assert.equal(manifest.provides.patches?.[0].id, "help.oscillator");
  assert.equal(manifest.provides.resources?.[0].id, "wavetable.default");
  assert.equal(manifest.paths.docs?.[0], "README.md");
  assert.equal(manifest.nativeArtifacts?.[0].evidenceRefs[0], "manifest-checksum");
  assert.equal(manifest.issues?.[0].code, "native-package-smoke");
});

test("package helpers reject invalid specs, definitions, and incomplete manifests", () => {
  assert.throws(
    () =>
      defineObject({
        objectId: "invalid-spec",
        primaryObjectSpec: "[",
        definition: oscillatorDefinition
      }),
    SkenionPackageManifestError
  );

  assert.throws(
    () =>
      defineObject({
        objectId: "invalid-definition",
        primaryObjectSpec: "invalid-definition",
        definition: {
          ...oscillatorDefinition,
          ports: [signalOut, { ...signalOut }]
        }
      }),
    SkenionPackageManifestError
  );

  assert.throws(
    () =>
      definePackageManifest({
        id: "skenion/core",
        version: "0.61.0"
      }),
    SkenionPackageManifestError
  );
});
