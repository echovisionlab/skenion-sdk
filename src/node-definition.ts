import {
  validateNodeDefinition
} from "@skenion/contracts";
import type {
  DataTypeV01,
  ExecutionModelV01,
  NodeDefinitionManifestV01,
  NodeStateV01,
  PortActivation,
  PortDirection
} from "@skenion/contracts";

export interface ScriptNodeRuntimeContext {
  nodeId: string;
  emit(portId: string, value: unknown): void;
}

export interface ScriptNodeLifecycle {
  onInit?: (context: ScriptNodeRuntimeContext) => void | Promise<void>;
  onInput?: (
    context: ScriptNodeRuntimeContext,
    portId: string,
    value: unknown
  ) => void | Promise<void>;
  onEvent?: (
    context: ScriptNodeRuntimeContext,
    portId: string,
    event: unknown
  ) => void | Promise<void>;
  onDispose?: (context: ScriptNodeRuntimeContext) => void | Promise<void>;
}

export interface LegacyNodePortInputV01 {
  id: string;
  direction: PortDirection;
  type: DataTypeV01;
  label?: string;
  required?: boolean;
  default?: unknown;
  activation?: PortActivation;
}

export interface DefineLegacyNodeOptionsV01 {
  id: string;
  version: string;
  displayName: string;
  category: string;
  ports: LegacyNodePortInputV01[];
  execution: {
    model: ExecutionModelV01;
    clock?: "frame" | "audio" | "beat" | "timecode" | "external";
  };
  state?: Partial<NodeStateV01>;
  permissions?: string[];
  capabilities?: string[];
  scriptApiVersion?: string;
  bundleHash?: string;
  lifecycle?: ScriptNodeLifecycle;
}

/** @deprecated Use DefineLegacyNodeOptionsV01 for v0.1 import/migration helpers only. */
export interface DefineNodeOptions extends DefineLegacyNodeOptionsV01 {}

/** @deprecated Use LegacyNodePortInputV01 for v0.1 import/migration helpers only. */
export interface NodePortInput extends LegacyNodePortInputV01 {}

export class SkenionNodeDefinitionError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Skenion node definition: ${errors.join("; ")}`);
    this.name = "SkenionNodeDefinitionError";
    this.errors = errors;
  }
}

function normalizePort(port: LegacyNodePortInputV01): LegacyNodePortInputV01 {
  return {
    ...port,
    type: {
      ...port.type
    }
  };
}

export function defineLegacyNodeV01(options: DefineLegacyNodeOptionsV01): NodeDefinitionManifestV01 {
  const manifest: NodeDefinitionManifestV01 = {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id: options.id,
    version: options.version,
    displayName: options.displayName,
    category: options.category,
    ports: options.ports.map(normalizePort),
    execution: {
      ...options.execution
    },
    state: {
      persistent: options.state?.persistent ?? false
    },
    permissions: [...(options.permissions ?? [])],
    capabilities: [...(options.capabilities ?? [])],
    ...(options.scriptApiVersion === undefined
      ? {}
      : { scriptApiVersion: options.scriptApiVersion }),
    ...(options.bundleHash === undefined ? {} : { bundleHash: options.bundleHash })
  };

  const validation = validateNodeDefinition(manifest);
  if (!validation.ok) {
    throw new SkenionNodeDefinitionError(validation.errors);
  }

  return validation.value;
}

/** @deprecated v0.1 node manifests are legacy import/migration helpers only. Use defineNodeDefinition for active v0.2 node authoring. */
export const defineNode = defineLegacyNodeV01;
