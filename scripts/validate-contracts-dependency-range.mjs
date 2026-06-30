#!/usr/bin/env node

import { readFileSync } from "node:fs";

const packageName = "@skenion/contracts";
const rangePattern = /^>=0\.(\d+)\.0 <0\.(\d+)\.0$/;

function readPackageJson() {
  return JSON.parse(readFileSync("package.json", "utf8"));
}

function validateContractsDependencyRange(pkg) {
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

  const range = peer ?? dev;
  const match = typeof range === "string" ? rangePattern.exec(range) : null;
  if (range !== undefined && match === null) {
    errors.push(
      `${packageName} range ${range} must use the supported form >=0.x.0 <0.y.0`
    );
  }
  if (match !== null && Number(match[2]) !== Number(match[1]) + 1) {
    errors.push(`${packageName} range ${range} must span exactly one 0.x compatibility line`);
  }

  return {
    ok: errors.length === 0,
    errors,
    range
  };
}

const result = validateContractsDependencyRange(readPackageJson());
if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`${packageName} dependency range: ${result.range}`);
