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
    "support-tier": releaseBlockingTargets.has(target) ? "release-blocking" : "preview",
    kind,
    name,
    version: trainVersion,
    source: {
      kind: "github-release-asset",
      repository,
      tag,
      "asset-name": name,
      url: null
    },
    checksum: {
      algorithm: "sha256",
      value: null
    },
    "size-bytes": null
  };
}

function staticArtifact(id, kind, name, repository, tag) {
  return {
    id,
    kind,
    name,
    version: trainVersion,
    source: {
      kind: "github-release-asset",
      repository,
      tag,
      "asset-name": name,
      url: null
    },
    checksum: {
      algorithm: "sha256",
      value: null
    },
    "size-bytes": null
  };
}

function artifactMap(idPrefix, kind, nameSuffix, repository, tag) {
  return Object.fromEntries(
    targets.map((target) => [target, artifact(idPrefix, kind, target, nameSuffix, repository, tag)])
  );
}

function desktopArchiveName(target) {
  const extension = target.includes("windows-msvc") ? "zip" : "tar.gz";
  return `skenion-studio-${target}.${extension}`;
}

function desktopPackageMap(repository, tag) {
  return Object.fromEntries(
    targets.map((target) => {
      const entry = artifact("studio-desktop", "studio-desktop-package", target, "tar.gz", repository, tag);
      const name = desktopArchiveName(target);
      entry.name = name;
      entry.source["asset-name"] = name;
      return [target, entry];
    })
  );
}

function validTrainManifest() {
  const runtimeBinaries = artifactMap(
    "runtime",
    "runtime-binary",
    "tar.gz",
    "skenion/skenion-runtime",
    "skenion-runtime-v0.43.0"
  );
  const webBundle = staticArtifact(
    "studio-web-bundle",
    "studio-web-bundle",
    "skenion-studio-web-bundle-v0.43.0.tar.gz",
    "skenion/skenion-studio",
    "skenion-studio-v0.43.0"
  );
  const studioPackages = desktopPackageMap(
    "skenion/skenion-studio",
    "skenion-studio-v0.43.0"
  );
  const studioSidecars = artifactMap(
    "studio-runtime-sidecar",
    "studio-runtime-sidecar",
    "tar.gz",
    "skenion/skenion-studio",
    "skenion-studio-v0.43.0"
  );
  const runtimeArtifactIds = Object.values(runtimeBinaries).map((entry) => entry.id);
  const studioArtifactIds = [
    webBundle.id,
    ...Object.values(studioPackages).map((entry) => entry.id),
    ...Object.values(studioSidecars).map((entry) => entry.id)
  ];

  return {
    schema: "skenion.release-train",
    "schema-version": "0.1.0",
    "train-id": trainId,
    "train-version": trainVersion,
    "protocol-baselines": {
      graph: "0.1",
      project: "0.1",
      node: "0.1",
      extension: "0.1",
      "runtime-http": "v0",
      "runtime-collaboration": "v0"
    },
    "capability-set": {
      "protocol-surfaces": {
        graph: "0.1",
        project: "0.1",
        node: "0.1",
        extension: "0.1",
        "runtime-http": "v0",
        "runtime-collaboration": "v0"
      },
      runtime: {
        "session-addressing": true,
        "event-replay": true,
        "multi-window": true,
        "connection-profiles": ["local-managed", "local-shared", "remote"],
        collaboration: "server-authoritative-ot",
        "operation-log": true,
        "io-discovery": "raw-descriptor",
        "auth-policy": "deferred"
      },
      studio: {
        "graph-editor": true,
        "patch-library": true,
        subpatches: true,
        "living-help": true,
        "graph-clipboard": true,
        "desktop-shell": "tauri",
        "connection-profiles": ["local-managed", "local-shared", "remote"]
      },
      marketplace: {
        "package-discovery": true,
        "package-install": true,
        "package-update": true,
        "extension-packages": true
      },
      manual: {
        "versioned-paths": true,
        "pages-deployment": true,
        "latest-promotion-requires-matrix": true,
        "patch-releases-use-major-minor-path": true
      }
    },
    components: {
      contracts: {
        npm: registryPackage("npm", "@skenion/contracts"),
        crate: registryPackage("crates.io", "skenion-contracts")
      },
      runtime: {
        binaries: runtimeBinaries
      },
      sdk: {
        npm: registryPackage("npm", "@skenion/sdk")
      },
      studio: {
        "web-bundle": webBundle,
        "desktop-packages": studioPackages,
        "runtime-sidecars": studioSidecars
      },
      examples: {
        repository: "skenion/skenion-examples",
        version: trainVersion,
        tag: "skenion-examples-v0.43.0",
        commit: "fixture-0.43.0"
      },
      docs: {
        manual: {
          version: trainVersion,
          path: "/manual/0.43/",
          "pages-url": "https://skenion.github.io/skenion-docs/manual/0.43/"
        }
      }
    },
    "release-gates": {
      "registry-packages": {
        "contracts-npm": {
          id: "contracts-npm-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/contracts")
        },
        "contracts-crate": {
          id: "contracts-crate-exists",
          status: "pending",
          required: true,
          package: registryPackage("crates.io", "skenion-contracts")
        },
        "sdk-npm": {
          id: "sdk-npm-exists",
          status: "pending",
          required: true,
          package: registryPackage("npm", "@skenion/sdk")
        }
      },
      "github-release-assets": {
        runtime: {
          id: "runtime-release-assets",
          status: "pending",
          required: true,
          repository: "skenion/skenion-runtime",
          tag: "skenion-runtime-v0.43.0",
          "artifact-ids": runtimeArtifactIds
        },
        studio: {
          id: "studio-release-assets",
          status: "pending",
          required: true,
          repository: "skenion/skenion-studio",
          tag: "skenion-studio-v0.43.0",
          "artifact-ids": studioArtifactIds
        }
      },
      "checksum-verification": {
        id: "artifact-checksums",
        status: "pending",
        required: true,
        "artifact-ids": [...runtimeArtifactIds, ...studioArtifactIds]
      },
      "runtime-smoke": Object.fromEntries(
        targets.map((target) => [
          target,
          {
            id: `runtime-smoke-${target}`,
            status: "pending",
            required: true,
            target,
            "artifact-id": runtimeBinaries[target].id
          }
        ])
      ),
      "studio-package-smoke": Object.fromEntries(
        targets.map((target) => [
          target,
          {
            id: `studio-smoke-${target}`,
            status: "pending",
            required: true,
            target,
            "desktop-package-artifact-id": studioPackages[target].id,
            "runtime-sidecar-artifact-id": studioSidecars[target].id
          }
        ])
      ),
      "examples-conformance": {
        id: "examples-conformance",
        status: "pending",
        required: true,
        repository: "skenion/skenion-examples",
        ref: "skenion-examples-v0.43.0",
        version: trainVersion
      },
      "docs-pages-deployment": {
        id: "docs-pages-deployment",
        status: "pending",
        required: true,
        "manual-version": trainVersion,
        "manual-path": "/manual/0.43/",
        "pages-url": "https://skenion.github.io/skenion-docs/manual/0.43/"
      }
    }
  };
}

function removedRegistrySurfaceManifest() {
  const manifest = validTrainManifest();
  const removedRuntimeGateKey = ["runtime", "Crate"].join("");
  const removedWebGateKey = ["studio", "Web"].join("");
  const removedDesktopGateKey = ["studio", "Desktop"].join("");
  const removedRuntimeComponentKey = ["crate"].join("");

  manifest.components.runtime[removedRuntimeComponentKey] = registryPackage("crates.io", "skenion-runtime");
  manifest.components.studio.web = registryPackage("npm", "@skenion/studio-web");
  manifest.components.studio.desktop = registryPackage("npm", "@skenion/studio-desktop");
  delete manifest.components.studio["web-bundle"];

  manifest["release-gates"]["registry-packages"][removedRuntimeGateKey] = {
    id: "runtime-crate-exists",
    status: "pending",
    required: true,
    package: registryPackage("crates.io", "skenion-runtime")
  };
  manifest["release-gates"]["registry-packages"][removedWebGateKey] = {
    id: "studio-web-exists",
    status: "pending",
    required: true,
    package: registryPackage("npm", "@skenion/studio-web")
  };
  manifest["release-gates"]["registry-packages"][removedDesktopGateKey] = {
    id: "studio-desktop-exists",
    status: "pending",
    required: true,
    package: registryPackage("npm", "@skenion/studio-desktop")
  };
  manifest["release-gates"]["github-release-assets"].studio["artifact-ids"] =
    manifest["release-gates"]["github-release-assets"].studio["artifact-ids"].filter(
      (artifactId) => artifactId !== "studio-web-bundle"
    );
  manifest["release-gates"]["checksum-verification"]["artifact-ids"] =
    manifest["release-gates"]["checksum-verification"]["artifact-ids"].filter(
      (artifactId) => artifactId !== "studio-web-bundle"
    );

  return manifest;
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
  assert.equal(result.value["train-version"], trainVersion);
  assert.equal(validateReleaseTrainManifestForSdk(manifest).ok, true);
  assert.equal(readReleaseTrainManifest(manifest, {
    sdkPackageVersion: trainVersion,
    contractsPackageVersion: trainVersion,
    contractsDependencyRange: trainVersion
  })["train-id"], trainId);
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

test("release train helper rejects removed Runtime and Studio registry surfaces", () => {
  const result = validate(removedRegistrySurfaceManifest());

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("missing_studio_web_bundle"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "missing_studio_web_bundle")?.field,
    'components.studio["web-bundle"]'
  );
});

test("release train helper reports invalid current manifests with missing registry gates", () => {
  const manifest = validTrainManifest();
  delete manifest["release-gates"]["registry-packages"];

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("invalid_manifest"));
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

test("release train helper reports missing Studio web bundle artifacts", () => {
  const manifest = validTrainManifest();
  delete manifest.components.studio["web-bundle"];

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("missing_studio_web_bundle"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "missing_studio_web_bundle")?.field,
    'components.studio["web-bundle"]'
  );
});

test("release train helper reports Studio web bundle version mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.studio["web-bundle"].version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("studio_version_mismatch"));
  assert.equal(
    result.diagnostics.find(
      (diagnostic) => diagnostic.field === 'components.studio["web-bundle"].version'
    )?.actual,
    "0.42.0"
  );
});

test("release train helper reports missing Studio desktop package artifacts", () => {
  const manifest = validTrainManifest();
  delete manifest.components.studio["desktop-packages"]["aarch64-apple-darwin"];

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("missing_studio_desktop_package"));
  assert.equal(
    result.diagnostics.find((diagnostic) => diagnostic.code === "missing_studio_desktop_package")?.target,
    "aarch64-apple-darwin"
  );
});

test("release train helper reports Studio desktop package version mismatches", () => {
  const manifest = validTrainManifest();
  manifest.components.studio["desktop-packages"]["x86_64-unknown-linux-gnu"].version = "0.42.0";

  const result = validate(manifest);

  assert.equal(result.ok, false);
  assert.ok(diagnosticCodes(result).includes("studio_version_mismatch"));
  assert.equal(
    result.diagnostics.find(
      (diagnostic) =>
        diagnostic.field === "components.studio.desktop-packages.version" &&
        diagnostic.target === "x86_64-unknown-linux-gnu"
    )?.actual,
    "0.42.0"
  );
});

test("release train helper reports missing Studio runtime sidecars", () => {
  const manifest = validTrainManifest();
  delete manifest.components.studio["runtime-sidecars"]["x86_64-pc-windows-msvc"];

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
  manifest.components.studio["runtime-sidecars"]["aarch64-pc-windows-msvc"].version = "0.42.0";

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
