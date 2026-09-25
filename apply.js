// apply.js：执行搬移并记录进度（断点续跑、幂等）
import { moveKey } from "./util.js";

export function applyMoves(moves, progress) {
  const previous = new Set((progress && progress.done) || []);
  const done = [];
  const seen = new Set();
  let applied = 0;
  let skipped = 0;

  for (const key of previous) {
    if (!seen.has(key)) {
      seen.add(key);
      done.push(key);
    }
  }

  for (const move of moves) {
    const key = moveKey(move);
    if (previous.has(key)) {
      skipped += 1;
    } else {
      applied += 1;
    }
    if (!seen.has(key)) {
      seen.add(key);
      done.push(key);
    }
  }

  return { applied, skipped, done };
}
