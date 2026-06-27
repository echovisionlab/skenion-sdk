#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const packageName = "@skenion/contracts";
const localPathEnvName = "SKENION_LOCAL_CONTRACTS_PATH";

const defaultContractsPaths = [
  ".deps/skenion-contracts/packages/ts",
  "../Skenion-contracts/packages/ts",
  "../skenion-contracts/packages/ts"
];

function usage() {
  return [
    "Usage: pnpm run check:local-contracts -- [--contracts-path <path>]",
    "",
    "Environment:",
    `  ${localPathEnvName}=<path>   explicit local @skenion/contracts package path`,
    "  SKENION_RELEASE_MODE=1       fail closed; release jobs must use registry deps"
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {
    contractsPath: process.env[localPathEnvName]
  };

  const args = argv[0] === "--" ? argv.slice(1) : argv;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--contracts-path") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--contracts-path requires a path value");
      }
      parsed.contractsPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--contracts-path=")) {
      parsed.contractsPath = arg.slice("--contracts-path=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  return parsed;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function resolveContractsPath(inputPath) {
  const candidates = inputPath === undefined ? defaultContractsPaths : [inputPath];
  for (const candidate of candidates) {
    const resolved = path.resolve(repoRoot, candidate);
    if (existsSync(path.join(resolved, "package.json"))) {
      return resolved;
    }
  }

  throw new Error(
    [
      "Could not find a local @skenion/contracts package.",
      inputPath === undefined
        ? `Checked defaults: ${defaultContractsPaths.join(", ")}`
        : `Checked explicit path: ${inputPath}`,
      `Set ${localPathEnvName}=<path> or pass --contracts-path <path>.`
    ].join("\n")
  );
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    throw new Error(`Unsupported semver version: ${version}`);
  }
  return match.slice(1, 4).map((part) => Number(part));
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = /^(>=|>|<=|<|=)?\s*(\d+\.\d+\.\d+)$/.exec(comparator);
  if (match === null) {
    throw new Error(`Unsupported dependency range comparator: ${comparator}`);
  }

  const operator = match[1] ?? "=";
  const comparison = compareVersions(version, match[2]);
  switch (operator) {
    case ">=":
      return comparison >= 0;
    case ">":
      return comparison > 0;
    case "<=":
      return comparison <= 0;
    case "<":
      return comparison < 0;
    case "=":
      return comparison === 0;
    default:
      throw new Error(`Unsupported dependency range operator: ${operator}`);
  }
}

function versionSatisfiesRange(version, range) {
  if (range === version) {
    return true;
  }

  return range
    .split(/\s+/)
    .filter(Boolean)
    .every((comparator) => satisfiesComparator(version, comparator));
}

function verifyDeclaredRange(name, range, contractsVersion) {
  if (typeof range !== "string" || range.length === 0) {
    throw new Error(`${name} must declare a ${packageName} range`);
  }
  if (!versionSatisfiesRange(contractsVersion, range)) {
    throw new Error(`${packageName}@${contractsVersion} does not satisfy ${name} range ${range}`);
  }
}

function verifyStableLocalVersion(version) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `${packageName} local version must be an exact stable x.y.z version; prerelease/build metadata is not supported: ${version}`
    );
  }
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}

function gitEvidence(contractsPath) {
  const root = runGit(["rev-parse", "--show-toplevel"], contractsPath);
  if (root === undefined) {
    return { available: false };
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], root);
  const commit = runGit(["rev-parse", "HEAD"], root);
  const status = runGit(["status", "--short"], root);
  return {
    available: true,
    root,
    branch,
    commit,
    dirty: status !== undefined && status.length > 0
  };
}

function pnpmCommand() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined && npmExecPath.length > 0) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", "ci"]
    };
  }

  return {
    command: "pnpm",
    args: ["run", "ci"]
  };
}

function installOverride(contractsPath) {
  const scopeDir = path.join(repoRoot, "node_modules", "@skenion");
  const targetPath = path.join(scopeDir, "contracts");
  const backupPath = path.join(scopeDir, `.contracts-backup-${process.pid}-${Date.now()}`);

  mkdirSync(scopeDir, { recursive: true });

  let originalExisted = true;
  try {
    lstatSync(targetPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    originalExisted = false;
  }

  try {
    if (originalExisted) {
      renameSync(targetPath, backupPath);
    }

    symlinkSync(contractsPath, targetPath, "dir");
  } catch (error) {
    rmSync(targetPath, { force: true, recursive: true });
    if (originalExisted && existsSync(backupPath)) {
      renameSync(backupPath, targetPath);
    }
    throw error;
  }

  return () => {
    rmSync(targetPath, { force: true, recursive: true });
    if (originalExisted) {
      renameSync(backupPath, targetPath);
    }
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.env.SKENION_RELEASE_MODE === "1") {
    throw new Error("Local Contracts integration is disabled when SKENION_RELEASE_MODE=1");
  }

  const contractsPath = resolveContractsPath(args.contractsPath);
  const contractsPackagePath = path.join(contractsPath, "package.json");
  const contractsDistPath = path.join(contractsPath, "dist", "index.js");
  const sdkPackagePath = path.join(repoRoot, "package.json");
  const contractsPackage = readJson(contractsPackagePath);
  const sdkPackage = readJson(sdkPackagePath);

  if (contractsPackage.name !== packageName) {
    throw new Error(`Expected ${contractsPackagePath} to be ${packageName}; found ${contractsPackage.name}`);
  }
  if (!existsSync(contractsDistPath)) {
    throw new Error(`Local ${packageName} must be built first; missing ${contractsDistPath}`);
  }

  const contractsVersion = contractsPackage.version;
  verifyStableLocalVersion(contractsVersion);
  verifyDeclaredRange("peerDependencies", sdkPackage.peerDependencies?.[packageName], contractsVersion);
  verifyDeclaredRange("devDependencies", sdkPackage.devDependencies?.[packageName], contractsVersion);

  const evidence = gitEvidence(contractsPath);
  console.log(`Using local ${packageName}@${contractsVersion}`);
  console.log(`Contracts path: ${contractsPath}`);
  if (evidence.available) {
    console.log(`Contracts git branch: ${evidence.branch ?? "unknown"}`);
    console.log(`Contracts git commit: ${evidence.commit ?? "unknown"}`);
    console.log(`Contracts git dirty: ${evidence.dirty ? "yes" : "no"}`);
  } else {
    console.log("Contracts git evidence: unavailable");
  }

  let restore;
  try {
    restore = installOverride(contractsPath);
    const { command, args: commandArgs } = pnpmCommand();
    const result = spawnSync(command, commandArgs, {
      cwd: repoRoot,
      env: {
        ...process.env,
        SKENION_LOCAL_CONTRACTS_ACTIVE: "1"
      },
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error(`SDK validation failed with local ${packageName}@${contractsVersion}`);
    }
  } finally {
    if (restore !== undefined) {
      restore();
    }
  }

  console.log(`Local Contracts integration passed for ${packageName}@${contractsVersion}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
