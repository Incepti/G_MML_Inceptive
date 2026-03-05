/**
 * GEEZ MML Studio — Dynamic MML Sandbox Runtime
 *
 * Replicates the MML server-side Node.js virtual DOM environment.
 * Dynamic MML runs server-side in Node.js with a virtual DOM that gets
 * serialized over WebSocket to Unreal.
 *
 * The sandbox exposes:
 *   document.createElement(tag)
 *   document.body.appendChild(el)
 *   element.setAttribute(name, value)
 *   element.remove()
 *   element.addEventListener("prompt", handler)  — for m-prompt events
 *   setInterval(fn, ms)  — 33ms standard update rate
 *   console.log / warn / error
 *   fetch  — for external API calls (allowed per Build System V2)
 *
 * Blocked (Final Brain §3):
 *   window, requestAnimationFrame, Canvas, WebGL, Math.random (warned)
 *
 * Determinism (Final Brain §4):
 *   Prefer seeded alea/simplex-noise over Math.random
 *   Use tick counter for time-based calculations
 *
 * Authority: Build System V2 + Final Brain V3
 */
"use strict";

const { NodeVM } = require("vm2");
const crypto = require("crypto");
const { getCachedFetch, setCachedFetch } = require("../../database/client");

// ─── Allowed MML Tags ──────────────────────────────────────────────────────
const ALLOWED_TAGS = new Set([
  "m-group", "m-cube", "m-sphere", "m-cylinder", "m-plane",
  "m-model", "m-character",
  "m-light", "m-image", "m-video",
  "m-label", "m-prompt", "m-attr-anim",
]);

const FORBIDDEN_TAGS = new Set([
  "m-audio", "m-position-probe", "m-link", "m-interaction",
  "m-chat-probe", "m-attr-lerp",
]);

// ─── Determinism + Safety Limits ────────────────────────────────────────────
const MAX_INTERVALS = 10;
const FIXED_DT_MS = 33;          // 30Hz fixed timestep
const MAX_TICKS = 60 * 30 * 10;  // 10 minutes @ 30Hz

// Fetch policy modes
const FETCH_POLICY_DISABLED = "disabled";
const FETCH_POLICY_ALLOWLIST = "allowlist";

// ─── FNV-1a 32-bit hash (seed derivation) ───────────────────────────────────
function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit FNV prime 16777619
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
    hash >>>= 0;
  }
  return hash >>> 0;
}

// ─── Deterministic LCG RNG (0–1 float) ──────────────────────────────────────
function createDeterministicRng(seed) {
  let state = (seed >>> 0) || 0x1337;
  return function randomFloat() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ─── Deterministic fetch wrapper with allowlist + cache ─────────────────────
const inMemoryFetchCache = new Map(); // key: url -> { body, hash, timestamp }

async function deterministicFetch(url, options, policy) {
  const mode = policy?.mode || FETCH_POLICY_DISABLED;
  const allowlist = policy?.allowlist || [];

  if (mode === FETCH_POLICY_DISABLED) {
    throw new Error(
      "[Sandbox] fetch is disabled in deterministic sandbox (fetchPolicy=disabled)"
    );
  }

  const method = (options && options.method) || "GET";
  if (method.toUpperCase() !== "GET") {
    throw new Error(
      "[Sandbox] Only GET requests are allowed in deterministic fetchPolicy"
    );
  }

  const allowed =
    allowlist.length === 0
      ? false
      : allowlist.some((domain) => {
          try {
            const u = new URL(url);
            return u.hostname === domain || u.hostname.endsWith(`.${domain}`);
          } catch {
            return false;
          }
        });

  if (!allowed) {
    throw new Error(
      `[Sandbox] fetch URL not in allowlist: ${url}`
    );
  }

  const cacheKey = url;
  if (inMemoryFetchCache.has(cacheKey)) {
    return inMemoryFetchCache.get(cacheKey).body;
  }

  // Check persistent cache (Postgres)
  try {
    const row = await getCachedFetch(cacheKey);
    if (row && typeof row.body === "string") {
      inMemoryFetchCache.set(cacheKey, {
        body: row.body,
        hash: crypto.createHash("sha256").update(row.body).digest("hex"),
        timestamp: 0,
      });
      return row.body;
    }
  } catch (e) {
    // If the cache table is unavailable for any reason, fall back to
    // purely in-memory caching. This must never crash the sandbox.
    process.stderr.write(
      `[Sandbox] WARNING: fetch_cache lookup failed: ${String(e && e.message ? e.message : e)}\n`
    );
  }

  if (typeof fetch === "undefined") {
    // SIMULATED MODE fallback – deterministic pseudo payload
    const simulated = JSON.stringify({
      simulated: true,
      url,
      hash: crypto.createHash("sha256").update(url).digest("hex"),
    });
    inMemoryFetchCache.set(cacheKey, {
      body: simulated,
      hash: crypto.createHash("sha256").update(simulated).digest("hex"),
      timestamp: 0,
    });
    return simulated;
  }

  const res = await fetch(url, { method: "GET" });
  const body = await res.text();
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  inMemoryFetchCache.set(cacheKey, {
    body,
    hash,
    timestamp: Date.now(),
  });

  // Persist to Postgres for cross-run determinism
  try {
    await setCachedFetch(cacheKey, body, hash);
  } catch (e) {
    process.stderr.write(
      `[Sandbox] WARNING: fetch_cache write failed: ${String(e && e.message ? e.message : e)}\n`
    );
  }
  return body;
}

// ─── Virtual DOM Element ───────────────────────────────────────────────────
class VirtualElement {
  constructor(tag) {
    this.tagName = tag.toLowerCase();
    this.nodeName = this.tagName;
    this.id = "";
    this.attributes = {};
    this.children = [];
    this.parent = null;
    this._eventHandlers = {};
    this.style = {}; // no-op style object for compatibility
  }

  setAttribute(name, value) {
    const k = String(name).toLowerCase();
    this.attributes[k] = String(value);
    if (k === "id") this.id = String(value);
  }

  getAttribute(name) {
    return this.attributes[String(name).toLowerCase()] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[String(name).toLowerCase()];
  }

  appendChild(child) {
    if (!(child instanceof VirtualElement)) return;
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
  }

  remove() {
    if (this.parent) this.parent.removeChild(this);
  }

  addEventListener(event, handler) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this._eventHandlers[event]) return;
    this._eventHandlers[event] = this._eventHandlers[event].filter((h) => h !== handler);
  }

  dispatchEvent(event, detail) {
    const handlers = this._eventHandlers[event] || [];
    handlers.forEach((h) => {
      try { h({ type: event, detail }); } catch (e) { /* ignore */ }
    });
  }

  // Serialize to MML HTML string
  toMML(indent = 0) {
    const pad = "  ".repeat(indent);
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
      .join(" ");
    const attrStr = attrs ? ` ${attrs}` : "";

    if (this.children.length === 0) {
      return `${pad}<${this.tagName}${attrStr}></${this.tagName}>`;
    }

    const childStr = this.children.map((c) => c.toMML(indent + 1)).join("\n");
    return `${pad}<${this.tagName}${attrStr}>\n${childStr}\n${pad}</${this.tagName}>`;
  }
}

// ─── Virtual Body ──────────────────────────────────────────────────────────
class VirtualBody extends VirtualElement {
  constructor() {
    super("body");
  }

  toMML() {
    return this.children.map((c) => c.toMML(0)).join("\n");
  }
}

// ─── Sandbox Factory ───────────────────────────────────────────────────────
/**
 * createSandbox
 * @param {function} onStateChange - callback(mmlHtml)
 * @param {object}   options       - { seedString?, fetchPolicy? }
 */
function createSandbox(onStateChange, options = {}) {
  const body = new VirtualBody();
  const elementMap = new Map();
  const intervals = [];
  let tick = 0;
  let running = false;
  let tickTimer = null;
  let _notifyPending = false;

  const seedString =
    typeof options.seedString === "string" && options.seedString.length > 0
      ? options.seedString
      : "UNSEEDED::GEEZ-MML-SANDBOX";
  const seedHash = fnv1a32(seedString);
  const rng = createDeterministicRng(seedHash);

  const fetchPolicy = {
    mode:
      options.fetchPolicy && options.fetchPolicy.mode
        ? options.fetchPolicy.mode
        : FETCH_POLICY_DISABLED,
    allowlist: Array.isArray(options.fetchPolicy?.allowlist)
      ? options.fetchPolicy.allowlist
      : [],
  };

  // Debounced state notification (max 30fps push)
  function notifyChange() {
    if (_notifyPending) return;
    _notifyPending = true;
    setImmediate(() => {
      _notifyPending = false;
      if (onStateChange) onStateChange(body.toMML());
    });
  }

  // ── Proxy appendChild to track element IDs ──────────────────────────────
  function trackElement(el) {
    if (el.id) elementMap.set(el.id, el);
    el.children.forEach(trackElement);
  }

  // ── Virtual document object ─────────────────────────────────────────────
  const virtualDocument = {
    body,

    createElement(tag) {
      const normalTag = String(tag).toLowerCase().trim();

      if (FORBIDDEN_TAGS.has(normalTag)) {
        process.stderr.write(`[Sandbox] BLOCKED: <${normalTag}> is not supported in MML Alpha\n`);
        return new VirtualElement("m-group"); // return harmless fallback
      }

      if (!ALLOWED_TAGS.has(normalTag)) {
        process.stderr.write(`[Sandbox] WARNING: <${normalTag}> is not a recognised MML tag\n`);
      }

      return new VirtualElement(normalTag);
    },

    getElementById(id) {
      return elementMap.get(String(id)) || null;
    },

    querySelector(selector) {
      // Basic: support "#id" only
      if (selector.startsWith("#")) {
        return elementMap.get(selector.slice(1)) || null;
      }
      return null;
    },
  };

  // Proxy body.appendChild to trigger notifications and track IDs
  const originalBodyAppend = body.appendChild.bind(body);
  body.appendChild = function (child) {
    originalBodyAppend(child);
    trackElement(child);
    notifyChange();
  };

  // ── Sandbox API exposed to user script ──────────────────────────────────
  // ── Deterministic Date/performance/crypto proxies ────────────────────────
  const RealDate = Date;
  function DeterministicDate(...args) {
    if (args.length === 0) {
      return new RealDate(tick * FIXED_DT_MS);
    }
    return new RealDate(...args);
  }
  DeterministicDate.now = function () {
    return tick * FIXED_DT_MS;
  };
  DeterministicDate.UTC = RealDate.UTC.bind(RealDate);
  DeterministicDate.parse = RealDate.parse.bind(RealDate);
  DeterministicDate.prototype = RealDate.prototype;

  const deterministicPerformance = {
    now() {
      return tick * FIXED_DT_MS;
    },
  };

  const deterministicCrypto = {
    getRandomValues() {
      throw new Error(
        "[Sandbox] crypto.getRandomValues() is forbidden in deterministic sandbox"
      );
    },
  };

  // ── Deterministic Math wrapper ────────────────────────────────────────────
  const DeterministicMath = new Proxy(Math, {
    get(target, prop) {
      if (prop === "random") {
        throw new Error(
          "[Sandbox] Math.random() is forbidden — use sandbox.rng() / sandbox.randomFloat() instead"
        );
      }
      return target[prop];
    },
  });

  // ── Sandbox API exposed to user script ──────────────────────────────────
  const sandboxAPI = {
    document: virtualDocument,

    // Tick counter for deterministic animation (incremented every 33ms)
    get tick() {
      return tick;
    },

    // Deterministic time in seconds
    get timeSeconds() {
      return (tick * FIXED_DT_MS) / 1000;
    },

    setInterval(fn, ms) {
      if (intervals.length >= MAX_INTERVALS) {
        throw new Error(`Max setInterval limit (${MAX_INTERVALS}) exceeded`);
      }
      const intervalMs = Math.max(16, parseInt(ms, 10) || FIXED_DT_MS);
      const id = { _id: intervals.length, _ms: intervalMs, _last: 0 };
      intervals.push({ fn, ms: intervalMs, lastTick: 0, id });
      return id;
    },

    clearInterval(idObj) {
      const idx = intervals.findIndex((i) => i.id === idObj);
      if (idx !== -1) intervals.splice(idx, 1);
    },

    setTimeout(fn, ms) {
      // Allow once — convert to a one-shot interval that clears itself
      let fired = false;
      const msNum = parseInt(ms, 10) || 33;
      const ticks = Math.ceil(msNum / 33);
      let count = 0;
      const id = sandboxAPI.setInterval(() => {
        count++;
        if (count >= ticks && !fired) {
          fired = true;
          fn();
          sandboxAPI.clearInterval(id);
        }
      }, 33);
      return id;
    },

    clearTimeout(id) {
      sandboxAPI.clearInterval(id);
    },

    console: {
      log:   (...args) => process.stdout.write(`[MML] ${args.map(String).join(" ")}\n`),
      warn:  (...args) => process.stderr.write(`[MML WARN] ${args.map(String).join(" ")}\n`),
      error: (...args) => process.stderr.write(`[MML ERROR] ${args.map(String).join(" ")}\n`),
    },

    // Deterministic Math with hard-blocked random()
    Math: DeterministicMath,

    // Deterministic RNG helpers (seeded via FNV-1a(prompt + constant))
    rng() {
      return rng();
    },
    randomFloat() {
      return rng();
    },

    // Deterministic time APIs
    Date: DeterministicDate,
    performance: deterministicPerformance,
    crypto: deterministicCrypto,

    // Deterministic fetch wrapper (hard-disabled unless explicitly allowlisted)
    async fetch(url, options) {
      return deterministicFetch(url, options, fetchPolicy);
    },

    // Expose VirtualElement class for instanceof checks in user code
    Element: VirtualElement,
  };

  // ── Tick loop (33ms = ~30fps — Build System V2 standard) ───────────────
  function startTick() {
    running = true;
    tickTimer = setInterval(() => {
      if (!running) return;
      tick++;

      if (tick > MAX_TICKS) {
        running = false;
        if (tickTimer) {
          clearInterval(tickTimer);
          tickTimer = null;
        }
        process.stderr.write(
          `[Sandbox] Tick budget exceeded (${MAX_TICKS}); sandbox stopped to prevent runaway simulation\n`
        );
        return;
      }

      let changed = false;
      for (const interval of [...intervals]) {
        const ticksNeeded = Math.floor(interval.ms / FIXED_DT_MS);
        if (tick - interval.lastTick >= ticksNeeded) {
          interval.lastTick = tick;
          try {
            interval.fn();
            changed = true;
          } catch (e) {
            process.stderr.write(`[Sandbox Interval Error] ${e.message}\n`);
          }
        }
      }

      if (changed && onStateChange) {
        onStateChange(body.toMML());
      }
    }, 33);
  }

  function stopTick() {
    running = false;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    intervals.length = 0;
  }

  // Advance N ticks synchronously (for HTTP mode — no real-time intervals)
  function advanceTicks(n) {
    for (let t = 0; t < n; t++) {
      tick++;
      if (tick > MAX_TICKS) break;
      for (const interval of [...intervals]) {
        const ticksNeeded = Math.max(1, Math.floor(interval.ms / FIXED_DT_MS));
        if (tick - interval.lastTick >= ticksNeeded) {
          interval.lastTick = tick;
          try { interval.fn(); } catch (e) {
            process.stderr.write(`[Sandbox Interval Error] ${e.message}\n`);
          }
        }
      }
    }
  }

  function serializeState() {
    return body.toMML();
  }

  return { sandboxAPI, startTick, stopTick, advanceTicks, serializeState, body };
}

// ─── Run user script in sandbox ────────────────────────────────────────────
/**
 * runMMLScript
 * @param {string}   jsCode
 * @param {function} onStateChange - callback(mmlHtml)
 * @param {object}   options       - { seedString?, fetchPolicy? }
 */
function runMMLScript(jsCode, onStateChange, options = {}) {
  const { sandboxAPI, startTick, stopTick, serializeState } = createSandbox(
    onStateChange,
    options
  );

  const vm = new NodeVM({
    console: "redirect",
    sandbox: sandboxAPI,
    require: {
      external: ["cannon-es", "simplex-noise", "alea", "seedrandom", "chroma-js"],
      builtin: [],
    },
    eval: false,
    wasm: false,
    // Timebox synchronous execution to prevent runaway infinite loops
    timeout: 1000,
  });

  try {
    vm.run(jsCode, "mml-dynamic.js");
  } catch (e) {
    stopTick();
    throw new Error(`Sandbox execution error: ${e.message}`);
  }

  startTick();

  return {
    stop: stopTick,
    getState: serializeState,
  };
}

module.exports = { runMMLScript, createSandbox };
