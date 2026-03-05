"use strict";

/**
 * GEEZ MML Studio — Deterministic Sandbox Validation Harness
 *
 * This is a reproducible script to validate the most critical
 * sandbox invariants for the MML Alpha deterministic runtime.
 *
 * Run with:
 *   node lib/sandbox/determinism-harness.js
 */

const { createSandbox, runMMLScript } = require("./runtime");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testMathRandomThrows() {
  let threw = false;
  try {
    runMMLScript("Math.random();", () => {}, { seedString: "HARNESS" });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    threw = msg.includes("Math.random() is forbidden");
  }
  assert(threw, "Math.random must throw inside sandboxed code");
  console.log("[OK] Math.random throws in sandbox");
}

function testDeterministicDate() {
  const { sandboxAPI } = createSandbox(() => {}, { seedString: "HARNESS" });
  const t1 = sandboxAPI.Date.now();
  const t2 = sandboxAPI.Date.now();
  assert(typeof t1 === "number", "Date.now must return a number");
  assert(t1 === t2, "Date.now must be deterministic at fixed tick");
  console.log("[OK] Date.now is deterministic at fixed tick");
}

async function testFetchPolicy() {
  // Disabled policy: any fetch must throw
  const disabled = createSandbox(() => {}, {
    seedString: "HARNESS",
    fetchPolicy: { mode: "disabled" },
  });

  let disabledThrew = false;
  try {
    await disabled.sandboxAPI.fetch("https://example.com/");
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    disabledThrew = msg.includes("fetch is disabled in deterministic sandbox");
  }
  assert(disabledThrew, "fetch must throw when fetchPolicy=disabled");
  console.log("[OK] fetch throws when disabled");

  // Allowlist policy: non-allowlisted domain must throw
  const allowlisted = createSandbox(() => {}, {
    seedString: "HARNESS",
    fetchPolicy: { mode: "allowlist", allowlist: ["example.com"] },
  });

  let blockedThrew = false;
  try {
    await allowlisted.sandboxAPI.fetch("https://not-example.com/");
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    blockedThrew = msg.includes("fetch URL not in allowlist");
  }
  assert(blockedThrew, "fetch must throw for non-allowlisted domains");
  console.log("[OK] fetch throws for non-allowlisted domains");
}

async function testTickBasedTime() {
  const { sandboxAPI, startTick, stopTick } = createSandbox(() => {}, {
    seedString: "HARNESS",
  });

  const tick0 = sandboxAPI.tick;
  const t0 = sandboxAPI.timeSeconds;
  assert(tick0 === 0, "Initial tick must be 0");
  assert(t0 === 0, "Initial timeSeconds must be 0");

  startTick();
  // Wait for a few ticks (~3 ticks @ 33ms)
  await new Promise((resolve) => setTimeout(resolve, 120));
  stopTick();

  const tickN = sandboxAPI.tick;
  const tN = sandboxAPI.timeSeconds;
  assert(
    tickN > 0,
    "Tick counter must increase after tick loop starts"
  );
  const expectedSeconds = (tickN * 33) / 1000;
  assert(
    Math.abs(tN - expectedSeconds) < 1e-6,
    "timeSeconds must equal tick * 33ms"
  );
  console.log("[OK] tick-based time progression is consistent");
}

async function main() {
  try {
    await testMathRandomThrows();
    testDeterministicDate();
    await testFetchPolicy();
    await testTickBasedTime();
    console.log("Deterministic sandbox invariants: ALL PASS");
    process.exit(0);
  } catch (e) {
    console.error("Deterministic sandbox harness FAILED:", e);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}

