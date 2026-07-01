import {
  validateNodeCatalogSnapshotV01
} from "@skenion/contracts";
import type {
  GraphNodeV01,
  NodeCatalogEntryV01,
  NodeCatalogSnapshotV01,
  ObjectImplementationRefV01,
  ObjectSpecParseResultV01,
  PortSpecV01
} from "@skenion/contracts";
import {
  SkenionProjectAuthoringError,
  defineObjectNode,
  parseObjectSpec
} from "./project-authoring.js";

export interface CreateObjectNodeFromCatalogEntryOptions {
  id: string;
  objectSpec?: string;
  implementation?: ObjectImplementationRefV01;
  params?: Record<string, unknown>;
  ports?: PortSpecV01[];
}

export type CatalogObjectSpecResolution =
  | {
      status: "resolved";
      objectSpec: string;
      parse: ObjectSpecParseResultV01;
      entry: NodeCatalogEntryV01;
    }
  | {
      status: "ambiguous";
      objectSpec: string;
      parse: ObjectSpecParseResultV01;
      entries: NodeCatalogEntryV01[];
      issues: string[];
    }
  | {
      status: "unresolved";
      objectSpec: string;
      parse: ObjectSpecParseResultV01;
      issues: string[];
    };

export class SkenionObjectCatalogError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid skenion object catalog value: ${errors.join("; ")}`);
    this.name = "SkenionObjectCatalogError";
    this.errors = errors;
  }
}

function readCatalogSnapshot(snapshot: NodeCatalogSnapshotV01): NodeCatalogSnapshotV01 {
  const validation = validateNodeCatalogSnapshotV01(snapshot);
  if (!validation.ok) {
    throw new SkenionObjectCatalogError(validation.errors);
  }

  return validation.value;
}

function normalizedObjectSpec(input: string): { spec: string; parse: ObjectSpecParseResultV01 } {
  const parsed = parseObjectSpec(input);
  if (!parsed.ok) {
    throw new SkenionObjectCatalogError(parsed.issues.map((issue) => issue.message));
  }

  return { spec: parsed.displayText, parse: parsed };
}

function entrySpecs(entry: NodeCatalogEntryV01): string[] {
  return [entry.primaryObjectSpec, ...(entry.aliases ?? [])];
}

function entryMatchesSpec(entry: NodeCatalogEntryV01, spec: string): boolean {
  return entrySpecs(entry).some((candidate) => normalizedObjectSpec(candidate).spec === spec);
}

function implementationForCatalogEntry(entry: NodeCatalogEntryV01): ObjectImplementationRefV01 {
  return {
    provider: entry.provider,
    objectId: entry.objectId
  };
}

export function objectSpecForCatalogEntry(entry: NodeCatalogEntryV01): string {
  return normalizedObjectSpec(entry.primaryObjectSpec).spec;
}

export function createObjectNodeFromCatalogEntry(
  entry: NodeCatalogEntryV01,
  options: CreateObjectNodeFromCatalogEntryOptions
): GraphNodeV01 {
  const objectSpec = normalizedObjectSpec(options.objectSpec ?? entry.primaryObjectSpec).spec;

  if (!entryMatchesSpec(entry, objectSpec)) {
    throw new SkenionProjectAuthoringError([
      `objectSpec ${JSON.stringify(objectSpec)} is not exported by catalog entry ${entry.catalogId}`
    ]);
  }

  const implementation = options.implementation ?? implementationForCatalogEntry(entry);
  return defineObjectNode({
    id: options.id,
    objectSpec,
    implementation,
    objectResolution: {
      status: "resolved",
      selectedSpec: objectSpec,
      candidates: [
        {
          implementation,
          objectSpec: entry.primaryObjectSpec,
          displayName: entry.display.title,
          reason: "catalog-entry"
        }
      ]
    },
    params: options.params,
    ports: options.ports ?? entry.definition.ports
  });
}

export function resolveCatalogObjectSpec(
  snapshot: NodeCatalogSnapshotV01,
  text: string
): CatalogObjectSpecResolution {
  const catalog = readCatalogSnapshot(snapshot);
  const parsed = parseObjectSpec(text);
  const objectSpec = parsed.displayText;

  if (!parsed.ok) {
    return {
      status: "unresolved",
      objectSpec,
      parse: parsed,
      issues: parsed.issues.map((issue) => issue.message)
    };
  }

  const matches = catalog.entries.filter((entry) => entryMatchesSpec(entry, objectSpec));
  if (matches.length === 1) {
    return {
      status: "resolved",
      objectSpec,
      parse: parsed,
      entry: matches[0]
    };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      objectSpec,
      parse: parsed,
      entries: matches,
      issues: [
        `objectSpec ${JSON.stringify(objectSpec)} resolves to multiple catalog entries: ${matches
          .map((entry) => entry.catalogId)
          .join(", ")}`
      ]
    };
  }

  return {
    status: "unresolved",
    objectSpec,
    parse: parsed,
    issues: [`objectSpec ${JSON.stringify(objectSpec)} is not present in the catalog`]
  };
}
