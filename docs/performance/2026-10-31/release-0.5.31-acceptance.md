# 0.5.31 发布与生产验收

状态：发布、部署、画布及热缓存验收通过；部分 CDN 图片旧缓存头按用户决定本次保留。结构化结果见 [JSON](release-0.5.31-acceptance.json)。

## 发布与部署

- [Studio 0.5.31](https://github.com/shiguang-lab/plasmic/releases/tag/0.5.31)：提交 `f7bf66b40620d0f9dadcbee356ddbc6721d4ddbc`，Web、Server、Preview、AI Worker 使用正式镜像，健康检查通过。
- [Desktop 0.5.30](https://github.com/shiguang-lab/plasmic/releases/tag/0.5.30)：四个平台构建通过。macOS arm64 安装包已下载并验证 SHA-512；更新源的文件大小、CORS、断点下载和资源 SHA-256 校验通过。0.5.31 的六份更新清单与先前产品清单逐字节一致。
- 正式发布 Antd6 `3.11.0`、Overseas `1.13.0`。数据库副本及正式库中的 7 个受影响对象均升级成功，无丢失属性或升级阻断，自动升级保持开启。
- 正式 Antd6 模型有 123 个外部预览地址，Overseas 有 1 个，共 123 个不同 SVG；两库内联预览 data URL 均为 0。Antd Icons 保留全部 848 个组件。
- 数据库、附件备份已验证 SHA-256，数据库归档通过 `pg_restore --list` 检查；备份路径为 `/volume1/docker/plasmic/backups/0.5.31-20261031-145358`。保留 328 个前版独有的不可变静态文件，支持尚未刷新的 Web 页面。

SVG data URL 的百分号编码会在上传前解码为真实图片字节，再进行文件类型校验。发布时公开 URL 的 HEAD 校验设置 15 秒超时，连接失败或 5xx 最多尝试 3 次；404、类型不符或持续不可达仍会中止发布。相关 9 项测试、WAB 类型检查和 lint 通过；测试使用真实解码及文件类型检测，存储写入使用替身，生产演练另行验证真实存储和公开地址。

## 画布与缓存

目标为「客服平台 · GP评论查询」，修订 `158`。使用正式 Desktop 安装包内的 renderer/main 模块和隔离 Electron 配置，以及独立 HTTPS Web 会话；测量文档重新进入，不代表完整 App 进程冷启动。

| 指标 | App | Web |
| --- | ---: | ---: |
| 依赖资源首次全冷进入可编辑 | 4,004 ms | 9,595 ms |
| 连续三次热进入 | 2,466 / 2,461 / 2,358 ms | 2,440 / 2,450 / 2,344 ms |
| 热进入中位数 | 2,461 ms | 2,440 ms |
| 首次项目依赖模型 / 代码 GET | 5 / 4 | 5 / 4 |
| 热进入至可编辑的项目依赖模型 / 代码远端 GET | 0 / 0 | 0 / 0 |
| 目录关闭时预览图请求 | 0 | 0 |
| 已查看图片重新进入后远端请求 | 0 | 0 |

Web 热进入的两次 Host 浏览器加载事件均由 HTTP 缓存返回，没有源站校验。公开 Host 文件名与实际 HTML 的 SHA-256 一致，返回 `public, max-age=31536000, immutable`；公开首页字节哈希与新容器一致。

App 的 Host 加载由安装包本地协议处理。图片的 renderer 协议事件与底层转发事件不能重复计作网络请求；此轮重新进入后的 9 个底层图片 GET 全部 `fromCache=true`，Web 对应 9 个 GET 也全部命中缓存。

首轮还观察到编辑器后台首次获取 Plume `19.4.2` 模型，发生在可编辑后约 0.4–0.5 秒。Web 的连续快速导航曾取消未完成的下载，后续完成后缓存生效。这笔后台请求未计入表中的当前项目依赖或可编辑关键路径。第二轮跨进程重新打开后的完整功能验收窗口中，App 远端及 Web 的库模型、代码请求均为 0。

App 和 Web 中 Antd6 的 Button 搜索结果有 8 张可见预览，Overseas AppShell 有 1 张，均成功解码；重新进入后再次检查通过。原生 Preview 的输入、重置、刷新通过，`runtime.status=ready`、`runtime.errors=[]`；返回编辑器仍为修订 `158`、`changeCounter=0`，没有项目写请求。Preview 控制台另有 3 条 `ResizeObserver loop completed with undelivered notifications.` 提示，本次业务交互断言均通过。

本轮记录当前部署行为，没有交替的前后构建 A/B，不将这些数据解释为相对旧版的固定秒数收益。

## CDN 缓存处理决定

源站 SVG 已返回一年 immutable 缓存，但此前 CDN 缓存的部分 SVG 响应仍为 `max-age=14400, s-maxage=31536000`。当前重进缓存命中通过；CDN 旧缓存头尚未全部刷新，不能声称全部公开 SVG 已按一年客户端缓存生效。

用户决定本次保留 CDN 缓存，不清理这 123 个组件预览图 URL 的 CDN 副本，也不再等待 Cloudflare 登录。发布、部署及功能验收结果保持通过。后续如需让现有 CDN 响应使用新的缓存头，可单独清理这些 URL 并验证公开响应；源文件和已发布库版本无需修改。
