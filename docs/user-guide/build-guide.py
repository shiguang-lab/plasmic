"""Generate the self-contained Chinese HTML onboarding guide."""
from pathlib import Path
from base64 import b64encode
from html import escape
import mimetypes
from PIL import Image
ROOT = Path(__file__).resolve().parent
OUT = ROOT / '织界产品设计与代码生成使用指南.html'
sections = []
def p(s): return f'<p>{s}</p>'
def steps(items): return '<ol class="steps">'+''.join(f'<li>{s}</li>' for s in items)+'</ol>'
def bullets(items): return '<ul>'+''.join(f'<li>{s}</li>' for s in items)+'</ul>'
def note(title,s,important=False): return f'<aside class="note {"important" if important else ""}"><strong>{title}</strong><p>{s}</p></aside>'
def code(s,title='终端命令'): return f'<div class="code"><div class="code-head"><span>{title}</span><button type="button" class="copy">复制</button></div><pre><code>{escape(s)}</code></pre></div>'
def image(name,caption,marks=(),narrow=False,focus=None):
    path=ROOT/'screenshots'/name
    with Image.open(path) as shot:
        width, height = shot.size
    src=f'data:{mimetypes.guess_type(name)[0]};base64,'+b64encode(path.read_bytes()).decode()
    pins=''.join(f'<span class="pin" style="left:{x}%;top:{y}%" aria-hidden="true">{i}</span>' for i,(x,y,label) in enumerate(marks,1))
    if focus:
        pins += f'<span class="target-ring" style="left:{focus[0]}%;top:{focus[1]}%" aria-hidden="true"></span>'
    labels='<div class="legend">'+''.join(f'<span><b>{i}</b>{label}</span>' for i,(x,y,label) in enumerate(marks,1))+'</div>' if marks else ''
    return f'<figure class="{"narrow" if narrow else ""}"><button class="shot" type="button" aria-label="放大截图：{escape(caption)}"><img width="{width}" height="{height}" src="{src}" alt="{escape(caption)}">{pins}</button><figcaption>{caption} <span>点击放大</span></figcaption>{labels}</figure>'
def table(headers,rows): return '<table><thead><tr>'+''.join(f'<th>{x}</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{x}</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table>'
def section(title,sub,body):
    i=len(sections)+1
    sections.append((title,f'<section id="step-{i:02}"><div class="section-title"><span class="number">{i:02}</span><div><h2>{title}</h2><p>{sub}</p></div></div>{body}</section>'))

section('下载并安装','先安装 Desktop，为后续 Agent 连接做好准备。',
 p('打开 <a href="https://shiguanglab.com/projects/zhijie#download" target="_blank" rel="noopener">织界官网下载页 ↗</a>，在下载区选择与电脑匹配的安装包。安装后应用名称显示为 <strong>Plasmic</strong>。')+
 image('01-download.jpg','官网下载区：右侧选择 Desktop 安装包。截图中的版本号为截图时记录，下载以官网最新版本为准。',[(76,64,'按设备选择安装包')])+
 table(['电脑','安装包','安装操作'],[
 ['Mac · M 系列芯片','Apple Silicon / DMG','打开 DMG，将 Plasmic 拖入 Applications（应用程序）。'],
 ['Mac · Intel 芯片','Intel / DMG','打开 DMG，将 Plasmic 拖入 Applications。'],
 ['Windows x64','EXE','运行安装程序，按向导完成安装。'],
 ['Linux x64','AppImage','赋予可执行权限后运行。']])+
 p('Mac 在苹果菜单 →“关于本机”查看芯片类型。Linux 将以下文件名替换为实际下载文件名：')+
 code('chmod +x "Plasmic-版本号-linux-x86_64.AppImage"\n./Plasmic-版本号-linux-x86_64.AppImage')+
 note('完成标志','能够启动 Plasmic，看到登录入口。只做网页编辑可使用 Studio；外部 Agent 设计和研发读取设计需要 Desktop。'))

section('通过 Google 注册','点击 Google 注册入口，使用自己的 Google 账号完成授权。',
 p('打开 <a href="https://shiguanglab.com/register" target="_blank" rel="noopener">拾光账号注册页 ↗</a>。织界使用拾光统一账号。')+
 '<div class="split">'+image('03-register.jpg','Google 注册入口位于表单下方：点击中间的彩色 G 图标。',[(50,68,'点击 Google 注册')],True,focus=(50,74.5))+'<div>'+
 steps(['在页面下方“或使用以下方式注册”区域，点击<strong>中间的 Google（彩色 G）图标</strong>。',
 '在跳转的 Google 页面选择自己的账号，按提示完成登录与授权。',
 '返回拾光后，按页面提示完成首次注册；如要求补充账号信息，使用 Google 授权账号对应的邮箱并完成提示步骤。',
 '确认注册后的账号邮箱。后续登录继续使用同一个 Google 账号，并将此邮箱提供给 yanxianliang 加入组织。'])+
 note('保留账号邮箱','使用 Google 注册后的账号必须有可用邮箱。以账号页面显示的邮箱为准，组织邀请和项目分享使用该邮箱。',True)+'</div></div>')

section('登录网页与 Desktop','完成浏览器授权，确认桌面应用也已进入工作区。',
 '<div class="split">'+image('02-login.jpg','统一登录页：点击下方 Google 图标，使用注册时的同一个 Google 账号。',[(50,76,'点击 Google 登录')],True,focus=(50,81.7))+'<div>'+
 steps(['打开 Plasmic Desktop，点击“登录”，应用会打开系统浏览器。',
 '在统一账号页面下方点击<strong>Google（彩色 G）图标</strong>，选择注册时使用的同一个 Google 账号，完成登录与授权。',
 '浏览器完成授权后，允许打开 Plasmic Desktop。未自动返回时，点击授权页的“Open Plasmic Desktop”或对应中文按钮。',
 '回到 Desktop，确认能看到项目列表或工作区。浏览器授权成功后，还需确认 Desktop 已实际登录。'])+
 p('网页入口：<a href="https://studio.plasmic.shiguanglab.com/" target="_blank" rel="noopener">Studio ↗</a>。网页和 Desktop 使用同一账号及云端项目。')+'</div></div>'+
 image('12-desktop-login.png','Desktop 登录入口，沿用 2026-10-11 界面记录。',[(73,65,'点击登录')])+
 note('账号问题','选择正确的 Google 账号；无法登录时使用登录页的“无法登录？”入口。网页已登录不等于 Desktop 已建立会话。')+
 '<h3>客户端自动更新</h3>'+
 p('Desktop 启动后会检查新版本，并在使用过程中每 10 分钟自动检查一次。发现更新后自动下载，可在应用菜单的“检查更新”或软件更新窗口查看状态。') +
 note('安装并重启后生效','更新下载完成后，先保存当前设计，再按软件更新窗口提示安装并重启。运行中的客户端不会直接切换为新版本。'))

section('连接 MCP','MCP 让外部 Agent 能读取并编辑 Desktop 中的设计。',
 steps(['保持 Desktop 运行并已登录，在应用菜单选择 <strong>AI → MCP</strong>。Mac 的应用菜单位于屏幕顶部。',
 '在“MCP 连接”窗口开启实际使用的客户端开关，例如 Codex CLI 或 Claude Code CLI。',
 '重启对应客户端或刷新 MCP 配置，确认服务列表中出现 <code>plasmic-desktop</code>。',
 '新建对话，让 Agent 读取应用状态，核对登录状态与当前项目。先确认连接正常，再开始设计任务。'])+
 image('11-mcp.png','MCP 连接窗口：开启目标客户端；未列出的客户端可复制配置。沿用 2026-10-10 界面记录。',[(93,18,'开启客户端开关'),(82,81,'复制 MCP 配置')],True)+
 code('请读取 Plasmic Desktop 的应用状态，确认登录状态、当前项目和 MCP 工具是否可用。暂时不要修改设计。','发给外部 Agent 的连接检查指令')+
 note('其他客户端','点击“复制 MCP 配置”，粘贴到目标客户端的 MCP 配置中，随后重启或刷新配置。移动 Desktop 安装位置后需重新生成配置。仅安装 Skill 不会自动完成 MCP 连接。'))

section('安装 CLI 与 Skill','安装一次 Skill，使用时自动检查最新 CLI 和工作流规范。',
 p('CLI 命令是 <code>plasmickit</code>，npm 包名为 <code>@plasmickit/cli</code>。先安装 <a href="https://nodejs.org/en/download" target="_blank" rel="noopener">Node.js ↗</a>，使用 <strong>22.12 或更高版本</strong>，安装后重新打开终端。')+
 code('node --version\nnpm --version\nnpx -y @plasmickit/cli@latest skill install','macOS / Linux 终端，或 Windows PowerShell')+
 steps(['确认 Node.js 与 npm 命令可用，再执行 CLI 安装命令。',
 '运行 <code>npx -y @plasmickit/cli@latest skill install</code>，检查输出，确认 Skill 已安装到自己使用的客户端。',
 '安装完成后在外部 Agent 中新建对话，明确要求“使用 Plasmic skill”。',
 '设计使用 prototype 工作流，研发生成代码使用 codegen 工作流；通常由 Agent 调用 Skill 自动加载。'])+
 '<h3>Skill 工作流自动更新</h3>'+
 p('使用 Plasmic Skill 时，Agent 通过 <code>npx @plasmickit/cli@latest</code> 调用最新发布的 CLI。每次加载设计或研发规范都会检查资源更新，自动下载并校验新版规范，再读取后执行任务。日常使用由 Skill 完成这些步骤。')+
 code('npx -y @plasmickit/cli@latest context resolve --mode prototype\nnpx -y @plasmickit/cli@latest context resolve --mode codegen','需要手动加载规范时')+
 note('当前任务中的更新','新版 CLI 在下一次调用时使用；已运行的命令保持原版本。当前任务需要采用新规范时，让 Agent 重新加载 Skill、执行 context resolve 并读取返回的规范文件。')+
 '<details><summary>可选：全局 CLI 与手动刷新</summary>'+
 code('npm install -g @plasmickit/cli@latest\nplasmickit --version','希望直接使用 plasmickit 命令时')+
 code('npx -y @plasmickit/cli@latest skill install\nnpx -y @plasmickit/cli@latest references update','需要刷新已安装的 Skill 入口或规范资源时')+
 p('全局安装的 CLI 通过 npm 更新。Skill 默认的 npx 调用会按最新发布版本解析，规范资源按每次加载结果更新。')+'</details>'+
 note('完成标志','目标 Agent 能使用 Plasmic Skill，同时已连接 Desktop MCP。CLI 提供 Skill 和规范，实际设计与代码生成由 Agent 执行。'))

section('提供账号，加入数禾组织','把注册信息交给 yanxianliang，由管理员添加组织权限。',
 steps(['将<strong>Google 注册后的账号邮箱</strong>提供给 <strong>yanxianliang</strong>；账号页面显示用户名时一并提供。说明需要加入<strong>数禾组织</strong>并访问<strong>原型 workspace</strong>。',
 '等待 yanxianliang 完成组织与工作区授权；如收到邀请邮件，按提示登录同一注册账号完成加入。',
 '刷新 Studio 或 Desktop，进入“组织与工作区”，确认能够看到数禾组织及“原型”工作区。',
 '仍看不到时，将账号邮箱、用户名（如有）和当前可见组织信息反馈给 yanxianliang，确认授权到了正确账号。'])+
 code('账号邮箱：<Google 注册后账号页面显示的邮箱>\n用户名（如有）：<账号页面显示的用户名>\n申请：加入数禾组织，并开通原型 workspace 的设计 / 项目访问权限。','可复制给 yanxianliang 的信息模板')+
 note('只提供账号识别信息','提供账号邮箱和用户名（如有）即可，不要提供密码、邮箱验证码或登录凭据。Google 注册不会自动加入数禾组织。',True))

section('在原型 workspace 创建设计','所有业务设计放在数禾组织下的“原型”工作区。',
 steps(['点击右上角“组织与工作区”。',
 '在左侧组织树选择<strong>数禾组织</strong>，再选择 <strong>原型 workspace</strong>。',
 '点击该工作区下的“新建项目”，填写项目名，并确认项目所属工作区为“原型”。',
 '创建后进入编辑器；已有需求项目直接打开，避免重复创建。项目名建议包含需求编号和业务模块。'])+
 image('13-organization.jpg','组织页：选择“数禾”组织下的“原型”workspace，再新建项目。',[(88.3,20,'组织与工作区'),(3,58,'数禾组织'),(4,75,'原型 workspace')])+
 note('看不到“原型”时','联系 yanxianliang 确认已加入数禾组织，并取得原型工作区的访问权限。',True)+
 image('05-create-project-crop.jpg','新建项目：填写项目名称，确认工作区为“原型”，再点击“创建”。',[(15,14,'项目名称'),(88,24,'选择原型 workspace'),(89,97,'创建')],True)+
 note('完成标志','项目归属数禾组织 → 原型 workspace。向外部 Agent 下达任务时也写明此组织和工作区。'))

section('认识编辑器','先定位页面，再选择节点修改属性、布局和交互。',
 image('06-editor.jpg','编辑器：文档 / 图层、画布、属性面板和保存状态。示例来自 Admin Templates。',[(12,11,'文档与图层'),(44,30,'设计画布'),(90,16,'属性与数据'),(25,4,'保存状态')])+
 table(['区域','怎么用'],[
 ['文档 / 图层','文档中切换或创建 Page、组件和画板组；图层中定位嵌套节点。业务页面设置 URL 路径。'],
 ['插入 / 库','添加布局与组件，优先使用已有组件库和模板。后台页面复用 AppShell、表格和表单。'],
 ['画布','点击选择组件，调整布局；需要时缩放、平移或“缩放以显示全部”。'],
 ['右侧属性 / 数据','修改所选组件的真实属性、插槽、样式、状态、查询和事件。'],
 ['顶部保存状态','确认“已保存”；修改后预览检查，再重新打开确认。']])+
 note('新的通用组件需求','如果设计需要组件库中尚未提供的通用组件，必须先联系 <strong>yanxianliang</strong> 进行补齐，补齐后才能在设计中使用。',True)+
 p('节点名称使用有意义的英文 PascalCase，例如 <code>CustomerTable</code>；业务文案可用中文。按钮需要配置事件、状态和数据，不能只修改文字与外观。'))

section('使用外部 Agent 设计','读取需求文档、生成完整原型，或修改现有设计。',
 steps(['完成 Desktop 登录、MCP 和 CLI / Skill 安装；使用现有项目时，在 Desktop 打开提示词指定的目标项目。',
 '在实际使用的外部 Agent 中新建对话，提供需求文档及本地 HTML、.pen 参考设计；明确“使用 Plasmic skill”。',
 '说明组织、工作区和现有项目名称；需要新建时明确指定工作区。先让 Agent 核对目标与需求，再开始编辑。',
 '设计期间保持 Desktop 运行。完成后打开 Preview 检查，确认保存并取得项目链接。'])+
 code('使用 Plasmic skill 设计 <需求名称> 的可编辑原型。\n组织：数禾；workspace：海外。\n项目：<现有项目名称，或明确要求在海外 workspace 新建>。\n需求文档：<本地文件路径或可访问链接>。\n参考设计：<本地html文件>、<本地.pen文件>。','复制到外部 Agent，再替换占位内容')+
 '<div class="two-cards"><div class="mini"><h3>需求输入</h3><p>业务目标、使用角色、页面清单、字段与枚举、校验、成功 / 失败状态、接口说明。可附参考截图。</p></div><div class="mini"><h3>任务结束后</h3><p>核对项目和页面链接，实际操作查询、表单、弹层与导航。修正时给出具体区域与预期行为。</p></div></div>'+
 code('使用 Plasmic skill 修改 <项目链接> 的 CustomerList 页面。\n只修改筛选区：新增状态筛选；重置时清空条件并回到第一页。\n保留表格、路由和其他页面。验证交互后保存并读回确认。','继续修改现有设计')+
 note('外部与内置 Agent','外部 Agent 在独立客户端运行，可读取需求文件并执行设计或研发代码任务，需要 Desktop MCP 和 Skill。内置 Agent 在编辑器运行，围绕当前页面或选区编辑。'))

section('使用内置 Agent 编辑','在编辑器内对当前页面或选区提出具体修改。',
 image('07-ai.jpg','左侧 AI 助手：输入修改、添加附件、选择模型并发送。',[(2.5,41,'打开 AI'),(15,84,'描述修改'),(7,87,'添加附件'),(14,87,'选择模型'),(19,87,'发送')])+
 steps(['先在画布或图层树选择目标区域，核对当前页面，避免选错编辑对象。',
 '点击左侧“AI”，打开助手；也可使用画布下方出现的 AI 输入入口。',
 '输入具体修改，说明要保留的内容。需要参考文件或图片时使用附件入口，选择可用模型，再发送。',
 '查看进度、结果或失败提示。任务执行时保持页面与选区范围稳定；若正在运行，等待结束或使用界面提供的停止入口。',
 '检查改动，在 Preview 验证。不符合要求时撤销或提出局部修正，最后确认“已保存”。'])+
 code('调整当前筛选区：将字段排为两行，统一标签宽度。\n查询和重置按钮放在第二行右侧。\n保留现有字段、绑定事件和表格，不修改其他页面。','内置 Agent 示例')+
 note('使用范围','以当前界面支持的选区 / 页面编辑能力为准。从完整需求建立多页面项目，或在本地工程生成代码时，使用外部 Agent + Plasmic Skill 流程。'))

section('预览与交互检查','进入运行态操作页面，确认设计能按需求使用。',
 image('06-editor.jpg','顶部操作区：显示器图标进入预览，旁边的新窗口图标在新标签页打开预览。',[(83.5,4,'预览'),(85.5,4,'新标签页预览')])+
 steps(['确认页面和保存状态，点击顶部“预览”或“在新标签页中打开预览”。',
 '像最终用户一样操作查询、重置、分页、Tab、详情、页面跳转和新增 / 编辑表单。',
 '检查必填、取消、再次打开、提交反馈，以及加载、空数据、失败和只读等需求状态。',
 '回到编辑器或原标签页修正问题，保存后重新预览。'])+
 image('08-preview.jpg','Preview 示例：使用查询、分页和新增入口验证交互。')+
 '<div class="split">'+image('09-preview-drawer-crop.png','新增资源抽屉：检查表单、取消和提交行为。',[],True)+'<div><h3>评审时重点操作</h3>'+
 bullets(['输入条件 → 查询 → 重置，确认筛选与页码。','切换分页与 Tab，确认内容与状态。','打开表单，检查必填；取消后再次打开。','点击详情与跳转，确认目标页面。'])+
 note('原型数据边界','截图来自模板示例，使用模拟数据。原型预览成功不代表已接入生产接口；研发阶段仍需联调。')+'</div></div>')

section('分享给评审与研发','复制项目链接，并确保对方拥有访问权限。',
 steps(['确认“已保存”，打开顶部项目名旁的项目菜单，选择“分享项目”。',
 '在分享窗口复制项目链接。邀请指定人员时，使用其注册邮箱并选择适合的角色。',
 '让接收者登录自己的账号，检查能否打开项目和预览。看不到时确认组织、原型 workspace 和项目权限。',
 '附上本次评审的页面、需求范围和待确认点。研发交接还应提供接口文档与业务规范。'])+
 image('10-share.jpg','当前分享窗口：复制链接、按邮箱邀请，并查看组织与工作区访问权限。已裁去个人成员邮箱行。',[(68,10,'复制链接'),(50,29,'输入注册邮箱'),(94,29,'选择角色'),(95,44,'邀请')],True)+
 note('链接与权限','复制链接不会自动授予访问权限。无法打开时联系 yanxianliang 或项目管理员确认授权。')+
 table(['交接项','需要提供'],[
 ['设计','项目链接、目标 Page / 路由、本次确认的设计范围。'],
 ['需求','字段、枚举、校验、交互、权限与异常状态。'],
 ['工程','研发在 Agent 中打开对应代码 Workspace；AI 读取项目结构、路由约定、公共组件和样式规范。'],
 ['接口','请求和响应、鉴权、错误处理及待联调项。']])+
 p('<strong>保存、分享、发布与上线是不同操作。</strong>保存保留设计，分享安排协作访问；发布按团队需要建立发布版本，研发应用上线仍走代码评审和部署流程。'))

section('研发读取设计并生成代码','在当前 Agent 的 Workspace 目录中实现，由 AI 按项目结构安排页面与路由。',
 steps(['研发先注册登录并取得设计权限，完成 Desktop MCP 和 CLI / Skill 配置。在 Desktop 打开目标设计项目。',
 '在外部 Agent 中打开代码 Workspace，或在该工程目录启动 Agent；当前 Workspace 目录就是代码实现的位置。',
 '提供设计项目链接、目标页面、需求文档和接口契约，要求使用 Plasmic Skill 的 codegen 流程。',
 '让 Agent 读取真实模型、组件、状态、事件、弹层和隐藏 Tab；检查当前工程结构、依赖和公共组件，自行确定页面位置与路由并实现。',
 '检查变更文件，执行工程已有的相关检查，从实际应用入口操作验收，之后走团队代码评审与上线流程。'])+
 code('npx -y @plasmickit/cli@latest context resolve --mode codegen','研发工作流；通常由 Agent 加载')+
 code('使用 Plasmic skill，按 codegen 流程实现设计。\n设计项目：<项目链接>；页面：<页面名称>。\n需求文档：<路径或链接>；接口文档：<路径或链接>。\n\n在当前 Agent 的 Workspace 目录中实现。\n根据现有项目结构与路由约定，自行确定页面位置和路由。\n读取真实页面模型、组件契约、状态、事件和隐藏分支。\n沿用工程已有技术栈、公共组件、请求与权限封装。\n实现 React / TypeScript 页面，并接入真实路由。\n保留查询、重置、分页、详情、表单和提交流程。\n区分原型模拟数据与真实接口，不假设已有生产服务。\n执行相关类型检查、测试与构建，在真实入口验收。\n交付变更文件、已完成行为、验证结果和待联调项。','研发可复制指令')+
 note('研发完成标志','页面已接入目标工程并可从真实路由进入，交互符合需求，接口与权限边界清楚，有实际检查结果。CLI 本身不导出页面代码，由 Agent 在目标工程中实现。')+
 table(['验收范围','检查内容'],[
 ['视觉与路由','页面可打开；布局、组件、文案与设计一致；复用宿主外壳。'],
 ['查询与分页','参数正确；查询 / 重置回到正确页；total 与数据一致。'],
 ['表单与弹层','必填和边界校验正确；取消再打开无旧值；提交反馈正确。'],
 ['接口与权限','区分加载、空、失败和只读；鉴权与权限符合业务要求。'],
 ['工程检查','执行相关类型检查、测试与构建，记录真实结果。']]))

section('后续修改与常见问题','按变更范围更新设计和代码；先核对账号、连接与项目。',
 note('使用支持与修复','遇到任何使用问题，请联系 <strong>yanxianliang</strong> 进行处理和修复。反馈时提供项目链接、操作步骤、错误提示或截图，便于定位问题。')+
 '<h3>设计调整后更新研发代码</h3>'+
 code('使用 Plasmic skill 更新当前 Agent Workspace 中的 <页面名称>。\n设计源：<项目链接>；本次变更：<具体区域和行为>。\n按现有项目结构定位页面，重新读取受影响设计。\n保留其他页面、路由和业务逻辑。\n完成后运行相关检查，从真实应用入口验收。','增量更新指令')+
 '<details open><summary>看不到数禾组织或原型 workspace</summary><p>核对是否使用注册时的同一个 Google 账号登录。将账号邮箱和用户名（如有）提供给 yanxianliang，确认组织、工作区及项目授权；之后刷新或重新登录。</p></details>'+
 '<details><summary>外部 Agent 找不到 Plasmic 工具</summary><p>检查 Desktop 是否运行且已登录、MCP 开关是否开启。重启 Agent 或刷新配置，再读取应用状态。移动应用位置后需重新生成配置。</p></details>'+
 '<details><summary>CLI / Skill 安装后仍不可用</summary>'+code('npx -y @plasmickit/cli@latest --version\nnpx -y @plasmickit/cli@latest skill install --dry-run\nnpx -y @plasmickit/cli@latest version check\nnpx -y @plasmickit/cli@latest references check')+'<p>检查是否检测到目标客户端，必要时先安装或初始化客户端。使用全局 CLI 的用户切换 Node.js 环境后，需在当前环境重新安装。</p></details>'+
 '<details><summary>内置 Agent 失败或没有修改</summary><p>检查选区、模型与错误提示，提供明确且较小的修改范围。仍失败时反馈项目、操作步骤与错误信息。</p></details>'+
 '<details><summary>原型可点击，研发页面却没有业务功能</summary><p>检查设计的事件、状态和数据；提供完整接口与交互契约。模拟数据验证与真实接口联调分别验收。</p></details>'+
 '<details><summary>截图来源与更新说明</summary><p>下载、账号、编辑器、AI、预览和分享截图于 2026-10-14 从实际界面截取；组织页与新建项目窗口截图在本次修订中按“数禾 → 原型”的当前界面更新。Desktop 登录及 MCP 图片沿用仓库 2026-10-11 和 2026-10-10 界面记录。编辑器和预览采用 Admin Templates 示例数据。当前标签、模型和权限以实际使用时为准。</p><p>截图过程未创建账号、提交 Agent 任务、邀请成员或更改共享权限。</p></details>')

nav=''.join(f'<a href="#step-{i:02}"><span>{i:02}</span>{title}</a>' for i,(title,_) in enumerate(sections,1))
css='''
.target-ring{position:absolute;transform:translate(-50%,-50%);width:9%;aspect-ratio:1;border:3px solid #f7c24a;border-radius:50%;box-shadow:0 0 0 2px #19151f;pointer-events:none}
:root{--ink:#20202d;--muted:#686877;--accent:#6e49cf;--line:#e6e3ed;--soft:#f1edfa}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:85px}body{margin:0;background:#f7f6fa;color:var(--ink);font:16px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:4px}button{font:inherit;cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #ac92ee;outline-offset:4px}header{height:64px;border-bottom:1px solid var(--line);background:#ffffffed;position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:0 32px;backdrop-filter:blur(12px)}.brand{font-size:19px;font-weight:750;display:flex;gap:12px;align-items:center}.logo{width:30px;height:30px;background:var(--accent);color:white;border-radius:9px;display:grid;place-items:center;font-size:17px}.header-meta{font-size:12px;color:var(--muted)}.shell{max-width:1400px;margin:auto;display:grid;grid-template-columns:245px minmax(0,1fr);gap:38px;padding:34px 36px 70px}.sidebar{position:sticky;top:88px;align-self:start}.nav-label{font-size:11px;color:var(--muted);letter-spacing:2px;padding:0 10px;margin-bottom:10px}nav a{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:7px;text-decoration:none;font-size:13px;color:#50505e;line-height:1.8;margin:2px 0}nav a span{color:#9990ae;font:11px ui-monospace,monospace}nav a:hover{background:#ebe6f5;color:var(--accent)}nav a.active{background:var(--soft);color:var(--accent);font-weight:650}.sidebar-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding:16px 10px;margin-top:17px}.sidebar-note strong{color:var(--ink)}main{min-width:0}.hero{background:linear-gradient(120deg,#fff 60%,#eee8fa);border:1px solid var(--line);border-radius:18px;padding:40px;margin-bottom:26px}.eyebrow{color:var(--accent);font-size:12px;letter-spacing:2px;font-weight:700}h1{font-size:38px;line-height:1.35;letter-spacing:-1px;margin:12px 0 18px}h2{font-size:24px;line-height:1.4;margin:0}h3{font-size:18px;margin:23px 0 8px}p{margin:13px 0}.hero p{color:#5b5768;max-width:680px}.route{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px}.route span{background:white;border:1px solid #dfd8ed;border-radius:7px;padding:4px 10px}.route i{font-style:normal;color:#ada2c2}.hero-links{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}.hero-links a{font-size:13px;text-decoration:none;padding:9px 16px;background:var(--accent);color:white;border-radius:8px}.hero-links a.secondary{background:white;border:1px solid #ddd4ed;color:var(--accent)}section{background:white;border:1px solid var(--line);border-radius:14px;padding:30px 32px;margin:0 0 22px;scroll-margin-top:0}.section-title{display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:20px}.number{flex-shrink:0;width:42px;height:42px;border-radius:11px;background:var(--soft);color:var(--accent);font:600 17px/42px ui-monospace,monospace;text-align:center}.section-title p{font-size:14px;color:var(--muted);margin:6px 0 0}.steps{counter-reset:steps;list-style:none;padding:0;margin:20px 0}.steps li{position:relative;padding:0 0 0 36px;margin:14px 0;counter-increment:steps}.steps li:before{content:counter(steps);position:absolute;left:0;top:2px;width:24px;height:24px;background:#efecf5;color:var(--accent);border-radius:50%;font-size:12px;line-height:24px;text-align:center;font-weight:650}ul{padding-left:22px}li{margin:8px 0}.note{padding:16px 20px;background:#f4f2fa;border-left:3px solid #9a7ddd;border-radius:0 9px 9px 0;margin:22px 0;font-size:14px}.note p{margin:5px 0 0}.note.important{background:#fff8ee;border-color:#d5a047}.note.important strong{color:#8a5f16}.code{border:1px solid #dedce7;border-radius:9px;margin:18px 0;background:#f8f7fb}.code-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #e8e5ef;font-size:12px;color:var(--muted)}.copy{border:1px solid #d9d2e6;background:white;color:var(--accent);border-radius:5px;padding:2px 11px;font-size:12px}pre{margin:0;padding:16px 18px;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.85 ui-monospace,SFMono-Regular,Consolas,"Microsoft YaHei",monospace}p code,li code,td code{padding:2px 5px;background:#f0edf6;border-radius:4px;font-size:.9em}figure{margin:24px 0}figure.narrow{max-width:540px;margin:24px auto}.shot{display:block;border:1px solid #dedbe5;padding:0;position:relative;border-radius:9px;background:#1b1b22;width:100%;line-height:0}.shot img{width:100%;height:auto;display:block;border-radius:8px}.pin{position:absolute;transform:translate(-50%,-50%);background:#784add;border:2px solid white;color:white;border-radius:50%;width:25px;height:25px;display:grid;place-items:center;font:700 12px/1 sans-serif;box-shadow:0 1px 6px #0008}figcaption{font-size:12px;color:var(--muted);margin:9px 0;line-height:1.7}figcaption span{color:var(--accent);white-space:nowrap}.legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12px}.legend span{display:flex;align-items:center;gap:6px}.legend b{background:var(--soft);color:var(--accent);border-radius:50%;width:20px;height:20px;display:grid;place-items:center;font-size:11px}.split{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:25px;align-items:start}.split figure{margin:16px 0;max-width:100%}.two-cards{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:22px 0}.mini{border:1px solid var(--line);border-radius:9px;padding:14px 18px;background:#fcfbfe}.mini h3{margin:0;font-size:15px}.mini p{font-size:14px;margin:6px 0 0}table{width:100%;border-collapse:collapse;margin:22px 0;font-size:14px;table-layout:fixed;overflow-wrap:anywhere}th,td{text-align:left;padding:12px 14px;border:1px solid var(--line);vertical-align:top}th{background:#f1eef7;font-weight:650}tr:nth-child(even) td{background:#fcfbfe}details{border:1px solid var(--line);border-radius:8px;margin:13px 0;padding:13px 16px;font-size:14px}summary{cursor:pointer;font-weight:600}details p{margin:10px 0 0}.footer{color:var(--muted);font-size:12px;text-align:center;padding:12px 20px}.menu-toggle{display:none}.progress{position:fixed;top:63px;height:2px;left:0;background:var(--accent);width:0;z-index:25}dialog{border:none;padding:12px;border-radius:12px;max-width:96vw;max-height:95vh;background:#18181f;color:white;box-shadow:0 15px 70px #0005}dialog::backdrop{background:#111827dc}dialog .zoom-header{display:flex;justify-content:space-between;align-items:center;padding:3px 5px 10px;font-size:12px;gap:20px}dialog .close{border:1px solid #777;background:#2a2833;color:white;padding:3px 12px;border-radius:5px}dialog img{display:block;max-width:92vw;max-height:82vh;object-fit:contain}#copy-status{position:fixed;right:25px;bottom:25px;background:#292239;color:white;font-size:13px;padding:10px 18px;border-radius:8px;z-index:40;display:none}
@media(max-width:1000px){.shell{grid-template-columns:200px minmax(0,1fr);gap:20px;padding:26px 22px}.hero{padding:28px}section{padding:25px 23px}h1{font-size:32px}.split{grid-template-columns:1fr 1fr}.sidebar-note{font-size:11px}nav a{font-size:12px}}
@media(max-width:760px){header{padding:0 18px}.header-meta{display:none}.menu-toggle{display:block;border:1px solid var(--line);background:white;border-radius:7px;padding:4px 12px;font-size:13px}.shell{display:block;padding:18px 14px 40px}.sidebar{display:none;position:static;background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:18px}.sidebar.open{display:block}nav{display:grid;grid-template-columns:1fr 1fr;gap:1px 7px}nav a{font-size:12px}.sidebar-note{display:none}.hero{padding:26px 22px;border-radius:13px}h1{font-size:29px}h2{font-size:21px}section{padding:23px 19px}.section-title{gap:12px}.number{width:36px;height:36px;line-height:36px}.split,.two-cards{grid-template-columns:1fr}.split figure.narrow{max-width:360px;margin:16px auto}.steps li{padding-left:32px}.legend{font-size:11px;gap:7px 12px}.pin{width:21px;height:21px;font-size:10px;border-width:1px}th,td{padding:9px 8px;font-size:12px}pre{font-size:12px;padding:13px}.note{padding:14px}.hero-links{gap:8px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
'''
script='''
const navLinks=[...document.querySelectorAll('nav a')],nodes=[...document.querySelectorAll('main section')];
function update(){let current=nodes[0];for(const n of nodes)if(n.getBoundingClientRect().top<=150)current=n;navLinks.forEach(a=>{const active=a.hash==='#'+current.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('.progress').style.width=(max>0?Math.min(100,100*scrollY/max):0)+'%';}
addEventListener('scroll',update,{passive:true});update();
const menu=document.querySelector('.menu-toggle'),sidebar=document.querySelector('.sidebar');menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(sidebar.classList.toggle('open'))));navLinks.forEach(a=>a.addEventListener('click',()=>{sidebar.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
const zoom=document.getElementById('zoom');document.querySelectorAll('.shot').forEach(b=>b.addEventListener('click',()=>{const img=b.querySelector('img');zoom.querySelector('img').src=img.src;zoom.querySelector('img').alt=img.alt;zoom.querySelector('.zoom-title').textContent=img.alt;zoom.showModal();}));zoom.querySelector('.close').addEventListener('click',()=>zoom.close());zoom.addEventListener('click',e=>{if(e.target===zoom)zoom.close();});
let timer;function status(s){const el=document.getElementById('copy-status');el.textContent=s;el.style.display='block';clearTimeout(timer);timer=setTimeout(()=>el.style.display='none',2600);}
document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{const block=b.closest('.code').querySelector('pre');try{await navigator.clipboard.writeText(block.innerText);status('已复制，请替换尖括号中的占位内容。');}catch{const range=document.createRange();range.selectNodeContents(block);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status('已选中文字，请按 Ctrl+C / ⌘C 复制。');}}));
'''
html=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="织界指南：下载、Google 注册、登录、MCP、CLI、数禾组织、原型 workspace、Agent、预览分享和研发。"><title>织界 · 产品设计与研发使用指南</title><style>{css}</style></head><body>
<header><div class="brand"><span class="logo" aria-hidden="true">织</span>织界 <span style="font-size:13px;font-weight:400;color:#737080">使用指南</span></div><div class="header-meta">产品 · 设计 · 研发 / v0.1.1</div><button type="button" class="menu-toggle" aria-controls="guide-nav" aria-expanded="false">步骤目录</button></header><div class="progress" aria-hidden="true"></div>
<div class="shell"><aside class="sidebar" id="guide-nav"><div class="nav-label">按步骤开始使用</div><nav aria-label="使用步骤">{nav}</nav><div class="sidebar-note"><strong>团队设计位置</strong><br>数禾组织 → 原型 workspace<br><br><strong>组织、组件与使用支持</strong><br>yanxianliang<br>提供账号邮箱 + 用户名（如有）</div></aside><main><div class="hero"><div class="eyebrow">GET STARTED · 从设计到代码</div><h1>产品设计与研发<br>使用指南</h1><p style="font-size:14px">适用版本：<strong>0.1.1</strong> · Skill 工作流与客户端支持自动更新。下载安装以官网最新可用版本为准。</p><p>从下载安装和 Google 注册开始，在数禾组织的原型 workspace 中设计；用外部或内置 Agent 完成原型，再预览、分享并交给研发实现。</p><div class="route"><span>下载</span><i>→</i><span>注册</span><i>→</i><span>登录</span><i>→</i><span>MCP</span><i>→</i><span>CLI</span><i>→</i><span>组织与工作区</span><i>→</i><span>设计与研发</span></div><div class="hero-links"><a href="#step-01">从第 1 步开始</a><a class="secondary" href="#step-09">外部 Agent 设计</a><a class="secondary" href="#step-13">研发生成代码</a></div></div>{''.join(body for _,body in sections)}<footer class="footer">织界使用指南 · 适用版本 0.1.1 · 2026 年 10 月 14 日更新<br>截图已嵌入本 HTML，可直接打开或将单个文件发送给同事。</footer></main></div>
<dialog id="zoom" aria-label="截图查看器"><div class="zoom-header"><span class="zoom-title"></span><button class="close" type="button">关闭 · Esc</button></div><img alt=""></dialog><div id="copy-status" role="status" aria-live="polite"></div><script>{script}</script></body></html>'''
OUT.write_text(html,encoding='utf-8')
print(f'{OUT} ({OUT.stat().st_size:,} bytes; {len(sections)} steps)')
