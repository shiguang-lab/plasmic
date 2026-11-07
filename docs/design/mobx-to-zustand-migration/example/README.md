# 迁移最小样例（可编译 / 可运行）

这是 [mobx-to-zustand-migration.md](../../mobx-to-zustand-migration.md) 里 4.1 / 4.2 / 4.5 / 5.2 的可执行版本，用来验证三件事：

1. **不需要 equality 也能拿到稳定引用**（靠修订号记忆化，而不是靠比较函数）；
2. `useShallow` 只负责"一次读多个 React 状态字段"，不负责模型数据；
3. 通知抑制（`observable.box` 的 `{ equals }`）在 store 里就是一句 `if (get().x === v) return`。

## 文件

| 文件 | 对应文档 | 作用 |
|---|---|---|
| `revisions.ts` | 5.2 | 模型修订索引：脏键 → 版本号 + 订阅 |
| `model-selector.ts` | 4.5 / 5.4 | `createModelSelector`（非 Hook）与 `useModelSelector`（Hook） |
| `studio-stores.ts` | 3.2 / 4.1 | zustand 单例 store + `subscribeWithSelector` + setter 判等 |
| `effects.ts` | 4.3 | 用 `store.subscribe(selector, cb)` 替代 `reaction` |
| `StudioPanel.tsx` | 4.1 / 4.2 | 组件：`useShallow` 读多字段 + 模型数据走 `useModelSelector` |

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
