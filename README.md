# shardrebalance

浏览器单页工作台（原生 ES 模块，零依赖，仅用标准库与原生浏览器 API）。

## 起服务看页面

    python3 -m http.server 8000

浏览器打开 http://127.0.0.1:8000/ ，改样例点运行看结果。

## 再均衡算法（plan.js）

1. 阶段一：分片按负载降序，逐个摊到当前最轻且容量放得下的节点。
2. 阶段二：反复把最重节点上最轻的分片搬到最轻节点；只有搬移后负载差
   严格变小且不超目标节点容量时才执行，直到无法再改善。
3. 每个分片最多搬一次（不震荡）；返回 `{ moves, skew }`，
   `moves` 每项为 `[分片id, 目标节点id]`，`skew` 为搬移后最大负载差。
4. 错误：无节点抛 `E_NO_NODE`；总负载超总容量或贪心后仍有分片放不下
   抛 `E_CAPACITY`，不硬搬。

## 执行与幂等（apply.js）

`applyMoves(moves, progress)` 按 `progress.done`（形如 `s1->n0` 的字符串
列表）跳过已完成搬移：`applied` 只计本次实际搬移，`skipped` 计跳过数，
`done` 返回合并去重后的完成列表。断点续跑与重放都不会产生额外搬移。

## 测试

    node tests/run.js

## 场景自检

    node check_sample.js
