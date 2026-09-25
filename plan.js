// plan.js：均衡计划（基线：把所有分片都算成一次搬移）
export function planMoves(shards, nodes) {
  return { moves: shards.map((shard) => [shard.id, nodes[0].id]), skew: 0 };
}
