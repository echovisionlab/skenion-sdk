import { validateExtensionManifestV01 } from "@skenion/contracts";
import type {
  ExtensionCodecDescriptorV01,
  ExtensionFrontendMetadataV01,
  ExtensionHelpEntryV01,
  ExtensionKindV01,
  ExtensionManifestV01,
  ExtensionNativeBindingV01,
  ExtensionTestDescriptorV01,
  ExtensionTransportDescriptorV01,
  NodeDefinitionManifestV01
} from "@skenion/contracts";

const CURRENT_SCHEMA_VERSION = "0.1.0";

export interface DefineExtensionPackageOptions {
  id: string;
  version: string;
  kind: ExtensionKindV01;
  runtimeAbiVersion?: string;
  sdkVersion?: string;
  native?: ExtensionNativeBindingV01;
  nodes?: NodeDefinitionManifestV01[];
  codecs?: ExtensionCodecDescriptorV01[];
  transports?: ExtensionTransportDescriptorV01[];
  help?: ExtensionHelpEntryV01[];
  tests?: ExtensionTestDescriptorV01[];
  permissions?: string[];
  frontend?: ExtensionFrontendMetadataV01;
}

export class SkenionExtensionManifestError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion extension manifest: ${errors.join("; ")}`);
    this.name = "SkenionExtensionManifestError";
    this.errors = errors;
  }
}

function requireCurrentVersion(field: string, value: string): void {
  if (value !== CURRENT_SCHEMA_VERSION) {
    throw new SkenionExtensionManifestError([
      `${field} must be ${CURRENT_SCHEMA_VERSION}; received ${value}`
    ]);
  }
}

export function defineExtensionPackage(options: DefineExtensionPackageOptions): ExtensionManifestV01 {
  requireCurrentVersion("runtimeAbiVersion", options.runtimeAbiVersion ?? CURRENT_SCHEMA_VERSION);

  const manifest: ExtensionManifestV01 = {
    schema: "skenion.extension.manifest",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id,
    version: options.version,
    runtimeAbiVersion: options.runtimeAbiVersion ?? CURRENT_SCHEMA_VERSION,
    kind: options.kind,
    provides: {
      nodes: [...(options.nodes ?? [])],
      codecs: [...(options.codecs ?? [])],
      transports: [...(options.transports ?? [])],
      help: [...(options.help ?? [])]
    },
    permissions: [...(options.permissions ?? [])],
    tests: [...(options.tests ?? [])],
    ...(options.sdkVersion === undefined ? {} : { sdkVersion: options.sdkVersion }),
    ...(options.native === undefined ? {} : { native: options.native }),
    ...(options.frontend === undefined ? {} : { frontend: options.frontend })
  };

  const validation = validateExtensionManifestV01(manifest);
  if (!validation.ok) {
    throw new SkenionExtensionManifestError(validation.errors);
  }

  return validation.value;
}
