import assert from "node:assert";
import { planMoves } from "../plan.js";
import { applyMoves } from "../apply.js";
import { render } from "../app.js";

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok   " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

const shards = [{ id: "s0", load: 4 }, { id: "s1", load: 1 }];
const nodes = [{ id: "n0", capacity: 6 }, { id: "n1", capacity: 6 }];

check("plan returns moves array", () => {
  assert.ok(Array.isArray(planMoves(shards, nodes).moves));
});

check("plan reports skew", () => {
  assert.strictEqual(typeof planMoves(shards, nodes).skew, "number");
});

check("apply counts applied", () => {
  assert.strictEqual(typeof applyMoves([], { done: [] }).applied, "number");
});

check("apply keeps done list", () => {
  assert.ok(Array.isArray(applyMoves([], { done: [] }).done));
});

check("render reports idempotent flag", () => {
  assert.strictEqual(typeof render({ shards: shards, nodes: nodes }).idempotent, "boolean");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
