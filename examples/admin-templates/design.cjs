const sampleRows = Array.from({ length: 45 }, (_, i) => ({
  id: String(1001 + i),
  name: ["用户通知配置", "支付结果通知", "账户安全提醒"][i % 3] + (i > 2 ? ` ${Math.floor(i / 3) + 1}` : ""),
  category: i % 2 ? "账户" : "消息",
  status: i % 3 ? "启用" : "停用",
  owner: i % 2 ? "李明" : "王晓",
  updatedAt: "2026-10-09 09:30:00",
}));

function design(index) {
  const byName = new Map(index.map(c => [c.name, c]));
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const slot = (name, content) => `<slot name="${name}">${content}</slot>`;
  const target = (name, content) => `<slot-target name="${name}">${content}</slot-target>`;
  function component(name, nodeName, props = {}, slots = {}, styles = '') {
    const c = byName.get(name);
    if (!c) throw new Error(`Missing installed component ${name}`);
    const emptySlots = {
      'plasmic-antd6-card': ['title', 'extra', 'cover', 'actions'],
      'plasmic-antd6-form': ['submitSlot'],
      'plasmic-antd6-form-item': ['tooltip'],
    }[name] || [];
    slots = { ...Object.fromEntries(emptySlots.map(name => [name, ''])), ...slots };
    return `<plasmic-component data-plasmic-component="${name}"${c.projectId ? ` data-plasmic-project="${c.projectId}"` : ''} data-plasmic-name="${nodeName}" data-props="${esc(JSON.stringify(props))}"${styles ? ` style="${esc(styles)}"` : ''}>${Object.entries(slots).map(([n, html]) => slot(n, html)).join('')}</plasmic-component>`;
  }
  const antd = (name, nodeName, props, slots, styles) => component(`plasmic-antd6-${name}`, nodeName, props, slots, styles);
  const text = (value, nodeName, props = {}) => antd('typography-text', nodeName, props, { children: esc(value) });
  const flex = (name, children, props = {}, styles = 'width:100%;min-width:0') => antd('flex', name, { vertical: true, gap: 16, ...props }, { children }, styles);
  const button = (name, label, props = {}, icon) => antd('button', name, { size: 'medium', ...props }, { children: esc(label), ...(icon ? { icon: component(`plasmic-antd-icon-${icon}`, icon, {}, {}, 'color:currentColor') } : {}) });
  const card = (name, children, title, extra, padding = '16px 20px') => antd('card', name, { size: 'medium', variant: 'outlined', styles: { body: { padding } } }, { children, ...(title ? { title } : {}), ...(extra ? { extra } : {}) }, 'width:100%;min-width:0');
  const select = (name, options) => antd('select', name, { options: options.map(v => ({ value: v, label: v })), size: 'medium', allowClear: true }, { placeholder: '请选择' }, 'width:100%;min-width:0');
  const fields = (prefix = '') => [
    ['keyword', '名称', antd('input', `${prefix}NameFilter`, { placeholder: '请输入名称', size: 'medium', allowClear: true }, {}, 'width:100%')],
    ['category', '分类', select(`${prefix}CategoryFilter`, ['消息', '账户'])],
    ['status', '状态', select(`${prefix}StatusFilter`, ['启用', '停用'])],
  ].map(([name, label, child]) => component('plasmic-overseas-search-form-item', `${prefix}${name[0].toUpperCase() + name.slice(1)}FilterField`, { name, label, span: 6, clearValue: null }, { children: child })).join('');
  const search = (name = 'SearchForm', prefix = '', editable = true) => component('plasmic-overseas-search-form', name, { colSpan: 6, minRows: 1, marginBottom: 0, labelWidth: 48 }, { children: editable ? target('filterFields', fields(prefix)) : fields(prefix) }, 'width:100%;min-width:0');
  const column = (name, title, props, render) => antd('table-column', name, props, { title: esc(title), ...(render ? { render } : {}) });
  const columns = (prefix = '') => [
    column(`${prefix}IDColumn`, '编号', { dataIndex: 'id', width: 96 }),
    column(`${prefix}NameColumn`, '名称', { dataIndex: 'name', ellipsis: true }),
    column(`${prefix}CategoryColumn`, '分类', { dataIndex: 'category', width: 112, displayType: 'tag', tagOptions: [{ value: '消息', label: '消息', color: 'blue' }, { value: '账户', label: '账户', color: 'purple' }] }),
    column(`${prefix}StatusColumn`, '状态', { dataIndex: 'status', width: 104, displayType: 'custom' }, antd('badge', `${prefix}StatusBadge`, { status: '{{ row.status === "启用" ? "success" : "default" }}', text: '{{ row.status }}' })),
    column(`${prefix}OwnerColumn`, '负责人', { dataIndex: 'owner', width: 112 }),
    column(`${prefix}UpdatedAtColumn`, '更新时间', { dataIndex: 'updatedAt', width: 200, ellipsis: true }),
    column(`${prefix}ActionsColumn`, '操作', { fixed: 'right', width: 168, displayType: 'custom' }, component('plasmic-react-ui-action-group', `${prefix}RecordActions`, { max: 3, items: [{ key: 'detail', label: '详情' }, { key: 'edit', label: '编辑' }, { key: 'copy', label: '复制' }, { key: 'disable', label: '停用', confirm: { title: '确认停用该记录？', okText: '停用', cancelText: '取消' } }], dropdownProps: { trigger: ['hover'] } })),
  ].join('');
  const table = (name = 'Table', rows = sampleRows, prefix = '', editable = true) => antd('table', name, { data: `{{ ${JSON.stringify({ data: rows })} }}`, rowKey: '{{ "id" }}', size: 'large', pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50, 100], showSizeChanger: true }, scroll: { x: 1080 } }, { children: editable ? target('tableColumns', columns(prefix)) : columns(prefix) }, 'width:100%;min-width:0');
  const primaryAction = () => button('CreateRecord', '新建', { type: 'primary' }, 'PlusOutlined');
  const tab = (key, label, name, content) => antd('tab-item', name, { key }, { label: esc(label), children: content });
  const tabs = (name, items, extra = '') => antd('tabs', name, { defaultActiveKey: '{{ "all" }}', size: 'medium', type: 'line' }, { items, ...(extra ? { tabBarExtraContentRight: extra } : {}) }, 'width:100%;min-width:0');
  const searchTable = () => flex('SearchTableSection', search() + card('ListCard', table(), target('listTitle', '资源列表'), target('primaryActions', primaryAction())));
  const tabsTable = () => card('TabsTableSection', tabs('Tabs', tab('all', '全部', 'AllRecordsTab', table('AllRecordsTable', sampleRows, 'All', true)) + tab('mine', '我负责的', 'MyRecordsTab', table('MyRecordsTable', sampleRows.filter(r => r.owner === '王晓'), 'My', false)), target('primaryActions', primaryAction())), null, null, '0 20px');
  const catalog = () => {
    const menu = antd('menu', 'CatalogMenu', { mode: 'inline', defaultSelectedKeys: ['messages'] }, { children: ['messages', 'accounts', 'payments'].map((key, i) => antd('menu-item', ['MessagesModule', 'AccountsModule', 'PaymentsModule'][i], { key }, { children: ['消息模块', '账户模块', '支付模块'][i] })).join('') });
    const left = card('CatalogCard', flex('CatalogBody', antd('input-search', 'CatalogSearch', { placeholder: '搜索模块', allowClear: true }, {}, 'width:100%') + target('catalogItems', menu)), '模块目录');
    const content = tabs('Tabs', tab('all', '业务配置', 'BusinessConfigTab', flex('BusinessConfigContent', search('BusinessConfigSearchForm', 'Business', true) + table('BusinessConfigTable', sampleRows, 'Business', true))) + tab('platform', '平台配置', 'PlatformConfigTab', flex('PlatformConfigContent', search('PlatformConfigSearchForm', 'Platform', false) + table('PlatformConfigTable', sampleRows.slice(0, 8), 'Platform', false))), target('primaryActions', primaryAction()));
    return antd('row', 'CatalogTabsSection', { gutter: 16, wrap: false, align: 'top' }, { children: antd('col', 'CatalogColumn', { flex: '248px' }, { children: left }, 'min-width:0') + antd('col', 'WorkspaceColumn', { flex: 'auto' }, { children: card('WorkspaceCard', content, null, null, '0 20px') }, 'min-width:0') }, 'width:100%;min-width:0');
  };
  const descriptionItems = [
    { key: 'id', label: '编号', children: '1001' },
    { key: 'name', label: '名称', children: '用户通知配置' },
    { key: 'category', label: '分类', children: '消息' },
    { key: 'owner', label: '负责人', children: '王晓' },
    { key: 'updatedAt', label: '更新时间', children: '2026-10-09 09:30:00' },
    { key: 'description', label: '说明', children: '用于管理用户通知的展示内容与启用状态。', span: 3 },
  ];
  const descriptions = (name = 'Descriptions', columnCount = 3, title = '基本信息') => antd('descriptions', name, { column: columnCount, size: 'medium', items: descriptionItems }, { title: esc(title) }, 'width:100%');
  const detail = () => flex('DetailSection', card('BasicInformationCard', target('summaryContent', descriptions())) + card('RelatedRecordsCard', target('relatedContent', table('RelatedRecordsTable', sampleRows.slice(0, 3), 'Related', false)), '关联记录'));
  const formFields = () => [
    ['NameField', 'name', '名称', antd('input', 'RecordName', { placeholder: '请输入名称', maxLength: 80, size: 'medium' }, {}, 'width:100%'), [{ ruleType: 'required', message: '请输入名称' }, { ruleType: 'whitespace', message: '请输入名称' }]],
    ['CategoryField', 'category', '分类', select('RecordCategory', ['消息', '账户']), [{ ruleType: 'required', message: '请选择分类' }]],
    ['DescriptionField', 'description', '说明', antd('textarea', 'RecordDescription', { placeholder: '请输入说明', autoSize: true, maxLength: 500 }, {}, 'width:100%'), []],
  ].map(([nodeName, name, label, child, rules]) => antd('form-item', nodeName, { name, rules }, { label: esc(label), children: child })).join('');
  const form = (editable = true) => antd('form', 'Form', { mode: 'advanced', layout: 'vertical', autoDisableWhileSubmitting: true }, { children: editable ? target('formFields', formFields()) : formFields() }, 'width:100%;max-width:720px;min-width:0');
  const formActions = () => antd('space', 'FormButtons', { orientation: 'horizontal', size: 8 }, { children: button('CancelEdit', '取消') + button('SubmitRecord', '提交', { type: 'primary', submitsForm: true }) });
  const basicForm = () => card('FormCard', flex('FormContent', antd('form', 'Form', { mode: 'advanced', layout: 'vertical', autoDisableWhileSubmitting: true }, { children: target('formFields', formFields()) + target('formActions', formActions()) }, 'width:100%;max-width:720px;min-width:0')), target('formTitle', '新增资源'));
  const drawerDetail = () => antd('drawer', 'Drawer', { placement: 'right', size: 640, open: false }, { title: target('drawerTitle', '查看资源'), children: target('detailContent', descriptions('Descriptions', 2)), footer: target('drawerActions', flex('FooterActions', button('CloseDetail', '关闭'), { vertical: false, justify: 'end', gap: 12 })) });
  const drawerForm = () => antd('drawer', 'Drawer', { placement: 'right', size: 640, open: false, destroyOnHidden: true }, { title: target('drawerTitle', '新增资源'), children: form(), footer: target('drawerActions', flex('FooterActions', button('CancelEdit', '取消') + button('SubmitRecord', '提交', { type: 'primary' }), { vertical: false, justify: 'end', gap: 12 })) });
  const shell = (content, active) => component('plasmic-overseas-app-shell', 'AppShell', { productName: '业务管理平台', userName: '示例用户', appSources: [{ value: 'demo', label: '示例应用' }], appSource: 'demo', currentTime: '2026-10-09T09:30:00+08:00', language: 'zh-CN', selectedMenuKey: active, menuItems: [{ key: 'resources', label: '资源管理', children: [{ key: 'list', label: '资源列表' }, { key: 'workspace', label: '配置工作区' }, { key: 'form', label: '新增资源', hidden: true }, { key: 'detail', label: '资源详情', hidden: true }] }] }, { children: content }, 'width:100%;height:100vh;min-width:1440px;min-height:0;max-height:100vh');
  const own = (name, slots = {}) => component(name, name, {}, slots, 'width:100%;min-width:0');
  const recordHeader = () => flex('DetailHeader', flex('DetailHeading', antd('tooltip', 'ReturnTooltip', { titleText: '返回资源列表', trigger: '{{ ["hover", "focus"] }}' }, { children: button('ReturnToList', '', { type: 'text' }, 'ArrowLeftOutlined') }) + antd('typography-title', 'RecordTitle', { level: 4 }, { children: '用户通知配置' }, 'margin:0;letter-spacing:normal'), { vertical: false, gap: 8, align: 'center' }, 'width:auto;min-width:0;flex:1') + antd('badge', 'RecordStatus', { status: 'success', text: '启用' }, {}, 'flex-shrink:0;white-space:nowrap'), { vertical: false, justify: 'space-between', align: 'center' });
  const templates = [
    { name: 'SearchTableSection', kind: 'section', pattern: 'standard-list', html: searchTable() },
    { name: 'TabsTableSection', kind: 'section', pattern: 'standard-list', html: tabsTable() },
    { name: 'CatalogTabsSection', kind: 'section', pattern: 'split-tabs', html: catalog() },
    { name: 'DetailSection', kind: 'section', pattern: 'profile-basic', html: detail() },
    { name: 'DrawerDetailSection', kind: 'overlay', pattern: 'drawer-detail', html: drawerDetail() },
    { name: 'DrawerFormSection', kind: 'overlay', pattern: 'drawer-form', html: drawerForm() },
  ];
  const pages = () => [
    { name: 'StandardListPage', kind: 'page', pattern: 'standard-list', html: shell(own('SearchTableSection'), 'list') },
    { name: 'SplitTabsPage', kind: 'page', pattern: 'split-tabs', html: shell(own('CatalogTabsSection'), 'workspace') },
    { name: 'BasicFormPage', kind: 'page', pattern: 'basic-form', html: shell(basicForm(), 'form') },
    { name: 'RecordDetailPage', kind: 'page', pattern: 'profile-basic', html: shell(flex('PageBody', recordHeader() + own('DetailSection')), 'detail'), propEdits: [{ nodeName: 'ReturnToList', props: { 'aria-label': '返回资源列表' } }] },
  ];
  return { templates, pages, component, antd, flex, shell, table, search, fields, descriptions, form, formFields, button, recordHeader, card, tabs, tab, text, sampleRows };
}

module.exports = { design, sampleRows };
