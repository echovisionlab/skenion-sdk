#!/usr/bin/env node

import { readFileSync } from "node:fs";

const packageName = "@skenion/contracts";
const exactSemverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const localOrGitSpecifierPattern = /^(?:file:|link:|workspace:|github:|https?:|git\+)/;

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
  if (peer !== undefined && localOrGitSpecifierPattern.test(peer)) {
    errors.push(`${packageName} peer dependency ${peer} must use a registry SemVer range`);
  }
  if (dev !== undefined && localOrGitSpecifierPattern.test(dev)) {
    errors.push(`${packageName} devDependency ${dev} must use an exact registry SemVer version`);
  }
  if (dev !== undefined && exactSemverPattern.exec(dev) === null) {
    errors.push(`${packageName} devDependency ${dev} must be an exact SemVer x.y.z version`);
  }

  return {
    ok: errors.length === 0,
    errors,
    range: peer,
    version: dev
  };
}

const result = validateContractsDependencyVersion(readPackageJson());
if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`${packageName} built-against version: ${result.version}`);
console.log(`${packageName} supported range: ${result.range}`);
