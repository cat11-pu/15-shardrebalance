// app.js：渲染结果
import { planMoves } from "./plan.js";
import { applyMoves } from "./apply.js";

export function render(spec) {
  const plan = planMoves(spec.shards, spec.nodes);
  const run = applyMoves(plan.moves, spec.progress || { done: [] });
  return { moves: plan.moves, skew: plan.skew, applied: run.applied,
           skipped: run.skipped, idempotent: run.applied + run.skipped === plan.moves.length };
}
