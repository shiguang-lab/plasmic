/**
 * 逻辑冒烟测试：不依赖 React，只验证「修订索引 + 记忆化 selector」的语义。
 *
 * 运行前先编译：
 *   ../../../../node_modules/.bin/tsc revisions.ts model-selector.ts \
 *     --strict --target ES2022 --module commonjs --moduleResolution node \
 *     --outDir .tmp --skipLibCheck
 *   node smoke-test.js
 */
const assert = require("assert");
const {
  bumpModelKeys,
  subscribeModelKeys,
  modelKeys,
} = require("./.tmp/revisions.js");
const { createModelSelector } = require("./.tmp/model-selector.js");

const tpl = { uuid: "t1", name: "Title", props: { a: 1 } };
const key = modelKeys.tpl(tpl.uuid);

let calls = 0;
const unsubscribe = subscribeModelKeys([key], () => calls++);

// 1) 脏键推进 => 订阅者收到通知
bumpModelKeys([key]);
assert.strictEqual(calls, 1, "脏键应触发订阅者");

// 2) 同一批次内重复键只推进一次
bumpModelKeys([key, key, key]);
assert.strictEqual(calls, 2, "同一批次重复键应去重");

// 3) 修订号不变 => 记忆化 selector 返回同一引用，且不重算
let computeCount = 0;
const selectName = createModelSelector(
  () => [key],
  () => {
    computeCount++;
    return tpl.name;
  },
);
const first = selectName();
assert.strictEqual(selectName(), first, "修订号不变应返回同一引用");
assert.strictEqual(computeCount, 1, "修订号不变不应重算");

// 4) 键变化 => 重算，且读到的是模型的新值（模型保持可变）
tpl.name = "Renamed";
bumpModelKeys([key]);
assert.strictEqual(selectName(), "Renamed");
assert.strictEqual(computeCount, 2);

// 5) 重算但值相同 => 保住原引用（这是 equality 唯一还剩下的作用）
const selectConst = createModelSelector(() => [key], () => "same");
const constFirst = selectConst();
bumpModelKeys([key]);
assert.strictEqual(selectConst(), constFirst, "值相同应保住引用");

// 6) 退订后不再收到通知
unsubscribe();
const before = calls;
bumpModelKeys([key]);
assert.strictEqual(calls, before, "退订后不应再通知");

console.log("✅ 6 项断言全部通过（修订索引 + 记忆化 selector）");
