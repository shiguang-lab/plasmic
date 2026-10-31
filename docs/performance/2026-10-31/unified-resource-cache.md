# Web 与 App 统一资源缓存

状态：源码实现完成，尚未发布。只缓存不可变的组件库 JS 和依赖模型正文，项目正文、权限、启动信息、latest 解析和原写入请求继续正常访问服务端。

## 结构

`platform/shared/resource-cache`（`@plasmic-shared/resource-cache`）提供唯一的匹配、校验和请求管理实现：

- `ResourceCache`：匹配精确版本 JS 和模型资源 ID，验证响应身份与正文 SHA-256，同一实例内合并并发 GET/HEAD，并在返回和写入时拦截账号变化。只有 HTTP 200 进入缓存，其它状态保留独立响应体且不入缓存；HEAD 无正文。
- App：`desktop/src/library-cache.cjs` 的 `FileResourceStore` 保存到 `userData/library-cache`，JSON/Base64 封装，文件校验、临时文件原子替换、磁盘用量和最近使用淘汰。
- Web：`CacheStorageStore` 保存原始响应，资源正文与小型访问时间记录分开存储，读取时不重写大正文。按最近使用清理，配额错误时清理可淘汰资源后重试；无法持久化仍使用已下载的合法内容。
- 画布跨域：组件库精确版本代码和 authoring 的 release 查询通过现有 `filteredApi`/Comlink 桥交给 Studio `Api`；Canvas 域只提供静态资源，不接收组件库 API 请求。缓存身份、持久化存储和并发去重由 Studio 页面统一持有；画布不跨账号保留组件库源码缓存。编辑画布、预览、文档预览及库编辑入口共用此路径。
- Studio：`client/resource-cache.ts` 提供统一加载入口。Web 选择 CacheStorage；检测到 App 时交给原生 HTTPS 协议和文件后端，不写第二份 CacheStorage。

依赖模型由 `Api` 的资源 GET 入口加载，组件库 JS 由 `studio-bundles.ts` 加载；其它 API 保留原有传输方式。模型读取保留业务错误类型、HTTP 状态和请求定位，登出等待清理完成后再完成正常退出。

## 缓存契约

| 项目 | 规则 |
| --- | --- |
| 代码身份 | 库路径、包 ID、精确 semver；latest 地址不缓存 |
| 模型身份 | `/api/v1/dependency-models/:resourceId`，不接收客户端库存 |
| 隔离 | 来源、账号、构建；App 使用实际 renderer hash，Web 使用发布构建的 COMMITHASH |
| 命中 | 校验本地正文后直接返回，不发送 HEAD、ETag 或过期检查 |
| 缺失/损坏 | 只重新 GET 对应资源；不改变版本选择与升级策略 |
| 预算 | 两端默认 256 MiB；文件后端按文件大小，CacheStorage 按资源正文估算，浏览器实际配额可能更低 |
| 退出 | 清理本资源缓存的全部账号/构建命名空间，不删除缩略图、业务草稿或其它功能的缓存 |
| 失败 | 不缓存错误、HTML、身份/版本错配或校验失败；存储被禁止、磁盘/配额不足时不阻断合法下载 |

Web 仅使用来自已认证 API 的用户身份。BroadcastChannel 可撤销其它标签页的本地缓存身份，不根据收到的消息授予新账号的读取权。匿名、浏览器能力缺失或存储不可用时走正常网络加载。缓存不能替代项目/权限查询。

Web 直接调用页面的 CacheStorage，没有 Service Worker 请求拦截或全局 fetch 改写。浏览器可以回收缓存；该缓存只保存可重新下载的制品。CacheStorage 与 IndexedDB 共享浏览器来源配额，本层不新增 IndexedDB 数据库。

## 验证

- Desktop Node：512 项通过，包含文件后端、CacheStorage 后端模拟、配额/权限失败、损坏恢复、身份切换、并发错误和独立 App 包目录依赖解析。
- WAB：12 文件、90 项通过，包含现有加载链及统一入口、App 不创建浏览器缓存、Web 存储被禁止的降级、HTTP/网络错误和登出等待清理。
- `desktop/tests/library-cache-native.cjs`：实际 Electron 原生协议与文件后端，重复进入模型和代码零网络检查，gzip 和读写接口保留。
- `desktop/tests/resource-cache-web-native.cjs`：普通 HTTP、真实 Chromium CacheStorage、双域 Canvas→Studio Comlink 加载（Canvas API 为 404）、页面重开、模型/代码零网络检查、HTTP 错误/HEAD、账号隔离、跨标签页撤销、退出清理。
- 临时 PostgreSQL 的真实 npm tarball 发布回归：共享核心与文件后端继续通过两版本、Props/Slots、身份稳定、并发首次资源创建、latest 选择、重开与切回版本缓存复用、ETag/304 检查。

以上验证不等同于全部业务画布的手工回归，也不用于报告新的完整首帧/可编辑时间。原性能样本的范围见 [测量报告](model-resource-loading.md)。
