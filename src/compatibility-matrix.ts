import { validateCompatibilityMatrixV01 } from "@skenion/contracts";
import type { CompatibilityMatrixV01 } from "@skenion/contracts";
import {
  SDK_CONTRACTS_BUILT_AGAINST_VERSION,
  SDK_SUPPORTED_CONTRACTS_RANGE
} from "./contracts-version.js";

export type CompatibilityMatrixIssueCode =
  | "invalid_matrix"
  | "sdk_package_name_mismatch"
  | "sdk_version_mismatch"
  | "contracts_version_mismatch"
  | "missing_contracts_dependency_version"
  | "contracts_dependency_version_mismatch"
  | "missing_contracts_package_version"
  | "incompatible_contracts_package_version";

export type CompatibilityMatrixIssueComponent =
  | "matrix"
  | "sdk"
  | "contracts";

export interface CompatibilityMatrixIssue {
  code: CompatibilityMatrixIssueCode;
  component: CompatibilityMatrixIssueComponent;
  message: string;
  field?: string;
  expected?: string;
  actual?: string;
}

export interface ValidateCompatibilityMatrixForSdkOptions {
  sdkPackageName?: string;
  sdkPackageVersion?: string;
  contractsDependencyRange?: string;
  contractsPackageVersion?: string;
  expectedContractsVersion?: string;
  expectedContractsRange?: string;
}

export type CompatibilityMatrixValidationResult =
  | {
      ok: true;
      value: CompatibilityMatrixV01;
      issues: [];
    }
  | {
      ok: false;
      issues: CompatibilityMatrixIssue[];
      value?: CompatibilityMatrixV01;
    };

export class SkenionCompatibilityMatrixError extends Error {
  readonly issues: CompatibilityMatrixIssue[];
  readonly errors: string[];

  constructor(issues: CompatibilityMatrixIssue[]) {
    const errors = issues.map((issue) => issue.message);
    super(`Invalid skenion compatibility matrix for SDK: ${errors.join("; ")}`);
    this.name = "SkenionCompatibilityMatrixError";
    this.issues = issues;
    this.errors = errors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compatibilityMatrixPreflightValue(document: unknown): CompatibilityMatrixV01 | undefined {
  if (!isRecord(document)) {
    return undefined;
  }

  const components = document.components;
  if (
    document.schema !== "skenion.compatibility-matrix" ||
    document["schema-version"] !== "0.1.0" ||
    !isRecord(components)
  ) {
    return undefined;
  }

  return document as unknown as CompatibilityMatrixV01;
}

function versionIssue(
  field: string,
  expected: string,
  actual: string,
  code: Extract<
    CompatibilityMatrixIssueCode,
    "contracts_version_mismatch" | "contracts_dependency_version_mismatch"
  > = "contracts_version_mismatch"
): CompatibilityMatrixIssue[] {
  if (actual === expected) {
    return [];
  }

  return [
    {
      code,
      component: "contracts",
      field,
      expected,
      actual,
      message: `${field} must be ${expected}; received ${actual}`
    }
  ];
}

function sdkMetadataIssues(
  matrix: CompatibilityMatrixV01,
  options: ValidateCompatibilityMatrixForSdkOptions
): CompatibilityMatrixIssue[] {
  const expectedContractsVersion =
    options.expectedContractsVersion ?? SDK_CONTRACTS_BUILT_AGAINST_VERSION;
  const expectedContractsRange =
    options.expectedContractsRange ?? SDK_SUPPORTED_CONTRACTS_RANGE;
  const contractsDependencyRange = options.contractsDependencyRange;
  const sdkPackageName = options.sdkPackageName ?? "@skenion/sdk";
  const issues: CompatibilityMatrixIssue[] = [];

  issues.push(
    ...versionIssue(
      "contracts-version",
      expectedContractsVersion,
      matrix["contracts-version"]
    ),
    ...versionIssue(
      "components.sdk.required-contracts-version",
      matrix["contracts-version"],
      matrix.components.sdk["required-contracts-version"]
    )
  );

  if (matrix.components.sdk.npm.name !== sdkPackageName) {
    issues.push({
      code: "sdk_package_name_mismatch",
      component: "sdk",
      field: "components.sdk.npm.name",
      expected: sdkPackageName,
      actual: matrix.components.sdk.npm.name,
      message: `components.sdk.npm.name must be ${sdkPackageName}; received ${matrix.components.sdk.npm.name}`
    });
  }

  if (
    options.sdkPackageVersion !== undefined &&
    matrix.components.sdk.npm.version !== options.sdkPackageVersion
  ) {
    issues.push({
      code: "sdk_version_mismatch",
      component: "sdk",
      field: "components.sdk.npm.version",
      expected: options.sdkPackageVersion,
      actual: matrix.components.sdk.npm.version,
      message: `components.sdk.npm.version must be ${options.sdkPackageVersion}; received ${matrix.components.sdk.npm.version}`
    });
  }

  if (contractsDependencyRange === undefined) {
    issues.push({
      code: "missing_contracts_dependency_version",
      component: "contracts",
      field: "peerDependencies.@skenion/contracts",
      expected: expectedContractsRange,
      message: `@skenion/contracts peer dependency must declare supported range ${expectedContractsRange}`
    });
  } else {
    issues.push(
      ...versionIssue(
        "peerDependencies.@skenion/contracts",
        expectedContractsRange,
        contractsDependencyRange,
        "contracts_dependency_version_mismatch"
      )
    );
  }

  if (options.contractsPackageVersion === undefined) {
    issues.push({
      code: "missing_contracts_package_version",
      component: "contracts",
      field: "installed @skenion/contracts version",
      expected: expectedContractsVersion,
      message: `installed @skenion/contracts version evidence is required and must be ${expectedContractsVersion}`
    });
  } else if (options.contractsPackageVersion !== expectedContractsVersion) {
    issues.push({
      code: "incompatible_contracts_package_version",
      component: "contracts",
      field: "installed @skenion/contracts version",
      expected: expectedContractsVersion,
      actual: options.contractsPackageVersion,
      message: `installed @skenion/contracts version ${options.contractsPackageVersion} must be ${expectedContractsVersion}`
    });
  }

  return issues;
}

function compatibilityMatrixValidationResultForValue(
  value: CompatibilityMatrixV01,
  options: ValidateCompatibilityMatrixForSdkOptions
): CompatibilityMatrixValidationResult {
  const issues = sdkMetadataIssues(value, options);

  if (issues.length > 0) {
    return { ok: false, value, issues };
  }

  return { ok: true, value, issues: [] };
}

export function validateCompatibilityMatrixForSdk(
  document: unknown,
  options: ValidateCompatibilityMatrixForSdkOptions = {}
): CompatibilityMatrixValidationResult {
  const validation = validateCompatibilityMatrixV01(document);
  if (validation.ok) {
    return compatibilityMatrixValidationResultForValue(validation.value, options);
  }

  const candidate = compatibilityMatrixPreflightValue(document);
  const sdkIssues = candidate === undefined ? [] : sdkMetadataIssues(candidate, options);

  return {
    ok: false,
    ...(candidate === undefined ? {} : { value: candidate }),
    issues: [
      ...validation.errors.map((error) => ({
        code: "invalid_matrix",
        component: "matrix",
        message: `compatibility matrix does not match skenion.compatibility-matrix 0.1.0: ${error}`
      }) satisfies CompatibilityMatrixIssue),
      ...sdkIssues
    ]
  };
}

export function readCompatibilityMatrixForSdk(
  document: unknown,
  options: ValidateCompatibilityMatrixForSdkOptions = {}
): CompatibilityMatrixV01 {
  const validation = validateCompatibilityMatrixForSdk(document, options);
  if (!validation.ok) {
    throw new SkenionCompatibilityMatrixError(validation.issues);
  }

  return validation.value;
}
