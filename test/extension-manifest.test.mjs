import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionExtensionManifestError,
  SkenionProjectAuthoringError,
  defineExtensionPackage,
  defineNodeDefinition,
  definePort
} from "../dist/index.js";

const valueOut = definePort({
  id: "out",
  direction: "output",
  type: "control.number.float",
  rate: "control"
});

const scriptNodeBase = {
  id: "script.brightness",
  version: "0.1.0",
  displayName: "Brightness",
  category: "Script",
  execution: {
    model: "script_control"
  },
  state: {
    persistent: true
  },
  scriptApiVersion: "0.1.0",
  bundleHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  capabilities: ["script.api.v0.1"]
};

test("current node definition helper returns normalized 0.1 manifests", () => {
  const manifest = defineNodeDefinition({
    ...scriptNodeBase,
    ports: [
      {
        id: "enabled",
        direction: "input",
        type: "control.bool",
        rate: "control",
        triggerMode: "latched",
        defaultValue: true
      },
      valueOut
    ]
  });

  assert.equal(manifest.schema, "skenion.node.definition");
  assert.equal(manifest.schemaVersion, "0.1.0");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.ports[0].type, "control.bool");
  assert.equal(manifest.ports[1].type, "control.number.float");
});

test("current node definition helper rejects unsupported versions and invalid ports", () => {
  assert.throws(
    () =>
      defineNodeDefinition({
        ...scriptNodeBase,
        version: "0.2.0"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineNodeDefinition({
        ...scriptNodeBase,
        scriptApiVersion: "0.2.0"
      }),
    SkenionProjectAuthoringError
  );
  assert.throws(
    () =>
      defineNodeDefinition({
        ...scriptNodeBase,
        ports: [valueOut, { ...valueOut }]
      }),
    SkenionProjectAuthoringError
  );
});

test("current extension package helper returns a validated package manifest", () => {
  const node = defineNodeDefinition({
    id: "core.float",
    version: "0.1.0",
    displayName: "Float",
    category: "Core",
    execution: {
      model: "control"
    },
    ports: [valueOut]
  });

  const manifest = defineExtensionPackage({
    id: "skenion/core",
    version: "0.55.0",
    kind: "core-package",
    nodes: [node],
    help: [
      {
        nodeId: "core.float",
        markdownPath: "help/float.md"
      }
    ],
    tests: [
      {
        id: "float-baseline",
        kind: "node",
        target: "core.float",
        fixturePath: "tests/float.input.json",
        expectedPath: "tests/float.expected.json"
      }
    ]
  });

  assert.equal(manifest.schema, "skenion.extension.manifest");
  assert.equal(manifest.schemaVersion, "0.1.0");
  assert.equal(manifest.runtimeAbiVersion, "0.1.0");
  assert.equal(manifest.provides.nodes?.[0].id, "core.float");
  assert.equal(manifest.provides.help?.[0].markdownPath, "help/float.md");
  assert.equal(manifest.tests?.[0].id, "float-baseline");
});

test("current extension package helper rejects unsupported ABI versions", () => {
  assert.throws(
    () =>
      defineExtensionPackage({
        id: "skenion/old-runtime",
        version: "0.55.0",
        kind: "core-package",
        runtimeAbiVersion: "0.2.0"
      }),
    SkenionExtensionManifestError
  );
});

test("current extension package helper preserves optional native package metadata", () => {
  const manifest = defineExtensionPackage({
    id: "example/native-sensor",
    version: "0.55.0",
    kind: "native-runtime",
    runtimeAbiVersion: "0.1.0",
    sdkVersion: "0.55.0",
    native: {
      entrypoint: "skenion_extension_init",
      artifacts: [
        {
          os: "macos",
          arch: "aarch64",
          abi: "c",
          path: "target/release/libskenion_native_sensor.dylib",
          sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        }
      ]
    },
    codecs: [
      {
        id: "example.sensor.text",
        version: "0.55.0",
        transportKinds: ["serial"],
        direction: "decode"
      }
    ],
    transports: [
      {
        id: "example.serial",
        version: "0.55.0",
        kind: "serial"
      }
    ],
    permissions: ["io.serial"],
    frontend: {
      displayName: "Native Sensor",
      description: "Serial sensor package",
      tags: ["sensor"]
    }
  });

  assert.equal(manifest.sdkVersion, "0.55.0");
  assert.equal(manifest.native?.artifacts[0].abi, "c");
  assert.equal(manifest.provides.codecs?.[0].direction, "decode");
  assert.equal(manifest.provides.transports?.[0].kind, "serial");
  assert.deepEqual(manifest.permissions, ["io.serial"]);
  assert.equal(manifest.frontend?.displayName, "Native Sensor");
});

test("current extension package helper rejects invalid native ABI declarations", () => {
  assert.throws(
    () =>
      defineExtensionPackage({
        id: "example/native",
        version: "0.55.0",
        kind: "native-runtime",
        native: {
          entrypoint: "skenion_extension_init",
          artifacts: [
            {
              os: "macos",
              arch: "aarch64",
              abi: "rust",
              path: "target/release/libexample.dylib"
            }
          ]
        }
      }),
    SkenionExtensionManifestError
  );
});
