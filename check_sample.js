import fs from "node:fs";
import { planMoves } from "./plan.js";
import { applyMoves } from "./apply.js";
import { render } from "./app.js";

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/shards.json", "utf8"));
const plan = planMoves(spec.shards, spec.nodes);
const run = applyMoves(plan.moves, spec.progress || { done: [] });
const out = render(spec);

console.log("搬移计划 =", JSON.stringify(plan.moves));
console.log("搬移次数 =", plan.moves.length);
console.log("搬移后负载差 =", plan.skew);
console.log("本次实际搬移 =", run.applied);
console.log("重复跳过的搬移 =", run.skipped);
console.log("幂等（重复执行不额外搬移） =", out.idempotent);
console.log("容量不足的错误码 =", spec.capacity_code);
