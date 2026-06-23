import { validateReleaseTrainManifestV01 } from "@skenion/contracts";
import type {
  ReleaseTrainManifestV01,
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
  | "missing_studio_web_bundle"
  | "missing_studio_desktop_package"
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
  requiredStudioDesktopTargets?: readonly ReleaseTrainTargetV01[];
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

interface ReleaseTrainVersionedArtifactForSdk {
  id?: string;
  version: string;
}

type ReleaseTrainTargetArtifactMapForSdk = Partial<
  Record<ReleaseTrainTargetV01, ReleaseTrainVersionedArtifactForSdk>
>;

interface ReleaseTrainRuntimeComponentForSdk {
  binaries?: ReleaseTrainTargetArtifactMapForSdk;
}

interface ReleaseTrainStudioComponentForSdk {
  "web-bundle"?: ReleaseTrainVersionedArtifactForSdk;
  "desktop-packages"?: ReleaseTrainTargetArtifactMapForSdk;
  "runtime-sidecars"?: ReleaseTrainTargetArtifactMapForSdk;
}

interface ReleaseTrainComponentsForSdk {
  runtime?: ReleaseTrainRuntimeComponentForSdk;
  studio?: ReleaseTrainStudioComponentForSdk;
}

export class SkenionReleaseTrainManifestError extends Error {
  readonly diagnostics: ReleaseTrainDiagnostic[];
  readonly errors: string[];

  constructor(diagnostics: ReleaseTrainDiagnostic[]) {
    const errors = diagnostics.map((diagnostic) => diagnostic.message);
    super(`Invalid skenion release train manifest: ${errors.join("; ")}`);
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

function releaseTrainComponentsForSdk(manifest: ReleaseTrainManifestV01): ReleaseTrainComponentsForSdk {
  return (manifest as unknown as { components: ReleaseTrainComponentsForSdk }).components;
}

function runtimeArtifactDiagnostics(
  trainVersion: string,
  binaries: ReleaseTrainTargetArtifactMapForSdk | undefined,
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

function webBundleDiagnostics(
  trainVersion: string,
  webBundle: ReleaseTrainVersionedArtifactForSdk | undefined
): ReleaseTrainDiagnostic[] {
  if (webBundle === undefined) {
    return [
      {
        code: "missing_studio_web_bundle",
        component: "studio",
        field: `components.studio["web-bundle"]`,
        expected: trainVersion,
        message: `Studio web bundle artifact is required for train ${trainVersion}`
      }
    ];
  }

  return versionDiagnostic(
    "studio_version_mismatch",
    "studio",
    `components.studio["web-bundle"].version`,
    trainVersion,
    webBundle.version
  );
}

function studioTargetArtifactDiagnostics(
  trainVersion: string,
  artifacts: ReleaseTrainTargetArtifactMapForSdk | undefined,
  targets: readonly ReleaseTrainTargetV01[],
  missingCode: Extract<ReleaseTrainDiagnosticCode, "missing_studio_desktop_package" | "missing_studio_sidecar">,
  fieldBase: "components.studio.desktop-packages" | "components.studio.runtime-sidecars",
  missingMessage: (target: ReleaseTrainTargetV01) => string
): ReleaseTrainDiagnostic[] {
  return targets.flatMap((target) => {
    const artifact = artifacts?.[target];
    if (artifact === undefined) {
      return [
        {
          code: missingCode,
          component: "studio",
          field: `${fieldBase}.${target}`,
          expected: trainVersion,
          target,
          message: missingMessage(target)
        } satisfies ReleaseTrainDiagnostic
      ];
    }

    return versionDiagnostic(
      "studio_version_mismatch",
      "studio",
      `${fieldBase}.version`,
      trainVersion,
      artifact.version,
      target
    );
  });
}

function componentVersionDiagnostics(
  manifest: ReleaseTrainManifestV01,
  options: ValidateReleaseTrainManifestOptions
): ReleaseTrainDiagnostic[] {
  const trainVersion = manifest["train-version"];
  const sdkPackageName = options.sdkPackageName ?? "@skenion/sdk";
  const components = releaseTrainComponentsForSdk(manifest);

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
    ...runtimeArtifactDiagnostics(
      trainVersion,
      components.runtime?.binaries,
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
    ...webBundleDiagnostics(trainVersion, components.studio?.["web-bundle"]),
    ...studioTargetArtifactDiagnostics(
      trainVersion,
      components.studio?.["desktop-packages"],
      options.requiredStudioDesktopTargets ?? RELEASE_TRAIN_TARGETS,
      "missing_studio_desktop_package",
      "components.studio.desktop-packages",
      (target) => `Studio desktop package artifact for ${target} is required for train ${trainVersion}`
    ),
    ...studioTargetArtifactDiagnostics(
      trainVersion,
      components.studio?.["runtime-sidecars"],
      options.requiredStudioSidecarTargets ?? RELEASE_TRAIN_TARGETS,
      "missing_studio_sidecar",
      "components.studio.runtime-sidecars",
      (target) => `Studio runtime sidecar for ${target} is required for train ${trainVersion}`
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
  const trainVersion = manifest["train-version"];
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
    candidate["schema-version"] !== "0.1.0" ||
    typeof candidate["train-version"] !== "string" ||
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

function releaseTrainValidationResultForValue(
  value: ReleaseTrainManifestV01,
  options: ValidateReleaseTrainManifestOptions
): ReleaseTrainManifestValidationResult {
  const diagnostics = [...componentVersionDiagnostics(value, options), ...sdkToolingDiagnostics(value, options)];

  if (diagnostics.length > 0) {
    return { ok: false, value, diagnostics };
  }

  return { ok: true, value, diagnostics: [] };
}

export function validateReleaseTrainManifestForSdk(
  document: unknown,
  options: ValidateReleaseTrainManifestOptions = {}
): ReleaseTrainManifestValidationResult {
  const validation = validateReleaseTrainManifestV01(document);
  if (validation.ok) {
    return releaseTrainValidationResultForValue(validation.value, options);
  }

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
