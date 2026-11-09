# 迁移最小样例（可编译 / 可运行）

这是显式 selector 与修订记忆化的独立概念样例。Studio 的生产所有权、原子发布和字段订阅以[当前架构](../../mobx-to-zustand-migration.md)及实际源码为准：store 和 revision 索引由编辑器拥有，输出比较必须在 React 快照层生效。该样例演示：

1. 未变修订下复用快照；修订改变后，生产实现仍需比较所选输出以避免无效渲染；
2. `useShallow` 只负责"一次读多个 React 状态字段"，不负责模型数据；
3. 同值写入的通知抑制在 store 里就是一句 `if (get().x === v) return`。

## 文件

| 文件 | 对应文档 | 作用 |
|---|---|---|
| `revisions.ts` | §5 | 模型修订索引：脏键 → 版本号 + 订阅 |
| `model-selector.ts` | §5 | `createModelSelector`（非 Hook）与 `useModelSelector`（Hook） |
| `studio-stores.ts` | §2 | zustand 单例 store + `subscribeWithSelector` + setter 判等 |
| `effects.ts` | §2 | 用 `store.subscribe(selector, cb)` 替代 `reaction` |
| `StudioPanel.tsx` | §2 / §5 | 组件：`useShallow` 读多字段 + 模型数据走 `useModelSelector` |

## 验证

```bash
# 1. 类型检查（strict）
../../../../node_modules/.bin/tsc -p tsconfig.json

# 2. 逻辑冒烟测试（修订索引 + 记忆化语义，6 项断言）
../../../../node_modules/.bin/tsc revisions.ts model-selector.ts \
  --strict --target ES2022 --module commonjs --moduleResolution node \
  --outDir .tmp --skipLibCheck
node smoke-test.js
rm -rf .tmp
```

`node_modules/` 里只是指向本仓库已安装的 `zustand@5.0.15`、`react`、`@types/react` 的符号链接，
用于让 `tsc` 走真实的模块解析（而不是 `paths` 伪映射——那样会因模块身份不一致产生假报错）。

## 关键点：equality 去了哪

| 原来 | 现在 |
|---|---|
| `observer` 自动追踪字段 | `useModelSelector(keys, compute)`，按修订号重算 |
| `computedFn(fn, { equals })` | `createModelSelector` 的修订号比较 + `equals` 只兜底值比较 |
| `observable.box(v, { equals })` | action 内 `if (get().x === v) return` |
| `observer` 读多个 ctx 字段 | `useShallow` |
| `reaction(...)` | `store.subscribe(selector, cb, opts)` |

整个过程**没有引入 `zustand/traditional`，也没有自定义 equality 函数**。
