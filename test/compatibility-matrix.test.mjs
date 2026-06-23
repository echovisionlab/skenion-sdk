import assert from "node:assert/strict";
import test from "node:test";
import {
  SDK_SUPPORTED_CONTRACTS_RANGE,
  SkenionCompatibilityMatrixError,
  readCompatibilityMatrixForSdk,
  validateCompatibilityMatrixForSdk
} from "../dist/index.js";

const contractsRange = ">=0.45.0 <0.46.0";
const contractsVersion = "0.45.0";
const sdkVersion = "0.44.0";
const targets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu"
];
const checksumValues = [
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
];

function registryPackage(ecosystem, name, version, tag) {
  return {
    ecosystem,
    name,
    version,
    tag,
    commit: `${name}@${version}`
  };
}

function artifact(kind, idPrefix, target, version, checksum, extension = "tar.gz") {
  const name = `${idPrefix}-${target}.${extension}`;

  return {
    id: `${idPrefix}-${target}`,
    target,
    kind,
    name,
    version,
    source: {
      kind: "github-release-asset",
      repository: `skenion/${idPrefix}`,
      tag: `${idPrefix}-v${version}`,
      "asset-name": name
    },
    checksum: {
      algorithm: "sha256",
      value: checksum
    },
    "size-bytes": 101
  };
}

function targetArtifacts(kind, idPrefix, version) {
  return Object.fromEntries(
    targets.map((target, index) => [
      target,
      artifact(
        kind,
        idPrefix,
        target,
        version,
        checksumValues[index],
        target.includes("windows-msvc") ? "zip" : "tar.gz"
      )
    ])
  );
}

function expectedChecksums(...artifactGroups) {
  return Object.fromEntries(
    artifactGroups
      .flatMap((group) => (Array.isArray(group) ? group : Object.values(group)))
      .map((entry) => [entry.id, entry.checksum])
  );
}

function validCompatibilityMatrix() {
  const runtimeAssets = targetArtifacts("runtime-binary", "runtime", "0.44.2");
  const studioDesktopAssets = targetArtifacts("studio-desktop-package", "studio-desktop", "0.44.5");
  const studioSidecars = targetArtifacts("studio-runtime-sidecar", "studio-runtime-sidecar", "0.44.5");
  const webAssets = [
    {
      id: "studio-web-bundle",
      target: "aarch64-apple-darwin",
      kind: "studio-web-bundle",
      name: "skenion-studio-web-bundle-v0.44.5.tar.gz",
      version: "0.44.5",
      source: {
        kind: "github-release-asset",
        repository: "skenion/skenion-studio",
        tag: "skenion-studio-v0.44.5",
        "asset-name": "skenion-studio-web-bundle-v0.44.5.tar.gz"
      },
      checksum: {
        algorithm: "sha256",
        value: "9999999999999999999999999999999999999999999999999999999999999999"
      },
      "size-bytes": 201
    }
  ];

  return {
    schema: "skenion.compatibility-matrix",
    "schema-version": "0.1.0",
    "matrix-id": "M06.9-0.45.0",
    "contracts-line": "0.45",
    "contracts-range": contractsRange,
    "protocol-baselines": {
      graph: "0.1",
      project: "0.1",
      node: "0.1",
      extension: "0.1",
      "runtime-http": "v0",
      "runtime-collaboration": "v0"
    },
    capabilities: {
      runtime: ["session-addressing", "event-replay", "server-authoritative-ot"],
      studio: ["graph-editor", "desktop-shell-tauri", "runtime-sidecars"],
      marketplace: ["package-discovery", "package-install", "package-update"],
      docs: ["versioned-manual", "pages-deployment"]
    },
    components: {
      contracts: {
        npm: registryPackage("npm", "@skenion/contracts", contractsVersion, "skenion-contracts-v0.45.0"),
        crate: registryPackage("crates.io", "skenion-contracts", contractsVersion, "skenion-contracts-v0.45.0")
      },
      runtime: {
        version: "0.44.2",
        assets: runtimeAssets
      },
      sdk: {
        npm: registryPackage("npm", "@skenion/sdk", sdkVersion, "skenion-sdk-v0.44.0"),
        "supported-contracts-range": contractsRange
      },
      studio: {
        version: "0.44.5",
        "web-assets": webAssets,
        "desktop-assets": studioDesktopAssets,
        "runtime-sidecars": studioSidecars
      },
      examples: {
        repository: "skenion/skenion-examples",
        ref: "skenion-examples-v0.43.0",
        commit: "example-conformance",
        "conformance-status": "passed",
        "evidence-url": "https://github.com/skenion/skenion-examples/actions/runs/1"
      },
      docs: {
        manual: {
          version: "0.44.1",
          path: "/manual/0.44/",
          "pages-url": "https://skenion.github.io/skenion-docs/manual/0.44/",
          "pages-deployed": true,
          "promoted-latest": true,
          "evidence-url": "https://github.com/skenion/skenion-docs/actions/runs/1"
        }
      }
    },
    verification: {
      "expected-checksums": expectedChecksums(runtimeAssets, studioDesktopAssets, studioSidecars, webAssets)
    },
    promotion: {
      state: "promoted",
      "promoted-at": "2026-06-23T00:00:00Z",
      "promoted-by": "release-bot",
      "evidence-url": "https://github.com/skenion/skenion/actions/runs/1"
    }
  };
}

function validate(matrix, options = {}) {
  return validateCompatibilityMatrixForSdk(matrix, {
    sdkPackageVersion: sdkVersion,
    contractsDependencyRange: contractsRange,
    contractsPackageVersion: contractsVersion,
    ...options
  });
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

test("compatibility matrix helper accepts unequal SDK and Contracts component versions on the 0.45 line", () => {
  const matrix = validCompatibilityMatrix();
  const result = validate(matrix);

  assert.equal(SDK_SUPPORTED_CONTRACTS_RANGE, contractsRange);
  assert.equal(result.ok, true);
  assert.equal(result.value.components.sdk.npm.version, sdkVersion);
  assert.equal(result.value.components.contracts.npm.version, contractsVersion);
  assert.notEqual(result.value.components.sdk.npm.version, result.value.components.contracts.npm.version);
  assert.equal(readCompatibilityMatrixForSdk(matrix, {
    sdkPackageVersion: sdkVersion,
    contractsDependencyRange: contractsRange,
    contractsPackageVersion: contractsVersion
  })["contracts-range"], contractsRange);
});

test("compatibility matrix helper accepts the explicit Contracts 0.45 peer range", () => {
  const result = validate(validCompatibilityMatrix(), {
    contractsDependencyRange: ">=0.45.0 <0.46.0",
    contractsPackageVersion: "0.45.3"
  });

  assert.equal(result.ok, true);
});

test("compatibility matrix helper rejects stale exact, wildcard, and cross-line peer ranges", () => {
  for (const contractsDependencyRange of ["0.44.0", "*", ">=0.44.0 <0.45.0"]) {
    const result = validate(validCompatibilityMatrix(), { contractsDependencyRange });

    assert.equal(result.ok, false);
    assert.deepEqual(diagnosticCodes(result), ["contracts_dependency_range_mismatch"]);
    assert.equal(result.diagnostics[0].field, "peerDependencies.@skenion/contracts");
  }
});

test("compatibility matrix helper rejects mismatched matrix and SDK supported ranges", () => {
  const matrix = validCompatibilityMatrix();
  matrix.components.sdk["supported-contracts-range"] = ">=0.45.0 <0.47.0";

  const result = validate(matrix);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("invalid_matrix"));
  assert.ok(diagnosticCodes(result).includes("contracts_range_mismatch"));
});

test("compatibility matrix helper rejects missing Contracts package and dependency evidence", () => {
  const result = validateCompatibilityMatrixForSdk(validCompatibilityMatrix(), {
    sdkPackageVersion: sdkVersion
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), [
    "missing_contracts_dependency_range",
    "missing_contracts_package_version"
  ]);
});

test("compatibility matrix helper rejects incompatible installed Contracts versions", () => {
  const result = validate(validCompatibilityMatrix(), {
    contractsPackageVersion: "0.46.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["incompatible_contracts_package_version"]);
  assert.match(result.diagnostics[0].message, />=0\.45\.0 <0\.46\.0/);
});

test("compatibility matrix helper rejects SDK package metadata mismatches without comparing to Contracts version", () => {
  const result = validate(validCompatibilityMatrix(), {
    sdkPackageName: "@example/not-sdk",
    sdkPackageVersion: "0.45.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["sdk_package_name_mismatch", "sdk_version_mismatch"]);
});

test("compatibility matrix helper rejects malformed compatibility matrix documents", () => {
  const result = validateCompatibilityMatrixForSdk("not a matrix");
  const wrongSchemaResult = validateCompatibilityMatrixForSdk({ schema: "not-a-matrix" });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["invalid_matrix"]);
  assert.equal(wrongSchemaResult.ok, false);
  assert.ok(diagnosticCodes(wrongSchemaResult).every((code) => code === "invalid_matrix"));
  assert.throws(() => readCompatibilityMatrixForSdk("not a matrix"), SkenionCompatibilityMatrixError);
});
