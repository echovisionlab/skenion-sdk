import {
  deriveV0CompatibilityRange,
  satisfiesV0CompatibilityRange,
  validateCompatibilityMatrixV01
} from "@skenion/contracts";
import type { CompatibilityMatrixV01 } from "@skenion/contracts";

export const SDK_SUPPORTED_CONTRACTS_RANGE = deriveV0CompatibilityRange("0.46.0");

export type CompatibilityMatrixDiagnosticCode =
  | "invalid_matrix"
  | "sdk_package_name_mismatch"
  | "sdk_version_mismatch"
  | "contracts_range_mismatch"
  | "missing_contracts_dependency_range"
  | "contracts_dependency_range_mismatch"
  | "missing_contracts_package_version"
  | "incompatible_contracts_package_version";

export type CompatibilityMatrixDiagnosticComponent =
  | "matrix"
  | "sdk"
  | "contracts";

export interface CompatibilityMatrixDiagnostic {
  code: CompatibilityMatrixDiagnosticCode;
  component: CompatibilityMatrixDiagnosticComponent;
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
  expectedContractsRange?: string;
}

export type CompatibilityMatrixValidationResult =
  | {
      ok: true;
      value: CompatibilityMatrixV01;
      diagnostics: [];
    }
  | {
      ok: false;
      diagnostics: CompatibilityMatrixDiagnostic[];
      value?: CompatibilityMatrixV01;
    };

export class SkenionCompatibilityMatrixError extends Error {
  readonly diagnostics: CompatibilityMatrixDiagnostic[];
  readonly errors: string[];

  constructor(diagnostics: CompatibilityMatrixDiagnostic[]) {
    const errors = diagnostics.map((diagnostic) => diagnostic.message);
    super(`Invalid skenion compatibility matrix for SDK: ${errors.join("; ")}`);
    this.name = "SkenionCompatibilityMatrixError";
    this.diagnostics = diagnostics;
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

function rangeDiagnostic(
  field: string,
  expected: string,
  actual: string,
  code: Extract<
    CompatibilityMatrixDiagnosticCode,
    "contracts_range_mismatch" | "contracts_dependency_range_mismatch"
  > = "contracts_range_mismatch"
): CompatibilityMatrixDiagnostic[] {
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

function sdkMetadataDiagnostics(
  matrix: CompatibilityMatrixV01,
  options: ValidateCompatibilityMatrixForSdkOptions
): CompatibilityMatrixDiagnostic[] {
  const expectedContractsRange = options.expectedContractsRange ?? SDK_SUPPORTED_CONTRACTS_RANGE;
  const sdkPackageName = options.sdkPackageName ?? "@skenion/sdk";
  const diagnostics: CompatibilityMatrixDiagnostic[] = [];

  diagnostics.push(
    ...rangeDiagnostic("contracts-range", expectedContractsRange, matrix["contracts-range"]),
    ...rangeDiagnostic(
      "components.sdk.supported-contracts-range",
      matrix["contracts-range"],
      matrix.components.sdk["supported-contracts-range"]
    )
  );

  if (matrix.components.sdk.npm.name !== sdkPackageName) {
    diagnostics.push({
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
    diagnostics.push({
      code: "sdk_version_mismatch",
      component: "sdk",
      field: "components.sdk.npm.version",
      expected: options.sdkPackageVersion,
      actual: matrix.components.sdk.npm.version,
      message: `components.sdk.npm.version must be ${options.sdkPackageVersion}; received ${matrix.components.sdk.npm.version}`
    });
  }

  if (options.contractsDependencyRange === undefined) {
    diagnostics.push({
      code: "missing_contracts_dependency_range",
      component: "contracts",
      field: "peerDependencies.@skenion/contracts",
      expected: expectedContractsRange,
      message: `@skenion/contracts peer dependency range must be declared as ${expectedContractsRange}`
    });
  } else {
    diagnostics.push(
      ...rangeDiagnostic(
        "peerDependencies.@skenion/contracts",
        expectedContractsRange,
        options.contractsDependencyRange,
        "contracts_dependency_range_mismatch"
      )
    );
  }

  if (options.contractsPackageVersion === undefined) {
    diagnostics.push({
      code: "missing_contracts_package_version",
      component: "contracts",
      field: "installed @skenion/contracts version",
      expected: expectedContractsRange,
      message: `installed @skenion/contracts version evidence is required and must satisfy ${expectedContractsRange}`
    });
  } else if (!satisfiesV0CompatibilityRange(options.contractsPackageVersion, expectedContractsRange)) {
    diagnostics.push({
      code: "incompatible_contracts_package_version",
      component: "contracts",
      field: "installed @skenion/contracts version",
      expected: expectedContractsRange,
      actual: options.contractsPackageVersion,
      message: `installed @skenion/contracts version ${options.contractsPackageVersion} must satisfy ${expectedContractsRange}`
    });
  }

  return diagnostics;
}

function compatibilityMatrixValidationResultForValue(
  value: CompatibilityMatrixV01,
  options: ValidateCompatibilityMatrixForSdkOptions
): CompatibilityMatrixValidationResult {
  const diagnostics = sdkMetadataDiagnostics(value, options);

  if (diagnostics.length > 0) {
    return { ok: false, value, diagnostics };
  }

  return { ok: true, value, diagnostics: [] };
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
  const sdkDiagnostics = candidate === undefined ? [] : sdkMetadataDiagnostics(candidate, options);

  return {
    ok: false,
    ...(candidate === undefined ? {} : { value: candidate }),
    diagnostics: [
      ...validation.errors.map((error) => ({
        code: "invalid_matrix",
        component: "matrix",
        message: `compatibility matrix does not match skenion.compatibility-matrix 0.1.0: ${error}`
      }) satisfies CompatibilityMatrixDiagnostic),
      ...sdkDiagnostics
    ]
  };
}

export function readCompatibilityMatrixForSdk(
  document: unknown,
  options: ValidateCompatibilityMatrixForSdkOptions = {}
): CompatibilityMatrixV01 {
  const validation = validateCompatibilityMatrixForSdk(document, options);
  if (!validation.ok) {
    throw new SkenionCompatibilityMatrixError(validation.diagnostics);
  }

  return validation.value;
}
