// apply.js：执行与幂等（基线：不记进度、不幂等）
export function applyMoves(moves, progress) {
  return { applied: moves.length, skipped: 0, done: moves.map((move) => move[0]) };
}
