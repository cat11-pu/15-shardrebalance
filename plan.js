// plan.js：均衡计划（贪心摊派 + 最轻分片再平衡）

class Heap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  peek() {
    return this.items[0];
  }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(items[i], items[parent]) >= 0) break;
      const tmp = items[i];
      items[i] = items[parent];
      items[parent] = tmp;
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (left < items.length && this.compare(items[left], items[best]) < 0) best = left;
        if (right < items.length && this.compare(items[right], items[best]) < 0) best = right;
        if (best === i) break;
        const tmp = items[i];
        items[i] = items[best];
        items[best] = tmp;
        i = best;
      }
    }
    return top;
  }
}

function fail(code, message) {
  const error = new Error(code + ": " + message);
  error.code = code;
  return error;
}

export function planMoves(shards, nodes) {
  if (!nodes || nodes.length === 0) {
    throw fail("E_NO_NODE", "no nodes to place shards on");
  }
  const totalLoad = shards.reduce((sum, shard) => sum + shard.load, 0);
  const totalCapacity = nodes.reduce((sum, node) => sum + node.capacity, 0);
  if (totalLoad > totalCapacity) {
    throw fail("E_CAPACITY", "total load " + totalLoad + " exceeds total capacity " + totalCapacity);
  }

  // 第一步：按负载降序，把每个分片摊到当前最轻且装得下的节点
  const loads = nodes.map(() => 0);
  const light = new Heap((a, b) => a.load - b.load || a.index - b.index);
  nodes.forEach((node, index) => light.push({ load: 0, index }));
  const placement = new Array(shards.length);
  const order = shards.map((shard, index) => index)
    .sort((a, b) => shards[b].load - shards[a].load);
  for (const index of order) {
    const shard = shards[index];
    const held = [];
    let chosen = null;
    while (light.size > 0) {
      const top = light.pop();
      if (loads[top.index] + shard.load <= nodes[top.index].capacity) {
        chosen = top;
        break;
      }
      held.push(top);
    }
    for (const entry of held) light.push(entry);
    if (!chosen) {
      throw fail("E_CAPACITY", "no node has room for shard " + shard.id);
    }
    loads[chosen.index] += shard.load;
    placement[index] = chosen.index;
    light.push({ load: loads[chosen.index], index: chosen.index });
  }

  // 第二步：反复把最重节点上最轻的分片搬到最轻节点，直到负载差不再变小
  const shardHeaps = nodes.map(() => new Heap((a, b) => a.load - b.load));
  shards.forEach((shard, index) => {
    shardHeaps[placement[index]].push({ load: shard.load, index });
  });
  const heavy = new Heap((a, b) => b.load - a.load || a.index - b.index);
  nodes.forEach((node, index) => heavy.push({ load: loads[index], index }));

  const moves = [];
  const moved = new Set();
  for (;;) {
    const maxEntry = heavy.pop();
    if (!maxEntry) break;
    const from = maxEntry.index;
    const fromHeap = shardHeaps[from];
    let candidate = null;
    while (fromHeap.size > 0) {
      const top = fromHeap.pop();
      if (!moved.has(top.index)) {
        candidate = top;
        break;
      }
    }
    const minEntry = light.pop();
    if (!candidate || !minEntry || minEntry.index === from) {
      if (candidate) fromHeap.push(candidate);
      if (minEntry) light.push(minEntry);
      heavy.push(maxEntry);
      break;
    }
    const to = minEntry.index;
    const diff = maxEntry.load - minEntry.load;
    const newFrom = maxEntry.load - candidate.load;
    const newTo = minEntry.load + candidate.load;
    const restMax = heavy.size > 0 ? heavy.peek().load : -Infinity;
    const restMin = light.size > 0 ? light.peek().load : Infinity;
    const newDiff = Math.max(newFrom, newTo, restMax) - Math.min(newFrom, newTo, restMin);
    if (newTo > nodes[to].capacity || newDiff >= diff) {
      fromHeap.push(candidate);
      light.push(minEntry);
      heavy.push(maxEntry);
      break;
    }
    moved.add(candidate.index);
    loads[from] = newFrom;
    loads[to] = newTo;
    heavy.push({ load: newFrom, index: from });
    light.push({ load: newTo, index: to });
    shardHeaps[to].push(candidate);
    moves.push([shards[candidate.index].id, nodes[to].id]);
  }

  let maxLoad = -Infinity;
  let minLoad = Infinity;
  for (const load of loads) {
    if (load > maxLoad) maxLoad = load;
    if (load < minLoad) minLoad = load;
  }
  return { moves, skew: maxLoad - minLoad };
}
