# Studio 事件归属

Web 与 Desktop 共用 Studio 的事件入口。普通指针事件按真实 DOM 所在区域处理；只有已经开始的手势临时监听文档。不存在接管全部页面事件的全局拦截器。

## 输入优先级

| 输入位置 / 状态                          | 处理者                          | 画布模型命令                                 |
| ---------------------------------------- | ------------------------------- | -------------------------------------------- |
| 输入框、富文本、原生选字、输入法组合输入 | 当前原生控件 / Slate            | 不接管文字输入和原生剪贴板                   |
| 模态弹窗、上下文菜单、底部弹层           | 最上层覆层；子控件先处理 Escape | 阻止背景命令；一次 Escape 只关闭一层         |
| 普通面板、工具栏、Portal 内容            | 实际命中的 UI                   | 点击、选字、滚动不启动画布手势               |
| 已获得焦点的画布、图层树                 | 模型输入区域                    | 设计模式允许模型剪贴板、撤销重做和编辑快捷键 |
| 已开始的拖拽、框选、平移                 | 发起手势的模块                  | 跨区域移动和释放继续原手势；取消后清理监听   |
| 交互模式、原生 Preview                   | 业务组件 / Preview 运行时       | 不执行设计画布选择和编辑快捷键               |

应用级命令与模型命令分开判断。面板打开本身不会禁止用户回到画布后继续编辑；原生文字选择始终优先于模型复制。`body` 不是模型输入区域。

## 接入位置

- `studio-input.ts` 统一定义设计模式、模型焦点、覆层命令边界和输入上下文失效。快捷键与剪贴板共用模型命令条件。画布和图层树根标记 `data-studio-model-input`，图层树沿用共享 `Scrollbar` 的 viewport 焦点。模型区内的 Escape 清除选择并保留键盘焦点。
- `ViewEditorController` 将普通 pointer / hover / wheel 入口绑定在画布 clipper 和各画布 iframe 文档。Portal 的 React 祖先关系不作为命中画布的依据；frame 转发通知只供外部交互监听使用，不能再次驱动画布选择。
- 按下后存在有效手势才注册全局 move / up / cancel。释放、Escape、失焦、模式或画布分组切换、所属 ViewCtx 或控制器销毁都会释放手势监听。画布按键在 keyup、Studio 窗口失焦或输入上下文失效时释放，同时结束方向键连按的撤销分组。已完成或取消的画布拖动会消费随后生成的 click。节点自由移动实时更新坐标，Escape 结束跟随并取消待定放置。
- `XDraggable` 使用 `react-draggable` 的移动算法，取消时立即释放底层 move / up 监听。`DraggableInsertable` 复用 `DragInsertManager`，每次拖动拥有独立队列，并在释放时按实际 DOM 命中判断是否落在画布。模式或分组切换会取消待处理插入，异步配置完成后还要核验原画板仍有效。取消和报错都清理撤销分组与拖动状态，成功放置后关闭插入面板。
- `shortcut-handler.tsx` 统一尊重已消费事件和组合输入，模式 / 模型焦点由 Studio 快捷键入口判断。不要新增独立的 document 编辑快捷键监听。
- `tools/react-aria-runtime.mjs` 让构建与测试共用 Studio 固定版本的 Aria / Stately 运行时，统一 Studio 和工作区 SDK 的 FocusScope、覆层栈与按压状态。
- `useStudioEscape` 管理覆层 Escape 顺序；`Modal`、`SidebarModal`、`BottomModal`、`ContextMenu`、工具菜单、项目菜单、版本弹层和可关闭面板使用同一入口。原生控件先处理 Escape，模态范围先于背景项目菜单和版本弹层处理 Escape。
- `platform/patches/overlayscrollbars@2.16.0.patch` 跳过对当前 activeElement 的重复聚焦，避免共享滚动区域初始化时把 iframe 内编辑焦点移回 iframe 本身。
- `useDismissibleStudioOverlay` 在 owner document 上监听一次外部交互，以 DOM 包含关系判断内外。覆层内部不阻止通用鼠标冒泡；不要通过禁止选字或逐个补 `stopPropagation` 修复画布归属。

新增模块按所属区域接入已有入口。只有真实跨区域手势才增加其生命周期内的文档监听；滚动区域继续由共享 `Scrollbar` 管理。

- `packages/react-web/src/states/helpers.ts` 在状态路径解析后读取命令对象，使渲染快照中的嵌套状态也能提供操作类型元数据。

## 回归入口

- `components/studio/view-editor-clipboard-focus.test.tsx`：Portal、焦点、剪贴板、手势释放与取消。
- `components/studio/add-drawer/DraggableInsertable.test.tsx`、`commons/components/XDraggable.test.tsx`：真实拖动组件、最终落点、取消、卸载与重试。
- `hooks/useDismissibleStudioOverlay.test.tsx`、`components/widgets/ModalScope.test.tsx`：外部滚轮、嵌套 Portal、原生模态范围、组合输入和 Escape。
- `playwright/e2e/studio-event-boundaries.spec.ts`、`left-panel.spec.ts`：实际 Studio、画布 iframe、面板拖入、原生选字复制、平移缩放和模型剪贴板。
- `playwright/e2e/rich-text.spec.ts`、`freestyle.spec.ts`、`migration-live.spec.ts`：富文本、连续绘制、撤销重做与页面保存重开。
