#!/usr/bin/env node

import { readFileSync } from "node:fs";

const packageName = "@skenion/contracts";
const requiredVersion = "0.61.0";
const exactSemverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function readPackageJson() {
  return JSON.parse(readFileSync("package.json", "utf8"));
}

function validateContractsDependencyVersion(pkg) {
  const peer = pkg.peerDependencies?.[packageName];
  const dev = pkg.devDependencies?.[packageName];
  const errors = [];

  if (peer === undefined) {
    errors.push(`${packageName} peer dependency is missing`);
  }
  if (dev === undefined) {
    errors.push(`${packageName} devDependency is missing`);
  }
  if (peer !== undefined && dev !== undefined && peer !== dev) {
    errors.push(`${packageName} peer dependency ${peer} must match devDependency ${dev}`);
  }

  const version = peer ?? dev;
  if (version !== undefined && exactSemverPattern.exec(version) === null) {
    errors.push(`${packageName} dependency ${version} must be an exact SemVer x.y.z version`);
  }
  if (version !== undefined && version !== requiredVersion) {
    errors.push(`${packageName} dependency ${version} must be ${requiredVersion}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    version
  };
}

const result = validateContractsDependencyVersion(readPackageJson());
if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`${packageName} dependency version: ${result.version}`);
