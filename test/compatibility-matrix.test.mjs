import assert from "node:assert/strict";
import test from "node:test";
import {
  SDK_CONTRACTS_BUILT_AGAINST_VERSION,
  SDK_SUPPORTED_CONTRACTS_RANGE,
  SkenionCompatibilityMatrixError,
  readCompatibilityMatrixForSdk,
  supportedContractsRangeForVersion,
  validateCompatibilityMatrixForSdk
} from "../dist/index.js";

const contractsVersion = "0.61.0";
const contractsRange = ">=0.0.0 <1.0.0";
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
    "matrix-id": "M06.95-0.61.0",
    "contracts-version": contractsVersion,
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
        "required-contracts-version": contractsVersion
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

function issueCodes(result) {
  return result.issues.map((issue) => issue.code);
}

test("compatibility matrix helper accepts unequal SDK and Contracts component versions for built-against provenance", () => {
  const matrix = validCompatibilityMatrix();
  const result = validate(matrix);

  assert.equal(SDK_CONTRACTS_BUILT_AGAINST_VERSION, contractsVersion);
  assert.equal(SDK_SUPPORTED_CONTRACTS_RANGE, contractsRange);
  assert.equal(result.ok, true);
  assert.equal(result.value.components.sdk.npm.version, sdkVersion);
  assert.equal(result.value.components.contracts.npm.version, contractsVersion);
  assert.notEqual(result.value.components.sdk.npm.version, result.value.components.contracts.npm.version);
  assert.equal(readCompatibilityMatrixForSdk(matrix, {
    sdkPackageVersion: sdkVersion,
    contractsDependencyRange: contractsRange,
    contractsPackageVersion: contractsVersion
  })["contracts-version"], contractsVersion);
});

test("compatibility matrix helper accepts the explicit Contracts peer range", () => {
  const result = validate(validCompatibilityMatrix(), {
    contractsDependencyRange: contractsRange,
    contractsPackageVersion: "0.61.0"
  });

  assert.equal(result.ok, true);
});

test("Contracts range helper keeps v0 broad and v1+ strict minor", () => {
  assert.equal(supportedContractsRangeForVersion("0.61.0"), ">=0.0.0 <1.0.0");
  assert.equal(supportedContractsRangeForVersion("1.2.3"), ">=1.2.0 <1.3.0");
  assert.throws(() => supportedContractsRangeForVersion("not-semver"), /x\.y\.z SemVer/);
});

test("compatibility matrix helper rejects exact, wildcard, and minor-line peer ranges", () => {
  for (const contractsDependencyRange of ["0.61.0", "*", ">=0.61.0 <0.62.0"]) {
    const result = validate(validCompatibilityMatrix(), { contractsDependencyRange });

    assert.equal(result.ok, false);
    assert.deepEqual(issueCodes(result), ["contracts_dependency_version_mismatch"]);
    assert.equal(result.issues[0].field, "peerDependencies.@skenion/contracts");
  }
});

test("compatibility matrix helper rejects mismatched matrix and SDK required versions", () => {
  const matrix = validCompatibilityMatrix();
  matrix.components.sdk["required-contracts-version"] = "0.60.0";

  const result = validate(matrix);

  assert.equal(result.ok, false);
  assert.ok(issueCodes(result).includes("invalid_matrix"));
  assert.ok(issueCodes(result).includes("contracts_version_mismatch"));
});

test("compatibility matrix helper rejects missing Contracts package and dependency evidence", () => {
  const result = validateCompatibilityMatrixForSdk(validCompatibilityMatrix(), {
    sdkPackageVersion: sdkVersion
  });

  assert.equal(result.ok, false);
  assert.deepEqual(issueCodes(result), [
    "missing_contracts_dependency_version",
    "missing_contracts_package_version"
  ]);
});

test("compatibility matrix helper rejects incompatible installed Contracts versions", () => {
  const result = validate(validCompatibilityMatrix(), {
    contractsPackageVersion: "0.48.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(issueCodes(result), ["incompatible_contracts_package_version"]);
  assert.match(result.issues[0].message, /0\.61\.0/);
});

test("compatibility matrix helper rejects SDK package metadata mismatches without comparing to Contracts version", () => {
  const result = validate(validCompatibilityMatrix(), {
    sdkPackageName: "@example/not-sdk",
    sdkPackageVersion: "0.45.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(issueCodes(result), ["sdk_package_name_mismatch", "sdk_version_mismatch"]);
});

test("compatibility matrix helper rejects malformed compatibility matrix documents", () => {
  const result = validateCompatibilityMatrixForSdk("not a matrix");
  const wrongSchemaResult = validateCompatibilityMatrixForSdk({ schema: "not-a-matrix" });

  assert.equal(result.ok, false);
  assert.deepEqual(issueCodes(result), ["invalid_matrix"]);
  assert.equal(wrongSchemaResult.ok, false);
  assert.ok(issueCodes(wrongSchemaResult).every((code) => code === "invalid_matrix"));
  assert.throws(() => readCompatibilityMatrixForSdk("not a matrix"), SkenionCompatibilityMatrixError);
});
