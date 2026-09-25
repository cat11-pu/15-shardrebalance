// apply.js：执行与幂等（按 progress.done 跳过已完成的搬移）
export function applyMoves(moves, progress) {
  const done = progress && Array.isArray(progress.done) ? progress.done.slice() : [];
  const seen = new Set(done);
  let applied = 0;
  let skipped = 0;
  for (const move of moves) {
    const key = move[0] + "->" + move[1];
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    done.push(key);
    applied += 1;
  }
  return { applied, skipped, done };
}
