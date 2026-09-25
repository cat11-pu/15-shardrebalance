// plan.js：分片再均衡计划
// 阶段一：按负载降序，把每个分片摊到当前最轻且放得下的节点；
// 阶段二：反复把最重节点上最轻的分片搬到最轻节点，直到负载差无法再变小。
import { makeError } from "./util.js";

export class BinaryHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(items[index], items[parent]) < 0) {
        const tmp = items[index];
        items[index] = items[parent];
        items[parent] = tmp;
        index = parent;
      } else {
        break;
      }
    }
  }

  peek() {
    return this.items.length ? this.items[0] : null;
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let index = 0;
      const length = items.length;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < length && this.compare(items[left], items[smallest]) < 0) smallest = left;
        if (right < length && this.compare(items[right], items[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        const tmp = items[index];
        items[index] = items[smallest];
        items[smallest] = tmp;
        index = smallest;
      }
    }
    return top;
  }
}

function cmpNodeLoadAsc(a, b) {
  return a.load - b.load || a.index - b.index;
}

function cmpNodeLoadDesc(a, b) {
  return b.load - a.load || b.index - a.index;
}

function cmpShard(a, b) {
  return a.load - b.load || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// 阶段二：在给定初始归属上反复执行规定搬移；导出以便直接验证收敛规则。
export function refineBalance(state) {
  const heavy = new BinaryHeap(cmpNodeLoadDesc);
  const light = new BinaryHeap(cmpNodeLoadAsc);
  state.forEach((node) => {
    heavy.push({ load: node.load, index: node.index, version: node.version });
    light.push({ load: node.load, index: node.index, version: node.version });
  });

  function topValid(heap) {
    for (;;) {
      const top = heap.peek();
      if (!top) return null;
      const current = state[top.index];
      if (top.version === current.version) return top;
      heap.pop();
    }
  }

  function topValidExcept(heap, exceptA, exceptB) {
    const aside = [];
    try {
      for (;;) {
        const top = heap.peek();
        if (!top) return null;
        const current = state[top.index];
        if (top.version !== current.version) {
          heap.pop();
          continue;
        }
        if (top.index === exceptA || top.index === exceptB) {
          aside.push(heap.pop());
          continue;
        }
        return top;
      }
    } finally {
      for (const item of aside) heap.push(item);
    }
  }

  const moves = [];
  const movedShards = new Set();

  for (;;) {
    const hi = topValid(heavy);
    const lo = topValid(light);
    if (!hi || !lo || hi.index === lo.index || hi.load <= lo.load) break;

    const source = state[hi.index];
    let candidate = null;
    for (;;) {
      const top = source.shards.peek();
      if (!top) break;
      if (top.moved) {
        source.shards.pop();
        continue;
      }
      candidate = top;
      break;
    }
    if (!candidate) break;

    const target = state[lo.index];
    if (candidate.load > target.capacity - target.load) break;
    if (movedShards.has(candidate.id)) break;

    const otherMax = topValidExcept(heavy, hi.index, lo.index);
    const otherMin = topValidExcept(light, hi.index, lo.index);
    const newSourceLoad = source.load - candidate.load;
    const newTargetLoad = target.load + candidate.load;
    const newMax = Math.max(newSourceLoad, newTargetLoad, otherMax ? otherMax.load : -Infinity);
    const newMin = Math.min(newSourceLoad, newTargetLoad, otherMin ? otherMin.load : Infinity);
    if (newMax - newMin >= hi.load - lo.load) break;

    heavy.pop();
    light.pop();
    source.shards.pop();
    candidate.moved = true;

    source.load = newSourceLoad;
    target.load = newTargetLoad;
    source.version += 1;
    target.version += 1;
    target.shards.push({ id: candidate.id, load: candidate.load, moved: true });
    movedShards.add(candidate.id);
    moves.push([candidate.id, target.id]);

    heavy.push({ load: source.load, index: source.index, version: source.version });
    heavy.push({ load: target.load, index: target.index, version: target.version });
    light.push({ load: source.load, index: source.index, version: source.version });
    light.push({ load: target.load, index: target.index, version: target.version });
  }

  return moves;
}

export function planMoves(shards, nodes) {
  if (!nodes || nodes.length === 0) {
    throw makeError("E_NO_NODE", "没有可用节点");
  }

  const totalLoad = shards.reduce((sum, shard) => sum + shard.load, 0);
  const totalCapacity = nodes.reduce((sum, node) => sum + node.capacity, 0);
  if (totalLoad > totalCapacity) {
    throw makeError("E_CAPACITY", "总负载超过总容量");
  }

  const state = nodes.map((node, index) => ({
    id: node.id,
    capacity: node.capacity,
    load: 0,
    index,
    version: 0,
    shards: new BinaryHeap(cmpShard),
  }));

  // 阶段一：重分片先放，每次选当前最轻且容量放得下的节点
  const ordered = shards
    .map((shard, order) => ({ id: shard.id, load: shard.load, order }))
    .sort((a, b) => b.load - a.load || a.order - b.order);

  const lightest = new BinaryHeap(cmpNodeLoadAsc);
  const parked = new BinaryHeap((a, b) => b.remain - a.remain || a.index - b.index);
  state.forEach((node) => {
    lightest.push({ load: 0, remain: node.capacity, version: 0, index: node.index });
  });

  for (const shard of ordered) {
    for (;;) {
      const top = parked.peek();
      if (!top || top.remain < shard.load) break;
      parked.pop();
      const node = state[top.index];
      if (top.version !== node.version) continue;
      lightest.push({ load: node.load, remain: node.capacity - node.load, version: node.version, index: node.index });
    }

    let chosen = null;
    for (;;) {
      const top = lightest.pop();
      if (!top) break;
      const node = state[top.index];
      if (top.version !== node.version) continue;
      if (shard.load <= node.capacity - node.load) {
        chosen = node;
        break;
      }
      parked.push({ load: node.load, remain: node.capacity - node.load, version: node.version, index: node.index });
    }
    if (!chosen) {
      throw makeError("E_CAPACITY", "分片放不下任何节点");
    }

    chosen.load += shard.load;
    chosen.version += 1;
    chosen.shards.push({ id: shard.id, load: shard.load, moved: false });
    const entry = {
      load: chosen.load,
      remain: chosen.capacity - chosen.load,
      version: chosen.version,
      index: chosen.index,
    };
    if (entry.remain > 0) {
      lightest.push(entry);
    } else {
      parked.push(entry);
    }
  }

  const moves = refineBalance(state);

  let maxLoad = -Infinity;
  let minLoad = Infinity;
  for (const node of state) {
    if (node.load > maxLoad) maxLoad = node.load;
    if (node.load < minLoad) minLoad = node.load;
  }

  return { moves, skew: maxLoad - minLoad };
}
