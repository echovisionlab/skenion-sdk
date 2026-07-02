const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function supportedContractsRangeForVersion(version: string): string {
  const match = SEMVER_PATTERN.exec(version);
  if (match === null) {
    throw new Error(`Contracts version must be x.y.z SemVer; got ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 0) {
    return ">=0.0.0 <1.0.0";
  }

  return `>=${major}.${minor}.0 <${major}.${minor + 1}.0`;
}

export const SDK_CONTRACTS_BUILT_AGAINST_VERSION = "0.61.0";
export const SDK_SUPPORTED_CONTRACTS_RANGE = supportedContractsRangeForVersion(
  SDK_CONTRACTS_BUILT_AGAINST_VERSION
);
