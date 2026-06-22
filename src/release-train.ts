import { validateReleaseTrainManifestV01 } from "@skenion/contracts";
import type {
  ReleaseTrainManifestV01,
  ReleaseTrainTargetArtifactMapV01,
  ReleaseTrainTargetV01
} from "@skenion/contracts";

const RELEASE_TRAIN_TARGETS: ReleaseTrainTargetV01[] = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu"
];

export type ReleaseTrainDiagnosticCode =
  | "invalid_manifest"
  | "sdk_version_mismatch"
  | "contracts_version_mismatch"
  | "runtime_version_mismatch"
  | "studio_version_mismatch"
  | "examples_version_mismatch"
  | "manual_version_mismatch"
  | "missing_runtime_artifact"
  | "missing_studio_sidecar"
  | "non_exact_contracts_dependency";

export type ReleaseTrainDiagnosticComponent =
  | "manifest"
  | "sdk"
  | "contracts"
  | "runtime"
  | "studio"
  | "examples"
  | "manual";

export interface ReleaseTrainDiagnostic {
  code: ReleaseTrainDiagnosticCode;
  component: ReleaseTrainDiagnosticComponent;
  message: string;
  field?: string;
  expected?: string;
  actual?: string;
  target?: ReleaseTrainTargetV01;
}

export interface ValidateReleaseTrainManifestOptions {
  sdkPackageName?: string;
  sdkPackageVersion?: string;
  contractsPackageVersion?: string;
  contractsDependencyRange?: string;
  requiredRuntimeTargets?: readonly ReleaseTrainTargetV01[];
  requiredStudioSidecarTargets?: readonly ReleaseTrainTargetV01[];
}

export type ReleaseTrainManifestValidationResult =
  | {
      ok: true;
      value: ReleaseTrainManifestV01;
      diagnostics: [];
    }
  | {
      ok: false;
      diagnostics: ReleaseTrainDiagnostic[];
      value?: ReleaseTrainManifestV01;
    };

export class SkenionReleaseTrainManifestError extends Error {
  readonly diagnostics: ReleaseTrainDiagnostic[];
  readonly errors: string[];

  constructor(diagnostics: ReleaseTrainDiagnostic[]) {
    const errors = diagnostics.map((diagnostic) => diagnostic.message);
    super(`Invalid Skenion release train manifest: ${errors.join("; ")}`);
    this.name = "SkenionReleaseTrainManifestError";
    this.diagnostics = diagnostics;
    this.errors = errors;
  }
}

function versionDiagnostic(
  code: ReleaseTrainDiagnosticCode,
  component: ReleaseTrainDiagnosticComponent,
  field: string,
  expected: string,
  actual: string,
  target?: ReleaseTrainTargetV01
): ReleaseTrainDiagnostic[] {
  if (actual === expected) {
    return [];
  }

  return [
    {
      code,
      component,
      field,
      expected,
      actual,
      ...(target === undefined ? {} : { target }),
      message:
        target === undefined
          ? `${field} must be exact train version ${expected}; received ${actual}`
          : `${field} for ${target} must be exact train version ${expected}; received ${actual}`
    }
  ];
}

function runtimeArtifactDiagnostics(
  trainVersion: string,
  binaries: Partial<ReleaseTrainTargetArtifactMapV01> | undefined,
  targets: readonly ReleaseTrainTargetV01[]
): ReleaseTrainDiagnostic[] {
  return targets.flatMap((target) => {
    const artifact = binaries?.[target];
    if (artifact === undefined) {
      return [
        {
          code: "missing_runtime_artifact",
          component: "runtime",
          field: `components.runtime.binaries.${target}`,
          expected: trainVersion,
          target,
          message: `runtime binary artifact for ${target} is required for train ${trainVersion}`
        } satisfies ReleaseTrainDiagnostic
      ];
    }

    return versionDiagnostic(
      "runtime_version_mismatch",
      "runtime",
      "components.runtime.binaries.version",
      trainVersion,
      artifact.version,
      target
    );
  });
}

function studioSidecarDiagnostics(
  trainVersion: string,
  sidecars: Partial<ReleaseTrainTargetArtifactMapV01> | undefined,
  targets: readonly ReleaseTrainTargetV01[]
): ReleaseTrainDiagnostic[] {
  return targets.flatMap((target) => {
    const sidecar = sidecars?.[target];
    if (sidecar === undefined) {
      return [
        {
          code: "missing_studio_sidecar",
          component: "studio",
          field: `components.studio.runtimeSidecars.${target}`,
          expected: trainVersion,
          target,
          message: `Studio runtime sidecar for ${target} is required for train ${trainVersion}`
        } satisfies ReleaseTrainDiagnostic
      ];
    }

    return versionDiagnostic(
      "studio_version_mismatch",
      "studio",
      "components.studio.runtimeSidecars.version",
      trainVersion,
      sidecar.version,
      target
    );
  });
}

function componentVersionDiagnostics(
  manifest: ReleaseTrainManifestV01,
  options: ValidateReleaseTrainManifestOptions
): ReleaseTrainDiagnostic[] {
  const trainVersion = manifest.trainVersion;
  const sdkPackageName = options.sdkPackageName ?? "@skenion/sdk";

  return [
    ...versionDiagnostic(
      "contracts_version_mismatch",
      "contracts",
      "components.contracts.npm.version",
      trainVersion,
      manifest.components.contracts.npm.version
    ),
    ...versionDiagnostic(
      "contracts_version_mismatch",
      "contracts",
      "components.contracts.crate.version",
      trainVersion,
      manifest.components.contracts.crate.version
    ),
    ...versionDiagnostic(
      "runtime_version_mismatch",
      "runtime",
      "components.runtime.crate.version",
      trainVersion,
      manifest.components.runtime.crate.version
    ),
    ...runtimeArtifactDiagnostics(
      trainVersion,
      manifest.components.runtime.binaries,
      options.requiredRuntimeTargets ?? RELEASE_TRAIN_TARGETS
    ),
    ...versionDiagnostic(
      "sdk_version_mismatch",
      "sdk",
      "components.sdk.npm.version",
      trainVersion,
      manifest.components.sdk.npm.version
    ),
    ...(manifest.components.sdk.npm.name === sdkPackageName
      ? []
      : [
          {
            code: "sdk_version_mismatch",
            component: "sdk",
            field: "components.sdk.npm.name",
            expected: sdkPackageName,
            actual: manifest.components.sdk.npm.name,
            message: `components.sdk.npm.name must be ${sdkPackageName}; received ${manifest.components.sdk.npm.name}`
          } satisfies ReleaseTrainDiagnostic
        ]),
    ...versionDiagnostic(
      "studio_version_mismatch",
      "studio",
      "components.studio.web.version",
      trainVersion,
      manifest.components.studio.web.version
    ),
    ...versionDiagnostic(
      "studio_version_mismatch",
      "studio",
      "components.studio.desktop.version",
      trainVersion,
      manifest.components.studio.desktop.version
    ),
    ...studioSidecarDiagnostics(
      trainVersion,
      manifest.components.studio.runtimeSidecars,
      options.requiredStudioSidecarTargets ?? RELEASE_TRAIN_TARGETS
    ),
    ...versionDiagnostic(
      "examples_version_mismatch",
      "examples",
      "components.examples.version",
      trainVersion,
      manifest.components.examples.version
    ),
    ...versionDiagnostic(
      "manual_version_mismatch",
      "manual",
      "components.docs.manual.version",
      trainVersion,
      manifest.components.docs.manual.version
    )
  ];
}

function sdkToolingDiagnostics(
  manifest: ReleaseTrainManifestV01,
  options: ValidateReleaseTrainManifestOptions
): ReleaseTrainDiagnostic[] {
  const trainVersion = manifest.trainVersion;
  const diagnostics: ReleaseTrainDiagnostic[] = [];

  if (options.sdkPackageVersion !== undefined) {
    diagnostics.push(
      ...versionDiagnostic(
        "sdk_version_mismatch",
        "sdk",
        "package.version",
        manifest.components.sdk.npm.version,
        options.sdkPackageVersion
      )
    );
  }
  if (options.contractsPackageVersion !== undefined) {
    diagnostics.push(
      ...versionDiagnostic(
        "contracts_version_mismatch",
        "contracts",
        "installed @skenion/contracts version",
        manifest.components.contracts.npm.version,
        options.contractsPackageVersion
      )
    );
  }
  if (
    options.contractsDependencyRange !== undefined &&
    options.contractsDependencyRange !== manifest.components.contracts.npm.version
  ) {
    diagnostics.push({
      code: "non_exact_contracts_dependency",
      component: "contracts",
      field: "peerDependencies.@skenion/contracts",
      expected: trainVersion,
      actual: options.contractsDependencyRange,
      message: `@skenion/contracts dependency declaration must be exact ${manifest.components.contracts.npm.version}; broad ranges are not train compatibility`
    });
  }

  return diagnostics;
}

function isComponentRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function releaseTrainPreflightValue(document: unknown): ReleaseTrainManifestV01 | undefined {
  const candidate = document as Partial<ReleaseTrainManifestV01>;
  const components = candidate.components as Partial<ReleaseTrainManifestV01["components"]> | undefined;
  const docs = components?.docs as Partial<ReleaseTrainManifestV01["components"]["docs"]> | undefined;

  if (
    candidate.schema !== "skenion.release-train" ||
    candidate.schemaVersion !== "0.1.0" ||
    typeof candidate.trainVersion !== "string" ||
    !isComponentRecord(components?.contracts) ||
    !isComponentRecord(components?.runtime) ||
    !isComponentRecord(components?.sdk) ||
    !isComponentRecord(components?.studio) ||
    !isComponentRecord(components?.examples) ||
    !isComponentRecord(docs?.manual)
  ) {
    return undefined;
  }

  return candidate as ReleaseTrainManifestV01;
}

export function validateReleaseTrainManifestForSdk(
  document: unknown,
  options: ValidateReleaseTrainManifestOptions = {}
): ReleaseTrainManifestValidationResult {
  const validation = validateReleaseTrainManifestV01(document);
  if (!validation.ok) {
    const candidate = releaseTrainPreflightValue(document);
    const sdkDiagnostics =
      candidate === undefined
        ? []
        : [...componentVersionDiagnostics(candidate, options), ...sdkToolingDiagnostics(candidate, options)];

    return {
      ok: false,
      ...(candidate === undefined ? {} : { value: candidate }),
      diagnostics: [
        ...validation.errors.map((error) => ({
          code: "invalid_manifest",
          component: "manifest",
          message: `release train manifest does not match skenion.release-train 0.1.0: ${error}`
        }) satisfies ReleaseTrainDiagnostic),
        ...sdkDiagnostics
      ]
    };
  }

  const diagnostics = [
    ...componentVersionDiagnostics(validation.value, options),
    ...sdkToolingDiagnostics(validation.value, options)
  ];

  if (diagnostics.length > 0) {
    return { ok: false, value: validation.value, diagnostics };
  }

  return { ok: true, value: validation.value, diagnostics: [] };
}

export function readReleaseTrainManifest(
  document: unknown,
  options: ValidateReleaseTrainManifestOptions = {}
): ReleaseTrainManifestV01 {
  const validation = validateReleaseTrainManifestForSdk(document, options);
  if (!validation.ok) {
    throw new SkenionReleaseTrainManifestError(validation.diagnostics);
  }

  return validation.value;
}
