# Public types verification — 2026-11-06

本范围按 `strict: true`、`skipLibCheck: true` 验收，严格 peer 安装、独立消费者类型检查、生产构建及实际浏览器执行均通过。第三方声明文件的内部检查不属于升级验收项；自有源码及调用方使用依赖 API 的类型检查保留。

工作区：`/Users/yanxianliang/.codex/worktrees/react-19-upgrade/plasmic`；分支：`codex/react-19-implementation`。未修改原工作区、Studio 状态或 Compiler 代码，未对外发布。机器可读命令、退出码、日志 SHA-256、68 个制品身份和消费者锁文件身份见 [public-types-verification.json](public-types-verification.json)。原阶段报告未覆盖。

## 实施结果

| 项目 | 当前处理 | 验证结论 |
| --- | --- | --- |
| Commerce / `@vercel/fetch` | 移除只用于类型的 `@vercel/fetch` 依赖；直接依赖 `@types/node-fetch 2.6.13`、`@types/async-retry 1.4.9`，保持 `node-fetch 2.7.0` | 独立消费者 `skipLibCheck:false` 通过；完整请求选项合同相等 |
| Swell | `swell-js 3.24.5` → 官方 `5.9.3`；移除 `platform/patches/swell-js.patch` 及其工作区配置 | 独立消费者 `skipLibCheck:false` 通过；真实 SDK 行为回归通过 |
| Image | 保持 Ant Design 6.7.0 和 `@rc-component/image 1.10.0` | 独立消费者类型检查、生产构建及浏览器执行通过 |

Commerce 的原始使用点仅 `import type { FetchOptions }`，没有 Vercel Fetch 运行时调用。新 `src/api/fetch-options.ts` 保留原合同：

```ts
type FetchOptions = RequestInit & {
  agent?: Agent;
  retry?: Options & { maxRetryAfter?: number };
};
```

其中 `RequestInit` 来自 `node-fetch`，`Agent` 来自 Node `http`，`Options` 来自 `async-retry`。原 Vercel 声明中的两个 Agent 引用实际都来自 `http`。没有把选项缩为子集，也没有增加宽松索引签名或 `any`。`tests/fetch-options.ts` 从公开的 `CommerceAPIConfig.fetch` 提取实际参数类型，断言其与完整原合同相等，并确认错误的字符串 retries/timeout 被拒绝、`maxRetryAfter` 类型保留。Commerce 运行时代码未改。

Swell 业务代码和组件注册未改。5.9.3 自带正确的默认导出及产品 Attribute 类型，故删除旧默认导出声明补丁。依赖版本固定为本次实际验证的 5.9.3。

本次核查的官方制品为 Image 1.10.0、Vercel Fetch 7.0.0、Swell 5.9.3。下载的官方 tarball、registry 元数据及身份位于 `/tmp/plasmic-public-types-20261106/upstream/`。

## 独立验收

工具：Node 24.20.0、pnpm 11.10.0；包构建 TypeScript 5.9.3；消费者 TypeScript 7.0.2、React/React DOM 19.3.1、React 类型 19.3.0、Vite 8.3.6。

先在 `/tmp/plasmic-public-types-20261106/stage` 独立安装并构建 Commerce/Swell。沙箱显式安装 Next 16.4.5 供已有 Next API 类型引用使用；没有依赖共享工作区的提升依赖。完成源码逐文件一致性核对后，以这两项新构建输出和其余现有构建输出执行本次 `pnpm pack`，共 68 个制品。其余包没有宣称在本会话重新构建。

消费者使用 preceding 验证锁文件作为依赖解析基线，更新为本次本地 tarball。候选本地产品的 overrides 写在 `pnpm-workspace.yaml`；没有第三方版本覆盖或 peer 覆盖。最终删除消费者自己的 `node_modules` 后，用 frozen lock 和严格 peer 设置重新安装。未重新安装共享工作区 `node_modules`。

| 命令 | 目录 | 退出码 |
| --- | --- | --- |
| `pnpm --filter @plasmicpkgs/commerce build` | `stage` | 0 |
| `pnpm --filter @plasmicpkgs/commerce-swell build` | `stage` | 0 |
| `pnpm install --lockfile-only --ignore-scripts` | 实施工作区 | 0 |
| `python3 /tmp/plasmic-public-types-20261106/pack-current.py` | 实施工作区 | 0 |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | `consumer-all`、`consumer-affected` 分别执行 | 均为 0 |
| `pnpm exec tsc --noEmit`，`skipLibCheck:false` | `consumer-affected` | 0 |
| `pnpm run build`，实际执行 `tsc --noEmit && vite build`，`skipLibCheck:true` | `consumer-all` | 0 |
| `CONSUMER_DIR=…/consumer-all node --test …/swell/tests/provider.cjs` | `consumer-all` | 0 |
| `node /tmp/plasmic-public-types-20261106/browser.mjs` | `/tmp` | 0 |

表中沙箱及消费者目录均位于 `/tmp/plasmic-public-types-20261106/`。完整绝对路径命令与日志在 JSON 中。

生产构建转换 8,332 个模块。浏览器实际读取 59 个消费入口的模块导出（包括 JSX runtime 入口），并完成 ActionGroup 的 Detail 点击。随后通过公开 Swell Provider 和 Commerce hooks 查询 Coffee、读取购物车、执行一次加购，验证 `product_id`、`variant_id`、quantity 请求体，以及会话 Cookie 传递和购物车缓存/UI 金额更新为 24。浏览器错误数组为空。证据：`browser-results.json`、`browser-accepted.log`、`consumer-browser.png`。

SDK 行为测试使用实际 SDK，替换网络响应为固定 API fixture，而非替换 SDK。相同测试在 3.24.5 基线与本次打包的 5.9.3 均通过，覆盖：

- 商品搜索参数与详情，商品 path、图片 URL、价格和币种归一化。
- 分类和品牌读取，品牌去重。
- 购物车读取、添加、修改、删除及 quantity=0 转删除；核对 HTTP 方法、路径和请求体。
- 非法数量不发请求、非法 query 拒绝、上游库存错误的 message/code/status 保留。
- Basic 公钥请求头；服务器默认无浏览器 Cookie 存储，浏览器真实 Cookie 路径另行验证。

## 制品身份

| 制品 | SHA-256 |
| --- | --- |
| `plasmicpkgs-commerce-0.1.0.tgz` | `80f055d5f528f0a78cb3c6f8fad7fc25a593a50df0455eba72400773c58b1727` |
| `plasmicpkgs-commerce-swell-0.1.0.tgz` | `a5c80b425b1b5707b3b23890cd4e45370526366938057bb81b168450f5d48899` |

全部 tarball 在 `/tmp/plasmic-public-types-20261106/tarballs/`。已重新核对 68 个 tarball 的 SHA-256，以及实际解包的 Commerce 类型引用和 Swell 依赖版本；两个最终消费者解析图均不再包含 Vercel Fetch 或 Swell 3。

## 已知限制

Swell 行为验证使用固定响应，未连接真实商店或支付服务。生产 bundle 仍有现有大 chunk 和第三方 eval 警告，构建退出码为 0。工作区包含其他会话未提交修改；JSON 记录的是本次制品和源文件身份，不将整个工作区修改归于本任务。
