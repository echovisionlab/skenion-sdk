import type {
  DataTypeV01
} from "@skenion/contracts";

export type LegacyTypeConstraintsV01 = Omit<DataTypeV01, "flow" | "dataKind">;

/** @deprecated Use LegacyTypeConstraintsV01 for v0.1 import/migration helpers only. */
export type TypeConstraints = LegacyTypeConstraintsV01;

export interface LegacyDataKindSpecV01 extends LegacyTypeConstraintsV01 {
  dataKind: string;
}

/** @deprecated Use LegacyDataKindSpecV01 for v0.1 import/migration helpers only. */
export interface DataKindSpec extends LegacyDataKindSpecV01 {}

export type LegacyTypeInputV01 = LegacyDataKindSpecV01 | DataTypeV01;

/** @deprecated Use LegacyTypeInputV01 for v0.1 import/migration helpers only. */
export type TypeInput = LegacyTypeInputV01;

function kind(dataKind: string, constraints: LegacyTypeConstraintsV01 = {}): LegacyDataKindSpecV01 {
  return {
    dataKind,
    ...constraints
  };
}

function withFlow(flow: DataTypeV01["flow"], input: LegacyTypeInputV01): DataTypeV01 {
  if ("flow" in input && input.flow !== flow) {
    throw new TypeError(`Cannot convert ${input.flow}<${input.dataKind}> to ${flow}<${input.dataKind}>`);
  }

  return {
    flow,
    ...input
  };
}

export const legacyT = {
  f32: (constraints: LegacyTypeConstraintsV01 = {}) => kind("number.f32", constraints),
  f64: (constraints: LegacyTypeConstraintsV01 = {}) => kind("number.f64", constraints),
  bool: (constraints: LegacyTypeConstraintsV01 = {}) => kind("boolean", constraints),
  boolean: (constraints: LegacyTypeConstraintsV01 = {}) => kind("boolean", constraints),
  string: (constraints: LegacyTypeConstraintsV01 = {}) => kind("string", constraints),
  bang: (constraints: LegacyTypeConstraintsV01 = {}) => kind("bang", constraints),
  asset: {
    video: (constraints: LegacyTypeConstraintsV01 = {}) => kind("asset.video", constraints)
  },
  gpu: {
    texture2d: (constraints: LegacyTypeConstraintsV01 = {}) =>
      withFlow("resource", kind("gpu.texture2d", constraints))
  },
  value: (input: LegacyTypeInputV01) => withFlow("value", input),
  event: (input: LegacyTypeInputV01) => withFlow("event", input),
  signal: (input: LegacyTypeInputV01) => withFlow("signal", input),
  stream: (input: LegacyTypeInputV01) => withFlow("stream", input),
  resource: (input: LegacyTypeInputV01) => withFlow("resource", input)
} as const;

/** @deprecated v0.1 flow/dataKind builders are legacy import/migration helpers only. */
export const t = legacyT;
