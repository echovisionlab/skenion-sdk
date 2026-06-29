import assert from "node:assert/strict";
import test from "node:test";
import {
  SDK_SUPPORTED_CONTRACTS_RANGE,
  SkenionCompatibilityMatrixError,
  readCompatibilityMatrixForSdk,
  validateCompatibilityMatrixForSdk
} from "../dist/index.js";

const contractsRange = ">=0.54.0 <0.55.0";
const contractsVersion = "0.54.0";
const sdkVersion = "0.44.0";

function registryPackage(ecosystem, name, version) {
  return {
    ecosystem,
    name,
    version
  };
}

function validCompatibilityMatrix() {
  return {
    schema: "skenion.compatibility-matrix",
    "schema-version": "0.1.0",
    "matrix-id": "M06.95-0.54.0",
    "contracts-line": "0.54",
    "contracts-range": contractsRange,
    "protocol-baselines": {
      graph: "0.1",
      project: "0.1",
      node: "0.1",
      extension: "0.1",
      "runtime-http": "v0",
      "runtime-collaboration": "v0"
    },
    components: {
      contracts: {
        npm: registryPackage("npm", "@skenion/contracts", contractsVersion),
        crate: registryPackage("crates.io", "skenion-contracts", contractsVersion)
      },
      runtime: {
        version: "0.44.2"
      },
      sdk: {
        npm: registryPackage("npm", "@skenion/sdk", sdkVersion),
        "supported-contracts-range": contractsRange
      },
      studio: {
        version: "0.44.5"
      }
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

test("compatibility matrix helper accepts unequal SDK and Contracts component versions on the 0.54 line", () => {
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

test("compatibility matrix helper accepts the explicit Contracts 0.54 peer range", () => {
  const result = validate(validCompatibilityMatrix(), {
    contractsDependencyRange: ">=0.54.0 <0.55.0",
    contractsPackageVersion: "0.54.0"
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
  matrix.components.sdk["supported-contracts-range"] = ">=0.52.0 <0.53.0";

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
    contractsPackageVersion: "0.48.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["incompatible_contracts_package_version"]);
  assert.match(result.diagnostics[0].message, />=0\.54\.0 <0\.55\.0/);
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
