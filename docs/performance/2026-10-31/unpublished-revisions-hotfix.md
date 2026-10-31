# 0.5.27 未发布修订列表热修复

## 当前生产接口边界

`GET /api/v1/projects/:projectId/revs/unpublished` 返回不含模型数据的历史列表，不参与依赖模型缓存协商。Desktop 必须保留 GET、branchId 和 revisionNumGt 查询参数。

生产 0.5.27 的真实修订 `/revs/:revisionId` 仍参与只读 POST 模型协商。服务端在参数路由之前注册 `/revs/unpublished` 的 POST 列表入口，允许已发布的 0.5.27 客户端正常读取历史列表；该入口使用相同权限和筛选逻辑，不将 unpublished 解释为修订 ID。

## 当前源码的资源化边界

源码已移除摘要协商和原地址上的读取 POST。项目接口恢复 GET，固定返回项目正文和依赖资源引用；组件库模型通过独立资源 GET 获取，Desktop 命中本地文件后不访问服务端，JS 仍按独立版本化制品加载。首次打开由项目 GET 一并返回启动上下文，专用 bootstrap 接口删除；原项目写入 POST 恢复原处理链。

源码尚未配套发布。新 `dependency_model_resource` 表用于保存不可变模型制品。发布时须执行数据库迁移，配套更新 App 与服务端，并移除临时热修复镜像覆盖；不能只部署新服务端后让 0.5.27 继续使用已移除的协商 POST。验收见 [模型资源化](model-resource-loading.md)。

## 生产部署

NAS `/volume1/docker/plasmic/images/compose.yml` 的 server 服务临时指定 `plasmic-server:0.5.27-revisions-fix`。镜像基于原 0.5.27，只替换 AppServer.ts，服务重建后保持有效。其它服务和数据库版本不变。

热修复构建文件、只读检查脚本和原配置备份位于 `/volume1/docker/plasmic/hotfixes/0.5.27-revisions/`。下一次配套发布必须包含仓库中的资源化接口、数据库迁移和新版客户端，并移除 server 服务单独的 image 覆盖，使其重新继承 IMAGE_TAG。客户端匹配修复尚未重新打包发布，当前安装包由服务端入口修复恢复工作。

回滚：恢复该目录的 compose.before.yml，再重建 server。回滚会重新暴露旧客户端的历史列表错误，无需数据库恢复。

## 验证

- `node --test desktop/tests/*.test.cjs`：495 项通过。
- `pnpm --dir platform/wab exec vitest run src/wab/server/routes/project-revision-routing.test.ts src/wab/server/routes/dependency-model-cache.test.ts`：2 文件、6 项通过。
- 生产数据库只读检查：通过真实 AppServer 注册路由和现有普通用户权限，验证 GET/POST 列表一致、revisionNumGt 过滤、真实修订模型协商和匿名访问拒绝。未修改项目。
- 当前已安装 Desktop 0.5.27 重新加载 Admin Templates 画布成功；生产真实请求 `POST /api/v1/projects/145nN6S5QQBwgjtNUwuiQZ/revs/unpublished` 返回 200。
