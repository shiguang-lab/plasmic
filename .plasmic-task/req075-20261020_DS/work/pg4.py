"""Reviewed declarations for /groups/onetime-create (page 4)."""
import sys
sys.path.insert(0, '.')
import gen_plan as g

SRC_PAGE = "**页面用途**：一次性客群建群——**客群来源唯一为「写SQL」**"
SRC_STEPS = "① 填写 SQL 校验 → ② 提交自动预跑 → ③ 保存 SQL（初始化）→ ④ 上线圈选（圈选中）→ ⑤ 启用生效"
SRC_BASIC = "确认后进入本页，**客群名称不再重复填写，展示于页面标题**"
SRC_SOURCE = "客群来源唯一为「写SQL」"
SRC_EXPIRE = "有效期: [14] 天 (默认 14、上限 365；一次性快照固定不刷新)"
SRC_HEAD = "SQL 编辑: [格式化] [校验]"
SRC_SQL = "**SQL 模式**：输入自定义 SQL"
SRC_STATE = "状态条: ✓ 校验通过 · 结果集含 uid + app_source"
SRC_PREVIEW = "展示 SQL 运行结果 **Top100 全字段**（脱敏）"
SRC_SUBMIT = "**预跑成功后才可保存 SQL / 上线**"
SRC_MENU = "顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"

BASIC = [("BasicNameItem", "客群名称", "存量促活-7月客群"),
         ("BasicKeyItem", "客群Key", "GRP_ONETIME_CUNLIANG7YUE_20260820"),
         ("BasicTypeItem", "客群类型", "一次性"),
         ("BasicScenarioItem", "业务场景", "客经"),
         ("BasicOwnerItem", "负责人", "傅玮颖"),
         ("BasicSourceItem", "App来源", "TACO（入口带入）")]
TEXTS = {
    "BasicNameItemLabel": "客群名称", "BasicNameItemText": "存量促活-7月客群",
    "BasicKeyItemLabel": "客群Key", "BasicKeyItemText": "GRP_ONETIME_CUNLIANG7YUE_20260820",
    "BasicTypeItemLabel": "客群类型", "BasicTypeItemText": "一次性",
    "BasicScenarioItemLabel": "业务场景", "BasicScenarioItemText": "客经",
    "BasicOwnerItemLabel": "负责人", "BasicOwnerItemText": "傅玮颖",
    "BasicSourceItemLabel": "App来源", "BasicSourceItemText": "TACO（入口带入）",
    "SourceItemLabel": "客群来源", "ExpireItemLabel": "有效期",
    "OnetimeFormatButtonText": "格式化", "OnetimeValidateButtonText": "校验",
    "OnetimeCheckAlertTitle": "校验通过",
    "OnetimeHitCountTitle": "命中规模", "OnetimeHitCountSuffix": "人",
    "OnetimeUidColumnTitle": "UID", "OnetimeRegColumnTitle": "注册时间",
    "OnetimeSourceColumnTitle": "App来源",
    "OnetimeSubmitButtonText": "提交", "OnetimeSaveSqlButtonText": "保存 SQL",
    "OnetimeOnlineButtonText": "上线", "OnetimeCancelButtonText": "取消",
    "OnetimePreflightRunningTitle": "预跑进行中，请稍候",
    "OnetimePreflightSuccessTitle": "预跑成功 · 命中规模 12,340 人",
    "OnetimePreflightFailedTitle": "预跑失败：底表分区缺失",
}
OWNER = {}
for item, label, value in BASIC:
    OWNER[item + "Label"] = (item, "label")
    OWNER[item + "Text"] = (item, "children")
OWNER.update({"SourceItemLabel": ("SourceItem", "label"), "ExpireItemLabel": ("ExpireItem", "label"),
              "OnetimeFormatButtonText": ("OnetimeFormatButton", "children"),
              "OnetimeValidateButtonText": ("OnetimeValidateButton", "children"),
              "OnetimeCheckAlertTitle": ("OnetimeCheckAlert", "title"),
              "OnetimeHitCountTitle": ("OnetimeHitCount", "title"),
              "OnetimeHitCountSuffix": ("OnetimeHitCount", "suffix"),
              "OnetimeUidColumnTitle": ("OnetimeUidColumn", "title"),
              "OnetimeRegColumnTitle": ("OnetimeRegColumn", "title"),
              "OnetimeSourceColumnTitle": ("OnetimeSourceColumn", "title"),
              "OnetimeSubmitButtonText": ("OnetimeSubmitButton", "children"),
              "OnetimeSaveSqlButtonText": ("OnetimeSaveSqlButton", "children"),
              "OnetimeOnlineButtonText": ("OnetimeOnlineButton", "children"),
              "OnetimeCancelButtonText": ("OnetimeCancelButton", "children"),
              "OnetimePreflightRunningTitle": ("OnetimePreflightRunning", "title"),
              "OnetimePreflightSuccessTitle": ("OnetimePreflightSuccess", "title"),
              "OnetimePreflightFailedTitle": ("OnetimePreflightFailed", "title")})


def page():
    S = g.Src
    comps, nodes, copy = [], [], []
    comps.append({"nodeName": "AppShell", "component": "plasmic-overseas-app-shell", "role": "shell",
                  "purpose": "一次性客群建群页外壳：客群管理菜单与市场/App 上下文", "source": S(SRC_MENU),
                  "rule": "references/libraries/overseas/components/app-shell.md",
                  "props": {"productName": "海外客群管理平台", "menuItems": g.MENU,
                            "appSources": [{"value": "TACO", "label": "TACO"},
                                           {"value": "PESO", "label": "PESO"}],
                            "appSource": "{{ $state.appSource }}"}})
    nodes.append({"nodeName": "OnetimePage", "tag": "div", "owner": None,
                  "purpose": "一次性建群页根容器，承载应用外壳", "source": S(SRC_PAGE)})
    nodes.append({"nodeName": "OnetimeBody", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "一次性建群业务区纵向容器", "source": S(SRC_PAGE)})
    comps.append({"nodeName": "CreateSteps", "component": "plasmic-antd6-steps", "role": "workflow-progress",
                  "purpose": "建群五步流程进度", "source": S(SRC_STEPS),
                  "rule": "references/libraries/antd_v6/components/steps.md",
                  "props": {"current": 0, "size": "small",
                            "items": [{"title": "填写SQL校验"}, {"title": "提交自动预跑"}, {"title": "保存SQL"},
                                      {"title": "上线圈选"}, {"title": "启用生效"}]},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    for i, title in enumerate(["填写SQL校验", "提交自动预跑", "保存SQL", "上线圈选", "启用生效"]):
        copy.append({"nodeName": "CreateSteps", "at": "/props/items/%d/title" % i, "text": title,
                     "kind": "label", "role": "title", "copyTriage": "perceive-now",
                     "source": S(SRC_STEPS), "purpose": "标识建群流程步骤"})
    comps.append({"nodeName": "BasicInfoCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "一次性客群基本信息与有效期", "condition": "基本信息与有效期构成独立业务信息组",
                  "source": S(SRC_BASIC), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    comps.append({"nodeName": "BasicDescriptions", "component": "plasmic-antd6-descriptions",
                  "role": "read-only-group", "purpose": "弹窗带入的客群基本信息", "source": S(SRC_BASIC),
                  "rule": "references/libraries/antd_v6/components/descriptions.md",
                  "props": {"column": 3, "layout": "horizontal", "size": "medium"},
                  "owner": {"nodeName": "BasicInfoCard", "slot": "children"}})
    for node, label, value in BASIC:
        comps.append({"nodeName": node, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                      "purpose": label + "只读字段", "source": S(SRC_BASIC),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"key": node}, "owner": {"nodeName": "BasicDescriptions", "slot": "children"}})
    comps.append({"nodeName": "SourceForm", "component": "plasmic-antd6-form", "role": "submitted-form",
                  "purpose": "客群来源与有效期提交", "source": S(SRC_SOURCE),
                  "rule": "references/libraries/antd_v6/components/form.md",
                  "props": {"mode": "advanced", "layout": "horizontal", "labelCol": {"flex": "96px"},
                            "formItems": [], "initialValues": {"source": "SQL", "expireDays": 14}},
                  "owner": {"nodeName": "BasicInfoCard", "slot": "children"}})
    nodes.append({"nodeName": "SourceRow", "tag": "div", "owner": {"nodeName": "SourceForm", "slot": "children"},
                  "purpose": "来源与有效期字段行", "source": S(SRC_SOURCE)})
    comps.append({"nodeName": "SourceItem", "component": "plasmic-antd6-form-item", "role": "widget",
                  "purpose": "客群来源字段", "source": S(SRC_SOURCE),
                  "rule": "references/libraries/antd_v6/components/form.md",
                  "props": {"name": "source"}, "owner": {"nodeName": "SourceForm", "slot": "children"}})
    comps.append({"nodeName": "SourceRadio", "component": "plasmic-antd6-radio-group", "role": "field-choice",
                  "purpose": "唯一来源写SQL", "source": S(SRC_SOURCE),
                  "rule": "references/libraries/antd_v6/components/radio.md",
                  "props": {"options": [{"value": "SQL", "label": "写SQL"}]},
                  "owner": {"nodeName": "SourceItem", "slot": "children"}})
    comps.append({"nodeName": "ExpireItem", "component": "plasmic-antd6-form-item", "role": "widget",
                  "purpose": "有效期天数", "source": S(SRC_EXPIRE),
                  "rule": "references/libraries/antd_v6/components/form.md",
                  "props": {"name": "expireDays",
                            "rules": [{"ruleType": "required", "message": "请输入有效期天数"}]},
                  "owner": {"nodeName": "SourceForm", "slot": "children"}})
    comps.append({"nodeName": "ExpireInput", "component": "plasmic-antd6-input-number", "role": "widget",
                  "purpose": "有效期天数取值", "source": S(SRC_EXPIRE),
                  "rule": "references/libraries/antd_v6/components/input-number.md",
                  "props": {"min": 1, "max": 365}, "owner": {"nodeName": "ExpireItem", "slot": "children"}})
    copy += [
        {"nodeName": "SourceRadio", "at": "/props/options/0/label", "text": "写SQL", "kind": "value",
         "role": "value", "copyTriage": "perceive-now", "source": S(SRC_SOURCE), "purpose": "展示唯一来源"},
        {"nodeName": "ExpireItem", "at": "/props/rules/0/message", "text": "请输入有效期天数",
         "kind": "warning", "role": "hint", "copyTriage": "perceive-now", "source": S(SRC_EXPIRE),
         "purpose": "有效期为空时的原生校验提示"},
    ]
    comps.append({"nodeName": "OnetimeSqlCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "SQL 编辑、校验与预跑样本", "condition": "SQL 编辑与校验结果构成同一业务操作面",
                  "source": S(SRC_HEAD), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "OnetimeSqlActions", "tag": "div",
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "extra"},
                  "purpose": "SQL 卡头操作组", "source": S(SRC_HEAD)})
    nodes.append({"nodeName": "OnetimeSqlBody", "tag": "div",
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "children"},
                  "purpose": "SQL 编辑与样本纵向容器", "source": S(SRC_HEAD)})
    for name, label in (("OnetimeFormatButton", "格式化"), ("OnetimeValidateButton", "校验")):
        comps.append({"nodeName": name, "component": "plasmic-antd6-button", "role": "widget",
                      "purpose": label + "SQL", "source": S(SRC_HEAD),
                      "rule": "references/libraries/antd_v6/components/button.md",
                      "props": {"type": "default", "iconPlacement": "start"},
                      "owner": {"nodeName": "OnetimeSqlCard", "slot": "extra"}})
    comps.append({"nodeName": "OnetimeSqlEditor", "component": "plasmic-antd6-textarea", "role": "widget",
                  "purpose": "SQL 语句编辑", "source": S(SRC_SQL),
                  "rule": "references/libraries/antd_v6/components/input.md",
                  "props": {"value": "{{ $state.sqlText }}", "placeholder": "请输入只读 SELECT 语句"},
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "children"}})
    comps.append({"nodeName": "OnetimeCheckAlert", "component": "plasmic-antd6-alert",
                  "role": "persistent-feedback", "purpose": "SQL 校验通过状态条",
                  "condition": "校验通过与待校验是持续存在的校验状态", "source": S(SRC_STATE),
                  "rule": "references/libraries/antd_v6/components/alert.md",
                  "props": {"type": "success", "showIcon": True},
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "children"}})
    comps.append({"nodeName": "OnetimeHitCount", "component": "plasmic-antd6-statistic", "role": "widget",
                  "purpose": "预跑命中规模", "source": S(SRC_PREVIEW),
                  "rule": "references/libraries/antd_v6/components/statistic.md",
                  "props": {"value": "{{ $state.hitCount }}"},
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "children"}})
    comps.append({"nodeName": "OnetimePreviewTable", "component": "plasmic-antd6-table", "role": "pagination",
                  "purpose": "预跑样本 Top100（SQL 全部字段，脱敏）", "source": S(SRC_PREVIEW),
                  "rule": "references/libraries/antd_v6/components/table.md",
                  "props": {"data": "{{ ({data: $state.sampleRows.filter(r => r.appSource===$state.appSource)}) }}",
                            "rowKey": "id", "size": "large",
                            "pagination": {"defaultPageSize": 10, "pageSizeOptions": [10, 20, 50],
                                           "showSizeChanger": True,
                                           "showTotal": "{{ (total, range) => `共 ${total} 条` }}"},
                            "scroll": {"x": 760}},
                  "owner": {"nodeName": "OnetimeSqlCard", "slot": "children"}})
    for name, title, idx, width in (("OnetimeUidColumn", "UID", "id", None),
                                    ("OnetimeRegColumn", "注册时间", "registerDate", 168),
                                    ("OnetimeSourceColumn", "App来源", "appSource", 112)):
        p = {"dataIndex": idx, "displayType": "text", "width": width}
        if not width:
            p["ellipsis"] = True
        comps.append({"nodeName": name, "component": "plasmic-antd6-table-column", "role": "widget",
                      "purpose": title + "列", "source": S(SRC_PREVIEW),
                      "rule": "references/libraries/antd_v6/components/table.md",
                      "props": p, "owner": {"nodeName": "OnetimePreviewTable", "slot": "children"}})
    nodes.append({"nodeName": "OnetimeFooter", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "建群底部操作行", "source": S(SRC_SUBMIT)})
    for name, label, kind in (("OnetimeSubmitButton", "提交", "primary"),
                              ("OnetimeSaveSqlButton", "保存 SQL", "default"),
                              ("OnetimeOnlineButton", "上线", "default"),
                              ("OnetimeCancelButton", "取消", "default")):
        comps.append({"nodeName": name, "component": "plasmic-antd6-button", "role": "widget",
                      "purpose": label + "操作", "source": S(SRC_SUBMIT),
                      "rule": "references/libraries/antd_v6/components/button.md",
                      "props": {"type": kind, "iconPlacement": "start"},
                      "owner": {"nodeName": "AppShell", "slot": "children"}})
    comps.append({"nodeName": "OnetimePreflightModal", "component": "plasmic-antd6-modal",
                  "role": "overlay-information", "purpose": "预跑三态提示", "source": S(SRC_SUBMIT),
                  "rule": "references/libraries/antd_v6/compositions/modal-drawer.md",
                  "props": {"open": "{{ $state.preflightOpen }}", "width": "640"},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "OnetimePreflightTitle", "tag": "span",
                  "owner": {"nodeName": "OnetimePreflightModal", "slot": "title"},
                  "purpose": "预跑弹窗标题", "source": S(SRC_SUBMIT)})
    copy.append({"nodeName": "OnetimeSqlEditor", "at": "/props/value", "text": "{{ $state.sqlText }}",
                 "kind": "value", "role": "value", "copyTriage": "perceive-now", "source": S(SRC_SQL),
                 "purpose": "编辑器显示当前 SQL 文本"})
    copy.append({"nodeName": "OnetimeSqlEditor", "at": "/props/placeholder", "text": "请输入只读 SELECT 语句",
                 "kind": "placeholder", "role": "placeholder", "copyTriage": "perceive-now",
                 "source": S(SRC_SQL), "purpose": "提示只读 SELECT 输入"})
    copy.append({"nodeName": "OnetimeHitCount", "at": "/props/value", "text": "{{ $state.hitCount }}",
                 "kind": "value", "role": "value", "copyTriage": "perceive-now", "source": S(SRC_PREVIEW),
                 "purpose": "展示预跑命中的客群规模"})
    copy.append({"nodeName": "OnetimePreflightTitle", "at": "/text", "text": "预跑结果", "kind": "label",
                 "role": "title", "copyTriage": "perceive-now", "source": S(SRC_SUBMIT),
                 "purpose": "说明弹窗用途"})
    for name, typ in (("OnetimePreflightRunning", "info"), ("OnetimePreflightSuccess", "success"),
                      ("OnetimePreflightFailed", "error")):
        comps.append({"nodeName": name, "component": "plasmic-antd6-alert", "role": "persistent-feedback",
                      "purpose": "预跑状态提示", "condition": "预跑进行中/成功/失败是持续存在的任务状态",
                      "source": S(SRC_SUBMIT), "rule": "references/libraries/antd_v6/components/alert.md",
                      "props": {"type": typ, "showIcon": True},
                      "owner": {"nodeName": "OnetimePreflightModal", "slot": "children"}})
    for label, at, purpose in g.menu_copy_items():
        copy.append({"nodeName": "AppShell", "at": at, "text": label, "kind": "label", "role": "title",
                     "copyTriage": "perceive-now", "source": S(SRC_MENU), "purpose": purpose})
    nodes.append({"nodeName": "BasicInfoGap", "tag": "div",
                  "owner": {"nodeName": "BasicInfoCard", "slot": "children"},
                  "purpose": "基本信息与来源表单之间的间距", "source": S(SRC_BASIC)})
    declared = {n["nodeName"] for n in nodes}
    copied = {e["nodeName"] for e in copy}
    for _n, _t in (("OnetimeFormatButtonText", "格式化"), ("OnetimeValidateButtonText", "校验"),
                   ("OnetimeSubmitButtonText", "提交"), ("OnetimeSaveSqlButtonText", "保存 SQL"),
                   ("OnetimeOnlineButtonText", "上线"), ("OnetimeCancelButtonText", "取消")):
        owned = OWNER[_n]
        nodes.append({"nodeName": _n, "tag": "span", "owner": {"nodeName": owned[0], "slot": owned[1]},
                      "purpose": _t + "按钮文字", "source": S(SRC_SUBMIT)})
        declared.add(_n)
        copy.append({"nodeName": _n, "at": "/text", "text": _t, "kind": "action", "role": "button",
                     "copyTriage": "perceive-now", "source": S(SRC_SUBMIT), "purpose": _t + "操作"})
        copied.add(_n)
    for node, text in TEXTS.items():
        owner, slot = OWNER[node]
        if node not in declared:
            nodes.append({"nodeName": node, "tag": "span", "owner": {"nodeName": owner, "slot": slot},
                          "purpose": text + "文字", "source": S(SRC_BASIC)})
            declared.add(node)
        if node in copied:
            continue
        suffix = node[len(owner):] if node.startswith(owner) else "Text"
        role = {"Label": "fieldLabel", "Text": "value", "Title": "hint", "Suffix": "other"}.get(suffix, "other")
        if suffix == "Title" and node.endswith("ButtonText"):
            role = "button"
        copy.append({"nodeName": node, "at": "/text", "text": text, "kind": "label", "role": role,
                     "copyTriage": "perceive-now", "source": S(SRC_BASIC), "purpose": "标识" + text})
    page = {"path": "/groups/onetime-create", "name": "新建一次性客群", "recordPage": False,
            "routePattern": "/groups/onetime-create", "params": [], "modes": [],
            "source": S(SRC_PAGE), "pageHeader": None, "templates": [],
            "templatesNotApplicable": "The staged SQL creation flow (Steps + read-only basics + SQL/预跑) matches no catalog composition; BasicFormPage has no Steps or SQL editor, so the page composes registered Steps/Descriptions/Form/Card instead.",
            "components": comps, "nodes": nodes,
            "copy": {"source": S(SRC_PAGE), "excluded": [], "entries": copy},
            "bindings": [
                {"nodeName": "SourceForm", "source": S(SRC_SOURCE), "events": ["onFinish"]},
                {"nodeName": "OnetimeSqlEditor", "source": S(SRC_SQL), "props": ["value"],
                 "dynamicProps": ["value"], "events": ["onChange"]},
                {"nodeName": "OnetimePreviewTable", "source": S(SRC_PREVIEW), "props": ["data"],
                 "dynamicProps": ["data"], "propStateDependencies": {"data": ["sampleRows", "appSource"]}},
                {"nodeName": "AppShell", "source": S(SRC_MENU), "props": ["appSource"],
                 "dynamicProps": ["appSource"], "events": ["onAppSourceChange"]},
            ],
            "feedback": [
                {"nodeName": "OnetimeValidateButton", "event": "onClick", "kind": "transient",
                 "source": S(SRC_HEAD), "success": "校验通过后出现一次成功提示",
                 "failure": "校验失败时出现错误提示并保留可修正的 SQL"},
                {"nodeName": "OnetimeSubmitButton", "event": "onClick", "kind": "transient",
                 "source": S(SRC_SUBMIT), "success": "预跑弹窗打开并显示进行中状态，同时出现一次成功提示",
                 "failure": "预跑失败时弹窗展示失败原因"},
            ],
            "runtimeCases": [
                {"id": "onetime-page-change-1", "kind": "page-change", "nodeName": "OnetimePreviewTable",
                 "given": {"current": 1, "pageSize": 10, "sequence": 1},
                 "checks": [{"kind": "count", "role": "row", "count": 11}], "evidence": g.Ev(SRC_PREVIEW)},
                {"id": "onetime-page-size-1", "kind": "page-size", "nodeName": "OnetimePreviewTable",
                 "given": {"current": 1, "pageSize": 20},
                 "checks": [{"kind": "count", "role": "row", "count": 13}], "evidence": g.Ev(SRC_PREVIEW)},
            ],
            "actionContracts": [],
            "appContext": {"required": True,
                           "evidence": g.Ev("`app_source` 由 **App 入口跳转带入**（进入客群平台时的 App 上下文），页面无 App 来源选项。"),
                           "shell": "AppShell", "binding": "$state.appSource",
                           "consumers": [{"nodeName": "OnetimePreviewTable", "property": "data", "kind": "data"}],
                           "cases": [{"id": "app-switch-onetime", "kind": "app-switch", "nodeName": "AppShell",
                                      "given": {"appSource": "PESO"},
                                      "checks": [{"kind": "text", "text": "PESO", "present": True}]},
                                     {"id": "context-data-onetime", "kind": "context-data",
                                      "nodeName": "OnetimePreviewTable", "given": {"appSource": "TACO"},
                                      "checks": [{"kind": "count", "role": "row", "count": 11}]}]}}
    return page
