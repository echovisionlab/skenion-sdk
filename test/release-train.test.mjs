import assert from "node:assert/strict";
import test from "node:test";
import {
  SkenionReleaseTrainManifestError,
  readReleaseTrainManifest,
  validateReleaseTrainManifestForSdk
} from "../dist/index.js";

const trainId = "0.43";
const trainVersion = "0.43.0";
const targets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu"
];
const releaseBlockingTargets = new Set([
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu"
]);

function registryPackage(ecosystem, name) {
  return {
    ecosystem,
    name,
    version: trainVersion,
    url: null
  };
}

function artifact(idPrefix, kind, target, nameSuffix, repository, tag) {
  const name = `${idPrefix}-${target}.${nameSuffix}`;

  return {
    id: `${idPrefix}-${target}`,
    target,
    supportTier: releaseBlockingTargets.has(target) ? "release-blocking" : "preview",
    kind,
    name,
    version: trainVersion,
    source: {
      kind: "github-release-asset",
      repository,
      tag,
      assetName: name,
      url: null
    },
    checksum: {
      algorithm: "sha256",
      value: null
    },
    sizeBytes: null
  };
}

function artifactMap(idPrefix, kind, nameSuffix, repository, tag) {
  return Object.fromEntries(
    targets.map((target) => [target, artifact(idPrefix, kind, target, nameSuffix, repository, tag)])
  );
}

function validTrainManifest() {
  const runtimeBinaries = artifactMap(
    "runtime",
    "runtime-binary",
    "tar.gz",
    "echovisionlab/Skenion-runtime",
    "skenion-runtime-v0.43.0"
  );
  const studioDesktopPackages = artifactMap(
    "studio-desktop",
    "studio-desktop-package",
    "dmg",
    "echovisionlab/Skenion-studio",
    "skenion-studio-v0.43.0"
  );
  const studioSidecars = artifactMap(
    "studio-runtime-sidecar",
    "studio-runtime-sidecar",
    "tar.gz",
    "echovisionlab/Skenion-studio",
    "skenion-studio-v0.43.0"
  );
  const runtimeArtifactIds = Object.values(runtimeBinaries).map((entry) => entry.id);
  const studioArtifactIds = [
    ...Object.values(studioDesktopPackages).map((entry) => entry.id),
    ...Object.values(studioSidecars).map((entry) => entry.id)
  ];

  return {
    schema: "skenion.release-train",
    schemaVersion: "0.1.0",
    trainId,
    trainVersion,
    protocolBaselines: {
      graph: "0.1",
      project: "0.1",
      node: "0.1",
      extension: "0.1",
      runtimeHttp: "v0",
      runtimeCollaboration: "v0"
    },
    capabilitySet: {
      protocolSurfaces: {
        graph: "0.1",
        project: "0.1",
        node: "0.1",
        extension: "0.1",
        runtimeHttp: "v0",
        runtimeCollaboration: "v0"
      },
      runtime: {
        sessionAddressing: true,
        eventReplay: true,
        multiWindow: true,
        connectionProfiles: ["local-managed", "local-shared", "remote"],
        collaboration: "server-authoritative-ot",
        operationLog: true,
        ioDiscovery: "raw-descriptor",
        authPolicy: "deferred"
      },
      studio: {
        graphEditor: true,
        patchLibrary: true,
        subpatches: true,
        livingHelp: true,
        graphClipboard: true,
        desktopShell: "tauri",
        connectionProfiles: ["local-managed", "local-shared", "remote"]
      },
      marketplace: {
        packageDiscovery: true,
        packageInstall: true,
        packageUpdate: true,
        extensionPackages: true
      },
      manual: {
        versionedPaths: true,
        pagesDeployment: true,
        latestPromotionRequiresMatrix: true,
        patchReleasesUseMajorMinorPath: true
      }
    },
    components: {
      contracts: {
        npm: registryPackage("npm", "@skenion/contracts"),
        crate: registryPackage("crates.io", "skenion-contracts")
      },
      runtime: {
        crate: registryPackage("crates.io", "skenion-runtime"),
        binaries: runtimeBinaries
      },
      sdk: {
        npm: registryPackage("npm", "@skenion/sdk")
      },
      studio: {
        web: registryPackage("npm", "@skenion/studio-web"),
        desktop: registryPackage("npm", "@skenion/studio-desktop"),
        desktopPackages: studioDesktopPackages,
        runtimeSidecars: studioSidecars
      },
      examples: {
        repository: "echovisionlab/Skenion-examples",
        version: trainVersion,
        tag: "skenion-examples-v0.43.0",
        commit: "fixture-0.43.0"
      },
      docs: {
        manual: {
          version: trainVersion,
          path: "/manual/0.43/",
          pagesUrl: "https://echovisionlab.github.io/Skenion-docs/manual/0.43/"
        }
      }
    },
    releaseGates: {
      registryPackages: {
        contractsNpm: {
          id: "contracts-npm-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/contracts")
        },
        contractsCrate: {
          id: "contracts-crate-exists",
          status: "pending",
          required: true,
          package: registryPackage("crates.io", "skenion-contracts")
        },
        runtimeCrate: {
          id: "runtime-crate-exists",
          status: "pending",
          required: true,
          package: registryPackage("crates.io", "skenion-runtime")
        },
        sdkNpm: {
          id: "sdk-npm-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/sdk")
        },
        studioWeb: {
          id: "studio-web-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/studio-web")
        },
        studioDesktop: {
          id: "studio-desktop-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/studio-desktop")
        }
      },
      githubReleaseAssets: {
        runtime: {
          id: "runtime-release-assets",
          status: "pending",
          required: true,
          repository: "echovisionlab/Skenion-runtime",
          tag: "skenion-runtime-v0.43.0",
          artifactIds: runtimeArtifactIds
        },
        studio: {
          id: "studio-release-assets",
          status: "pending",
          required: true,
          repository: "echovisionlab/Skenion-studio",
          tag: "skenion-studio-v0.43.0",
          artifactIds: studioArtifactIds
        }
      },
      checksumVerification: {
        id: "artifact-checksums",
        status: "pending",
        required: true,
        artifactIds: [...runtimeArtifactIds, ...studioArtifactIds]
      },
      runtimeSmoke: Object.fromEntries(
        targets.map((target) => [
          target,
          {
            id: `runtime-smoke-${target}`,
            status: "pending",
            required: true,
            target,
            artifactId: runtimeBinaries[target].id
          }
        ])
      ),
      studioPackageSmoke: Object.fromEntries(
        targets.map((target) => [
          target,
          {
            id: `studio-smoke-${target}`,
            status: "pending",
            required: true,
            target,
            desktopPackageArtifactId: studioDesktopPackages[target].id,
            runtimeSidecarArtifactId: studioSidecars[target].id
          }
        ])
      ),
      examplesConformance: {
        id: "examples-conformance",
        status: "pending",
        required: true,
        repository: "echovisionlab/Skenion-examples",
        ref: "skenion-examples-v0.43.0",
        version: trainVersion
      },
      docsPagesDeployment: {
        id: "docs-pages-deployment",
        status: "pending",
        required: true,
        manualVersion: trainVersion,
        manualPath: "/manual/0.43/",
        pagesUrl: "https://echovisionlab.github.io/Skenion-docs/manual/0.43/"
      }
    }
  };
}

function validate(manifest, options = {}) {
  return validateReleaseTrainManifestForSdk(manifest, {
    sdkPackageVersion: trainVersion,
    contractsPackageVersion: trainVersion,
    contractsDependencyRange: trainVersion,
    ...options
  });
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

test("release train helper accepts a valid Contracts 0.1 manifest", () => {
  const manifest = validTrainManifest();
  const result = validate(manifest);

  assert.equal(result.ok, true);
  assert.equal(result.value.trainVersion, trainVersion);
  assert.equal(validateReleaseTrainManifestForSdk(manifest).ok, true);
  assert.equal(readReleaseTrainManifest(manifest, {
    sdkPackageVersion: trainVersion,
    contractsPackageVersion: trainVersion,
    contractsDependencyRange: trainVersion
  }).trainId, trainId);
});

test("release train helper reports mismatched SDK package metadata and broad Contracts ranges", () => {
  const result = validate(validTrainManifest(), {
    sdkPackageVersion: "0.42.0",
    contractsDependencyRange: "^0.43.0"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["sdk_version_mismatch", "non_exact_contracts_dependency"]);
  assert.match(result.diagnostics[1].message, /broad ranges/);
  assert.throws(
    () =>
      readReleaseTrainManifest(validTrainManifest(), {
        sdkPackageVersion: "0.42.0",
        contractsPackageVersion: trainVersion,
        contractsDependencyRange: "^0.43.0"
      }),
    SkenionReleaseTrainManifestError
  );
});

test("release train helper reports SDK package name mismatches", () => {
  const result = validate(validTrainManifest(), {
    sdkPackageName: "@example/not-sdk"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["sdk_version_mismatch"]);
  assert.equal(result.diagnostics[0].field, "components.sdk.npm.name");
});

test("release train helper reports missing Runtime artifacts", () => {
  const manifest = validTrainManifest();
  delete manifest.components.runtime.binaries["aarch64-apple-darwin"];

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("invalid_manifest"));
  assert.ok(diagnosticCodes(result).includes("missing_runtime_artifact"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "missing_runtime_artifact")?.target,
    "aarch64-apple-darwin"
  );
});

test("release train helper reports Runtime artifact version mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.runtime.binaries["x86_64-apple-darwin"].version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("runtime_version_mismatch"));
  assert.match(
    result.diagnostics.find((diagnostic) => diagnostic.code === "runtime_version_mismatch")?.message ?? "",
    /x86_64-apple-darwin/
  );
});

test("release train helper reports missing Studio runtime sidecars", () => {
  const manifest = validTrainManifest();
  delete manifest.components.studio.runtimeSidecars["x86_64-pc-windows-msvc"];

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("missing_studio_sidecar"));
  assert.match(
    result.diagnostics.find((diagnostic) => diagnostic.code === "missing_studio_sidecar")?.message ?? "",
    /Studio runtime sidecar/
  );
});

test("release train helper reports Studio sidecar version mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.studio.runtimeSidecars["aarch64-pc-windows-msvc"].version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("studio_version_mismatch"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "studio_version_mismatch")?.target,
    "aarch64-pc-windows-msvc"
  );
});

test("release train helper reports Manual version mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.docs.manual.version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("manual_version_mismatch"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "manual_version_mismatch")?.actual,
    "0.42.0"
  );
});

test("release train helper reports Contracts and Examples train mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.contracts.npm.version = "0.42.0";
  manifest.components.examples.version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("contracts_version_mismatch"));
  assert.ok(diagnosticCodes(result).includes("examples_version_mismatch"));
});

test("release train helper rejects malformed release train documents", () => {
  const result = validateReleaseTrainManifestForSdk("not a manifest");

  assert.equal(result.ok, false);
  assert.deepEqual(diagnosticCodes(result), ["invalid_manifest"]);
  assert.throws(() => readReleaseTrainManifest("not a manifest"), SkenionReleaseTrainManifestError);
});
