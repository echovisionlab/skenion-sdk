import {
  validateNodeDefinition,
  validatePackageManifestV01
} from "@skenion/contracts";
import type {
  NodeDefinitionManifestV01,
  PackageCategoryV01,
  PackageChecksumRefV01,
  PackageContractsRequirementV01,
  PackageIssueV01,
  PackageEvidenceRefV01,
  PackageManifestV01,
  PackageNativeArtifactV01,
  PackageObjectExportV01,
  PackagePathsV01,
  PackageProvidedRefV01,
  PackageTargetTripleV01
} from "@skenion/contracts";
import {
  parseObjectSpec
} from "./project-authoring.js";
import { SDK_CONTRACTS_BUILT_AGAINST_VERSION } from "./contracts-version.js";

const CURRENT_SCHEMA_VERSION = "0.1.0";
const DEFAULT_CONTRACTS_REQUIREMENT: PackageContractsRequirementV01 = {
  version: SDK_CONTRACTS_BUILT_AGAINST_VERSION
};

export interface DefinedObjectDisplayOptions {
  title?: string;
  category?: string;
  description?: string;
  helpId?: string;
}

export interface DefinedPackageObject extends PackageObjectExportV01 {
  definition: NodeDefinitionManifestV01;
  display?: DefinedObjectDisplayOptions;
}

export interface DefineObjectOptions {
  objectId: string;
  primaryObjectSpec: string;
  aliases?: string[];
  definition: NodeDefinitionManifestV01;
  definitionPath?: string;
  display?: DefinedObjectDisplayOptions;
}

export interface DefinePackageManifestOptions {
  id: string;
  version: string;
  displayName?: string;
  category?: PackageCategoryV01;
  contracts?: PackageContractsRequirementV01;
  runtimeAbiRange?: string;
  targets?: PackageTargetTripleV01[];
  objects?: DefinedPackageObject[];
  patches?: PackageProvidedRefV01[];
  resources?: PackageProvidedRefV01[];
  help?: PackageProvidedRefV01[];
  paths?: PackagePathsV01;
  checksums?: PackageChecksumRefV01[];
  evidence?: PackageEvidenceRefV01[];
  nativeArtifacts?: PackageNativeArtifactV01[];
  issues?: PackageIssueV01[];
}

export class SkenionPackageManifestError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion package manifest: ${errors.join("; ")}`);
    this.name = "SkenionPackageManifestError";
    this.errors = errors;
  }
}

function normalizeObjectSpec(input: string): string {
  const parsed = parseObjectSpec(input);
  if (!parsed.ok) {
    throw new SkenionPackageManifestError(parsed.issues.map((issue) => issue.message));
  }

  return parsed.displayText;
}

function readNodeDefinition(definition: NodeDefinitionManifestV01): NodeDefinitionManifestV01 {
  const validation = validateNodeDefinition(definition);
  if (!validation.ok) {
    throw new SkenionPackageManifestError(validation.errors);
  }

  return validation.value;
}

function packageObjectExport(object: DefinedPackageObject): PackageObjectExportV01 {
  return {
    objectId: object.objectId,
    primaryObjectSpec: object.primaryObjectSpec,
    definitionPath: object.definitionPath,
    ...(object.aliases === undefined ? {} : { aliases: [...object.aliases] }),
    ...(object.description === undefined ? {} : { description: object.description }),
    ...(object.helpId === undefined ? {} : { helpId: object.helpId })
  };
}

function assertObjectHelpIdsResolve(objects: DefinedPackageObject[], help: PackageProvidedRefV01[]): void {
  const helpIds = new Set(help.map((entry) => entry.id));
  const missing = objects
    .filter((object) => object.helpId !== undefined && !helpIds.has(object.helpId))
    .map((object) => `${object.objectId} -> ${object.helpId}`);

  if (missing.length > 0) {
    throw new SkenionPackageManifestError(
      missing.map((entry) => `object helpId does not resolve to provided help: ${entry}`)
    );
  }
}

export function defineObject(options: DefineObjectOptions): DefinedPackageObject {
  const definition = readNodeDefinition(options.definition);
  const display = options.display === undefined ? undefined : { ...options.display };
  const helpId = display?.helpId;
  const description = display?.description;

  return {
    objectId: options.objectId,
    primaryObjectSpec: normalizeObjectSpec(options.primaryObjectSpec),
    ...(options.aliases === undefined
      ? {}
      : { aliases: options.aliases.map((alias) => normalizeObjectSpec(alias)) }),
    definitionPath: options.definitionPath ?? `objects/${options.objectId}.node.json`,
    ...(description === undefined ? {} : { description }),
    ...(helpId === undefined ? {} : { helpId }),
    definition,
    ...(display === undefined ? {} : { display })
  };
}

export function definePackageManifest(options: DefinePackageManifestOptions): PackageManifestV01 {
  const objects = [...(options.objects ?? [])];
  const help = [...(options.help ?? [])];
  assertObjectHelpIdsResolve(objects, help);

  const manifest: PackageManifestV01 = {
    schema: "skenion.package.manifest",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id,
    version: options.version,
    ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
    category: options.category ?? "patch",
    contracts: options.contracts ?? DEFAULT_CONTRACTS_REQUIREMENT,
    ...(options.runtimeAbiRange === undefined ? {} : { runtimeAbiRange: options.runtimeAbiRange }),
    ...(options.targets === undefined ? {} : { targets: [...options.targets] }),
    provides: {
      ...(options.patches === undefined ? {} : { patches: [...options.patches] }),
      ...(objects.length === 0 ? {} : { objects: objects.map((object) => packageObjectExport(object)) }),
      ...(options.resources === undefined ? {} : { resources: [...options.resources] }),
      ...(help.length === 0 ? {} : { help })
    },
    paths: { ...(options.paths ?? {}) },
    checksums: [...(options.checksums ?? [])],
    evidence: [...(options.evidence ?? [])],
    ...(options.nativeArtifacts === undefined ? {} : { nativeArtifacts: [...options.nativeArtifacts] }),
    ...(options.issues === undefined ? {} : { issues: [...options.issues] })
  };

  const validation = validatePackageManifestV01(manifest);
  if (!validation.ok) {
    throw new SkenionPackageManifestError(validation.errors);
  }

  return validation.value;
}
