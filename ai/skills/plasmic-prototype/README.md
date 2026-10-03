# AI 原型生成（自托管 Plasmic）

AI 通过 Chrome DevTools MCP 调用 Studio 顶层窗口的 `PLASMIC_AI_TOOLS`，生成可继续在画布编辑的页面。模型由 AI 客户端提供；NAS 不需要配置官方云端 Copilot 或模型密钥。

## 接入

1. 在支持 MCP 的 AI 客户端添加 Chrome DevTools MCP：

   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"]
       }
     }
   }
   ```

   Chrome DevTools MCP 的安装要求和浏览器连接选项见其[官方文档](https://github.com/ChromeDevTools/chrome-devtools-mcp)。这是浏览器 MCP，不是 NAS 上的远程 `/mcp` 服务。浏览器打开 Studio 后，编辑接口才可用。

2. 将本目录的 `SKILL.md` 安装为客户端的 `plasmic-prototype` Skill。客户端没有 Skill 功能时，可将其内容作为工作指令。
3. 在 MCP 使用的 Chrome 会话中登录 `https://plasmic.studio.publib.cn`。
4. 给 AI 项目 URL 和需求，例如：

   > 使用 plasmic-prototype，为这个项目创建一个 Ant Design 6 项目管理原型：概览、任务列表、新建项目表单。包含模拟数据、可操作的状态切换，并适配手机。不要改动已有页面。完成后保存并重新打开验证。

## 接口

`window.PLASMIC_AI_TOOLS._meta` 提供各工具 JSON Schema。工具通过编辑器现有跨 iframe RPC 执行，遵守登录用户、项目和分支权限，写入现有撤销记录。

```js
const tools = window.PLASMIC_AI_TOOLS;
const identity = await tools.identify({
  model: "your-model", client: "your-client",
  skill: "plasmic-prototype", outputFormat: "json"
});
if (!identity.success) throw new Error(identity.error.message);
const response = await tools.read({});
if (!response.success) throw new Error(response.error.message);
const project = JSON.parse(response.output);
```

工具包括：`identify`、`read`、`createComponent`、`insertHtml`、`changeElement`、`deleteElement`、`createState`、`createInteraction`、`createStyleToken`、`navigate`、`validate`、`save`、`undo`。

- 名称、属性、选项、插槽与断点以 `read` 返回的真实契约为准。
- 导入错误或无效属性使该次工具写入回滚；不存在的组件不会被静默跳过。
- 修改已导入组件的定义被禁止，允许修改它在本项目中的实例。
- 保存成功需确认无待保存修改，并返回数据库修订号；不会自动发布。
- `validate` 检查结构及组件使用，不代表审美、响应式效果或业务正确性。

## 流程与质量验收

运行 `deploy/verify-ai-prototype.cjs` 的说明见文件及部署 README。验收应在 NAS 浏览器进行，记录工具调用、错误回滚、组件和属性、交互效果、桌面/手机截图及保存后重开结果。应另用不同自然语言需求评估 AI 客户端本身的生成质量；固定验收样例只验证编辑工具链。
