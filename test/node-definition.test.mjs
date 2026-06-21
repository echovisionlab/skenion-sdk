import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionNodeDefinitionError,
  SkenionExtensionManifestError,
  defineExtensionPackage,
  defineNode,
  t
} from "../dist/index.js";

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

test("defineNode returns a normalized valid manifest", () => {
  const manifest = defineNode({
    ...scriptNodeBase,
    ports: [
      {
        id: "enabled",
        direction: "input",
        type: t.value(t.bool()),
        activation: "latched",
        default: true
      },
      {
        id: "pulse",
        direction: "output",
        type: t.event(t.bang())
      }
    ]
  });

  assert.equal(manifest.schema, "skenion.node.definition");
  assert.equal(manifest.schemaVersion, "0.1.0");
  assert.equal(manifest.permissions.length, 0);
  assert.equal(manifest.ports[0].type.dataKind, "boolean");
  assert.equal(manifest.ports[1].type.flow, "event");
});

test("defineNode defaults optional state and metadata fields", () => {
  const manifest = defineNode({
    id: "core.value",
    version: "0.1.0",
    displayName: "Value",
    category: "Core",
    execution: {
      model: "value"
    },
    ports: [
      {
        id: "out",
        direction: "output",
        type: t.value(t.f32())
      }
    ]
  });

  assert.equal(manifest.state.persistent, false);
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(manifest.capabilities, []);
  assert.equal("scriptApiVersion" in manifest, false);
  assert.equal("bundleHash" in manifest, false);
});

test("defineNode rejects duplicate port ids", () => {
  assert.throws(
    () =>
      defineNode({
        ...scriptNodeBase,
        ports: [
          {
            id: "value",
            direction: "input",
            type: t.value(t.f32())
          },
          {
            id: "value",
            direction: "output",
            type: t.value(t.f32())
          }
        ]
      }),
    SkenionNodeDefinitionError
  );
});

test("defineNode rejects activation on output ports", () => {
  assert.throws(
    () =>
      defineNode({
        ...scriptNodeBase,
        ports: [
          {
            id: "pulse",
            direction: "output",
            type: t.event(t.bang()),
            activation: "trigger"
          }
        ]
      }),
    SkenionNodeDefinitionError
  );
});

test("defineNode rejects unsupported permissions", () => {
  assert.throws(
    () =>
      defineNode({
        ...scriptNodeBase,
        permissions: ["network"],
        ports: [
          {
            id: "value",
            direction: "output",
            type: t.value(t.f32())
          }
        ]
      }),
    SkenionNodeDefinitionError
  );
});

test("defineExtensionPackage returns a validated package manifest", () => {
  const node = defineNode({
    id: "core.value",
    version: "0.1.0",
    displayName: "Value",
    category: "Core",
    execution: {
      model: "value"
    },
    ports: [
      {
        id: "out",
        direction: "output",
        type: t.value(t.f32())
      }
    ]
  });

  const manifest = defineExtensionPackage({
    id: "skenion/core",
    version: "0.1.0",
    kind: "core-package",
    nodes: [node],
    help: [
      {
        nodeId: "core.value",
        markdownPath: "help/value.md"
      }
    ],
    tests: [
      {
        id: "value-baseline",
        kind: "node",
        target: "core.value",
        fixturePath: "tests/value.input.json",
        expectedPath: "tests/value.expected.json"
      }
    ]
  });

  assert.equal(manifest.schema, "skenion.extension.manifest");
  assert.equal(manifest.runtimeAbiVersion, "0.1.0");
  assert.equal(manifest.provides.nodes?.[0].id, "core.value");
  assert.equal(manifest.provides.help?.[0].markdownPath, "help/value.md");
  assert.equal(manifest.tests?.[0].id, "value-baseline");
});

test("defineExtensionPackage rejects invalid native ABI declarations", () => {
  assert.throws(
    () =>
      defineExtensionPackage({
        id: "example/native",
        version: "0.1.0",
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

test("defineExtensionPackage preserves optional native package metadata", () => {
  const manifest = defineExtensionPackage({
    id: "example/native-sensor",
    version: "0.1.0",
    kind: "native-runtime",
    runtimeAbiVersion: "0.1.0",
    sdkVersion: "0.2.2",
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
        version: "0.1.0",
        transportKinds: ["serial"],
        direction: "decode"
      }
    ],
    transports: [
      {
        id: "example.serial",
        version: "0.1.0",
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

  assert.equal(manifest.sdkVersion, "0.2.2");
  assert.equal(manifest.native?.artifacts[0].abi, "c");
  assert.equal(manifest.provides.codecs?.[0].direction, "decode");
  assert.equal(manifest.provides.transports?.[0].kind, "serial");
  assert.deepEqual(manifest.permissions, ["io.serial"]);
  assert.equal(manifest.frontend?.displayName, "Native Sensor");
  assert.deepEqual(manifest.frontend?.tags, ["sensor"]);
});

test("type builders emit canonical v0.1 flow and dataKind pairs", () => {
  assert.deepEqual(t.event(t.bang()), {
    flow: "event",
    dataKind: "bang"
  });
  assert.deepEqual(t.value(t.bool()), {
    flow: "value",
    dataKind: "boolean"
  });
  assert.deepEqual(t.gpu.texture2d(), {
    flow: "resource",
    dataKind: "gpu.texture2d"
  });
  assert.deepEqual(t.resource(t.asset.video()), {
    flow: "resource",
    dataKind: "asset.video"
  });
});

test("type builders preserve constraints and primitive aliases", () => {
  assert.deepEqual(t.f64({ unit: "seconds" }), {
    dataKind: "number.f64",
    unit: "seconds"
  });
  assert.deepEqual(t.boolean(), {
    dataKind: "boolean"
  });
  assert.deepEqual(t.string({ values: ["a", "b"] }), {
    dataKind: "string",
    values: ["a", "b"]
  });
});

test("flow builders cover signal and stream types", () => {
  assert.deepEqual(t.signal(t.f32({ sampleRate: 60 })), {
    flow: "signal",
    dataKind: "number.f32",
    sampleRate: 60
  });
  assert.deepEqual(t.stream(t.asset.video({ format: "mp4" })), {
    flow: "stream",
    dataKind: "asset.video",
    format: "mp4"
  });
});

test("flow builders reject already-flowed incompatible inputs", () => {
  assert.throws(
    () => t.value(t.event(t.bang())),
    /Cannot convert event<bang> to value<bang>/
  );
});
