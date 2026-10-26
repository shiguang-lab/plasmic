"""Reviewed declarations for /groups/selector (page 2)."""
import hashlib, json, sys
sys.path.insert(0, '.')
import gen_plan as g

PROJ_ANTD = "eYLujTHmWfX9qEoQaFDSi4"
PROJ_OVER = "f3f4ju424PVNTAQPkwovrE"
PROJ_ICON = "vuoraLeLbtw7rQTKJ6UKar"

SRC_PAGE = "**页面用途**：常规客群首选 **SQL 模式**"
SRC_SAVE = "「**数据保存天数**」——**下拉选择**"
SRC_DEAD = "「**产出截止时间**」——运营填写**每日截止时刻（时分秒）**"
SRC_HEAD = "卡头: [格式化] [校验]"
SRC_SQL = "**SQL 模式**：输入自定义 SQL"
SRC_CHECK = "校验规则: 语句合法性/底表(限dwt-cdm)/权限/结果含uid+app_source"
SRC_STATE = "状态条: ✓ 校验通过 · 结果集含 uid + app_source"
SRC_PREVIEW = "展示 SQL 运行结果前 100 条、SQL 全部字段（脱敏）"
SRC_SUBMIT = "**预跑成功后才可保存 SQL / 上线**"
SRC_RUN = "**预跑成功后才可保存 SQL / 上线**"

TEXTS = {
    "NameItemLabel": "客群名称", "RetentionItemLabel": "数据保存天数", "DeadlineItemLabel": "产出截止时间",
    "RefreshItemLabel": "刷新模式", "TypeItemLabel": "客群类型",
    "FormatButtonText": "格式化", "ValidateButtonText": "校验",
    "CheckAlertTitle": "校验通过",
    "CheckSyntaxItemLabel": "语句合法性", "CheckSyntaxItemText": "仅 SELECT",
    "CheckSourceItemLabel": "底表", "CheckSourceItemText": "dwt/cdm",
    "CheckRoleItemLabel": "权限", "CheckRoleItemText": "运营及以上",
    "CheckColumnItemLabel": "结果字段", "CheckColumnItemText": "uid+app_source",
    "CheckFilterItemLabel": "结尾过滤", "CheckFilterItemText": "app_source",
    "HitCountStatisticTitle": "命中规模", "HitCountStatisticSuffix": "人",
    "SampleUidColumnTitle": "UID", "SampleRegColumnTitle": "注册时间",
    "SampleSourceColumnTitle": "App来源", "SampleCreditColumnTitle": "授信状态",
    "SampleLoanColumnTitle": "借据状态",
    "SubmitButtonText": "提交", "SaveSqlButtonText": "保存 SQL",
    "OnlineButtonText": "上线", "CancelButtonText": "取消",
    "PreflightRunningTitle": "预跑进行中，请稍候",
    "PreflightSuccessAlertTitle": "预跑成功 · 命中规模 12,340 人",
    "PreflightFailedAlertTitle": "预跑失败：底表分区缺失",
}
LABEL_OWNER = {
    "NameItemLabel": ("NameItem", "label"), "RetentionItemLabel": ("RetentionItem", "label"),
    "DeadlineItemLabel": ("DeadlineItem", "label"), "RefreshItemLabel": ("RefreshItem", "label"),
    "TypeItemLabel": ("TypeItem", "label"),
    "FormatButtonText": ("FormatButton", "children"), "ValidateButtonText": ("ValidateButton", "children"),
    "CheckAlertTitle": ("CheckAlert", "title"),
    "CheckSyntaxItemLabel": ("CheckSyntaxItem", "label"), "CheckSyntaxItemText": ("CheckSyntaxItem", "children"),
    "CheckSourceItemLabel": ("CheckSourceItem", "label"), "CheckSourceItemText": ("CheckSourceItem", "children"),
    "CheckRoleItemLabel": ("CheckRoleItem", "label"), "CheckRoleItemText": ("CheckRoleItem", "children"),
    "CheckColumnItemLabel": ("CheckColumnItem", "label"), "CheckColumnItemText": ("CheckColumnItem", "children"),
    "CheckFilterItemLabel": ("CheckFilterItem", "label"), "CheckFilterItemText": ("CheckFilterItem", "children"),
    "HitCountStatisticTitle": ("HitCountStatistic", "title"), "HitCountStatisticSuffix": ("HitCountStatistic", "suffix"),
    "SampleUidColumnTitle": ("SampleUidColumn", "title"), "SampleRegColumnTitle": ("SampleRegColumn", "title"),
    "SampleSourceColumnTitle": ("SampleSourceColumn", "title"),
    "SampleCreditColumnTitle": ("SampleCreditColumn", "title"),
    "SampleLoanColumnTitle": ("SampleLoanColumn", "title"),
    "SubmitButtonText": ("SubmitButton", "children"), "SaveSqlButtonText": ("SaveSqlButton", "children"),
    "OnlineButtonText": ("OnlineButton", "children"), "CancelButtonText": ("CancelButton", "children"),
    "PreflightRunningTitle": ("PreflightRunning", "title"),
    "PreflightSuccessAlertTitle": ("PreflightSuccessAlert", "title"),
    "PreflightFailedAlertTitle": ("PreflightFailedAlert", "title"),
}
COPY_ROLE = {"Label": "fieldLabel", "Text": "button", "Title": "title", "Suffix": "other"}


def page():
    S = g.Src
    comps, nodes, copy = [], [], []
    comps.append({"nodeName": "AppShell", "component": "plasmic-overseas-app-shell", "role": "shell",
                  "purpose": "客群圈选器外壳：客群管理菜单与市场/App 上下文",
                  "source": S("顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"),
                  "rule": "references/libraries/overseas/components/app-shell.md",
                  "props": {"productName": "海外客群管理平台", "menuItems": g.MENU,
                            "appSources": [{"value": "TACO", "label": "TACO"},
                                           {"value": "PESO", "label": "PESO"}],
                            "appSource": "{{ $state.appSource }}"}})
    nodes.append({"nodeName": "SelectorPage", "tag": "div", "owner": None,
                  "purpose": "圈选器页根容器，承载应用外壳", "source": S(SRC_PAGE)})
    nodes.append({"nodeName": "SelectorBody", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "圈选器业务区纵向容器", "source": S(SRC_PAGE)})
    comps.append({"nodeName": "BasicInfoCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "客群基本信息与数据保留设置", "condition": "基本信息表单自成一组业务信息",
                  "source": S(SRC_SAVE), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    comps.append({"nodeName": "BasicForm", "component": "plasmic-antd6-form", "role": "submitted-form",
                  "purpose": "客群名称、数据保存天数与产出截止时间提交", "source": S(SRC_DEAD),
                  "rule": "references/libraries/antd_v6/components/form.md",
                  "props": {"mode": "advanced", "layout": "horizontal", "labelCol": {"flex": "120px"},
                            "formItems": [],
                            "initialValues": {"name": "", "retentionDays": "3",
                                              "produceDeadline": "2026-08-19T18:00:00",
                                              "refreshMode": "DYNAMIC", "groupType": "常规"}},
                  "owner": {"nodeName": "BasicInfoCard", "slot": "children"}})
    for row in ("BasicRowMain", "BasicRowMode"):
        nodes.append({"nodeName": row, "tag": "div", "owner": {"nodeName": "BasicForm", "slot": "children"},
                      "purpose": "基本信息字段行", "source": S(SRC_SAVE)})
    fields = [("NameItem", "name", "客群名称", "NameInput",
               {"placeholder": "请输入客群名称"}, [{"ruleType": "required", "message": "请输入客群名称"}],
               "①客群名称（中文，必填）"),
              ("RetentionItem", "retentionDays", "数据保存天数", "RetentionSelect",
               {"options": [{"value": "3", "label": "3 天"}, {"value": "7", "label": "7 天"},
                            {"value": "30", "label": "30 天"}, {"value": "60", "label": "60 天"},
                            {"value": "180", "label": "180 天"}, {"value": "0", "label": "长期"}]}, [],
               SRC_SAVE),
              ("DeadlineItem", "produceDeadline", "产出截止时间", "DeadlineTime",
               {"format": "HH:mm:ss"},
               [{"ruleType": "required", "message": "请选择产出截止时间"}], SRC_DEAD),
              ("RefreshItem", "refreshMode", "刷新模式", "RefreshSelect",
               {"options": [{"value": "DYNAMIC", "label": "T+1 动态"}]}, [], "刷新模式▾"),
              ("TypeItem", "groupType", "客群类型", "TypeInput",
               {"readOnly": True, "disabled": True}, [], "类型▾(常规)")]
    for item, key, label, ctl, props, rules, quote in fields:
        comps.append({"nodeName": item, "component": "plasmic-antd6-form-item", "role": "widget",
                      "purpose": label + "字段", "source": S(quote),
                      "rule": "references/libraries/antd_v6/components/form.md",
                      "props": {"name": key, "rules": rules} if rules else {"name": key},
                      "owner": {"nodeName": "BasicForm", "slot": "children"}})
        reg = {"NameInput": "plasmic-antd6-input", "RetentionSelect": "plasmic-antd6-select",
               "DeadlineTime": "plasmic-antd6-time-picker", "RefreshSelect": "plasmic-antd6-select",
               "TypeInput": "plasmic-antd6-input"}[ctl]
        role = {"NameInput": "widget", "RetentionSelect": "field-choice", "DeadlineTime": "widget",
                "RefreshSelect": "field-choice", "TypeInput": "widget"}[ctl]
        rule_doc = {"plasmic-antd6-input": "input", "plasmic-antd6-select": "select",
                    "plasmic-antd6-time-picker": "time-picker"}[reg]
        comps.append({"nodeName": ctl, "component": reg, "role": role, "purpose": label + "取值",
                      "source": S(quote),
                      "rule": "references/libraries/antd_v6/components/%s.md" % rule_doc,
                      "props": props, "owner": {"nodeName": item, "slot": "children"}})
        copy.append({"nodeName": item + "Label", "at": "/text", "text": label, "kind": "label",
                     "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(quote),
                     "purpose": "标识该字段"})
        if reg == "plasmic-antd6-input" and "placeholder" in props:
            copy.append({"nodeName": ctl, "at": "/props/placeholder", "text": props["placeholder"],
                         "kind": "placeholder", "role": "placeholder", "copyTriage": "perceive-now",
                         "source": S(quote), "purpose": "提示输入方式"})
        for i, o in enumerate(props.get("options") or []):
            copy.append({"nodeName": ctl, "at": "/props/options/%d/label" % i, "text": o["label"],
                         "kind": "value", "role": "value", "copyTriage": "perceive-now",
                         "source": S(quote), "purpose": label + "可选值"})
    # SQL card
    comps.append({"nodeName": "SqlCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "SQL 编辑、校验结果与预跑样本", "condition": "SQL 编辑与校验结果构成同一业务操作面",
                  "source": S(SRC_HEAD), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "SqlCardActions", "tag": "div", "owner": {"nodeName": "SqlCard", "slot": "extra"},
                  "purpose": "SQL 卡头操作组", "source": S(SRC_HEAD)})
    nodes.append({"nodeName": "SqlCardBody", "tag": "div", "owner": {"nodeName": "SqlCard", "slot": "children"},
                  "purpose": "SQL 编辑、校验与预跑纵向容器", "source": S(SRC_HEAD)})
    for name, label in (("FormatButton", "格式化"), ("ValidateButton", "校验")):
        comps.append({"nodeName": name, "component": "plasmic-antd6-button", "role": "widget",
                      "purpose": label + "SQL", "source": S(SRC_HEAD),
                      "rule": "references/libraries/antd_v6/components/button.md",
                      "props": {"type": "default", "iconPlacement": "start"},
                      "owner": {"nodeName": "SqlCard", "slot": "extra"}})
        copy.append({"nodeName": name + "Text", "at": "/text", "text": label, "kind": "action",
                     "role": "button", "copyTriage": "perceive-now", "source": S(SRC_HEAD),
                     "purpose": label + "SQL 文本"})
    comps.append({"nodeName": "SqlEditor", "component": "plasmic-antd6-textarea", "role": "widget",
                  "purpose": "SQL 语句编辑", "source": S(SRC_SQL),
                  "rule": "references/libraries/antd_v6/components/input.md",
                  "props": {"value": "{{ $state.sqlText }}", "placeholder": "请输入只读 SELECT 语句"},
                  "owner": {"nodeName": "SqlCard", "slot": "children"}})
    comps.append({"nodeName": "CheckAlert", "component": "plasmic-antd6-alert", "role": "persistent-feedback",
                  "purpose": "SQL 校验通过状态条", "condition": "校验通过与待校验是持续存在的校验状态",
                  "source": S(SRC_STATE), "rule": "references/libraries/antd_v6/components/alert.md",
                  "props": {"type": "success", "showIcon": True},
                  "owner": {"nodeName": "SqlCard", "slot": "children"}})
    copy.append({"nodeName": "CheckAlertTitle", "at": "/text", "text": TEXTS["CheckAlertTitle"],
                 "kind": "feedback", "role": "hint", "copyTriage": "perceive-now",
                 "source": S(SRC_STATE), "purpose": "告知校验已通过"})
    comps.append({"nodeName": "CheckDescriptions", "component": "plasmic-antd6-descriptions",
                  "role": "read-only-group", "purpose": "六项校验结果", "source": S(SRC_CHECK),
                  "rule": "references/libraries/antd_v6/components/descriptions.md",
                  "props": {"column": 1, "layout": "horizontal", "size": "medium", "bordered": False},
                  "owner": {"nodeName": "SqlCard", "slot": "children"}})
    for item, label, _ in g.CHECKS_LOCAL if hasattr(g, "CHECKS_LOCAL") else [
            ("CheckSyntaxItem", "语句合法性", ""), ("CheckSourceItem", "底表", ""),
            ("CheckRoleItem", "权限", ""), ("CheckColumnItem", "结果字段", ""),
            ("CheckFilterItem", "结尾过滤", "")]:
        comps.append({"nodeName": item, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                      "purpose": label + "校验项", "source": S(SRC_CHECK),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"key": item}, "owner": {"nodeName": "CheckDescriptions", "slot": "children"}})
    comps.append({"nodeName": "HitCountStatistic", "component": "plasmic-antd6-statistic", "role": "widget",
                  "purpose": "预跑命中规模", "source": S(SRC_PREVIEW),
                  "rule": "references/libraries/antd_v6/components/statistic.md",
                  "props": {"value": "{{ $state.hitCount }}"},
                  "owner": {"nodeName": "SqlCard", "slot": "children"}})
    comps.append({"nodeName": "PreviewTable", "component": "plasmic-antd6-table", "role": "pagination",
                  "purpose": "预跑样本 Top100（SQL 全部字段，脱敏）", "source": S(SRC_PREVIEW),
                  "rule": "references/libraries/antd_v6/components/table.md",
                  "props": {"data": "{{ ({data: $state.sampleRows.filter(r => r.appSource===$state.appSource)}) }}",
                            "rowKey": "id", "size": "large",
                            "pagination": {"defaultPageSize": 10, "pageSizeOptions": [10, 20, 50],
                                           "showSizeChanger": True,
                                           "showTotal": "{{ (total, range) => `共 ${total} 条` }}"},
                            "scroll": {"x": 900}},
                  "owner": {"nodeName": "SqlCard", "slot": "children"}})
    cols = [("SampleUidColumn", "UID", "id", None, "text"),
            ("SampleRegColumn", "注册时间", "registerDate", 168, "text"),
            ("SampleSourceColumn", "App来源", "appSource", 112, "text"),
            ("SampleCreditColumn", "授信状态", "creditStatus", 120, "status"),
            ("SampleLoanColumn", "借据状态", "loanStatus", 120, "status")]
    mapper = {"SampleCreditColumn": ("SampleCreditBadge", "creditStatus",
                                     ["success", "error", "processing"], ["已授信", "已拒绝", "审批中"]),
              "SampleLoanColumn": ("SampleLoanBadge", "loanStatus",
                                   ["default", "processing", "error"], ["结清", "在贷", "逾期"])}
    for name, title, idx, width, kind in cols:
        p = {"dataIndex": idx, "displayType": "custom" if kind == "status" else "text"}
        p["width"] = width
        if not width:
            p["ellipsis"] = True
        c = {"nodeName": name, "component": "plasmic-antd6-table-column",
             "role": "status" if kind == "status" else "widget", "purpose": title + "列",
             "source": S(SRC_PREVIEW),
             "rule": "references/libraries/antd_v6/components/%s.md" % ("badge" if kind == "status" else "table"),
             "props": p, "owner": {"nodeName": "PreviewTable", "slot": "children"}}
        if kind == "status":
            badge, key, statuses, labels = mapper[name]
            c["statusMap"] = {l: {"status": s, "label": l} for l, s in zip(labels, statuses)}
            comps.append(c)
            comps.append({"nodeName": badge, "component": "plasmic-antd6-badge", "role": "status",
                          "purpose": title + "语义色", "source": S(SRC_PREVIEW),
                          "rule": "references/libraries/antd_v6/components/badge.md",
                          "props": {"status": "{{ [`%s`][[`%s`].indexOf(row.%s)] }}"
                                              % ("`,`".join(statuses), "`,`".join(labels), key),
                                    "text": "{{ row.%s }}" % key},
                          "dynamicProps": ["status", "text"],
                          "owner": {"nodeName": name, "slot": "render"}})
        else:
            comps.append(c)
    # footer
    nodes.append({"nodeName": "SelectorFooter", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "圈选器底部操作行", "source": S(SRC_SUBMIT)})
    for name, label, kind in (("SubmitButton", "提交", "primary"), ("SaveSqlButton", "保存 SQL", "default"),
                              ("OnlineButton", "上线", "default"), ("CancelButton", "取消", "default")):
        comps.append({"nodeName": name, "component": "plasmic-antd6-button", "role": "widget",
                      "purpose": label + "操作", "source": S(SRC_SUBMIT),
                      "rule": "references/libraries/antd_v6/components/button.md",
                      "props": {"type": kind, "iconPlacement": "start"},
                      "owner": {"nodeName": "AppShell", "slot": "children"}})
        copy.append({"nodeName": name + "Text", "at": "/text", "text": label, "kind": "action",
                     "role": "button", "copyTriage": "perceive-now", "source": S(SRC_SUBMIT),
                     "purpose": label + "客群"})
    # preflight overlay
    comps.append({"nodeName": "PreflightModal", "component": "plasmic-antd6-modal",
                  "role": "overlay-information", "purpose": "预跑三态提示", "source": S(SRC_RUN),
                  "rule": "references/libraries/antd_v6/compositions/modal-drawer.md",
                  "props": {"open": "{{ $state.preflightOpen }}", "width": "640"},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "PreflightTitle", "tag": "span",
                  "owner": {"nodeName": "PreflightModal", "slot": "title"},
                  "purpose": "预跑弹窗标题", "source": S(SRC_RUN)})
    copy.append({"nodeName": "PreflightTitle", "at": "/text", "text": "预跑结果", "kind": "label",
                 "role": "title", "copyTriage": "perceive-now", "source": S(SRC_RUN),
                 "purpose": "说明弹窗用途"})
    for name, typ, text in (("PreflightRunning", "info", TEXTS["PreflightRunningTitle"]),
                            ("PreflightSuccessAlert", "success", TEXTS["PreflightSuccessAlertTitle"]),
                            ("PreflightFailedAlert", "error", TEXTS["PreflightFailedAlertTitle"])):
        comps.append({"nodeName": name, "component": "plasmic-antd6-alert", "role": "persistent-feedback",
                      "purpose": "预跑状态提示", "condition": "预跑进行中/成功/失败是持续存在的任务状态",
                      "source": S(SRC_RUN), "rule": "references/libraries/antd_v6/components/alert.md",
                      "props": {"type": typ, "showIcon": True},
                      "owner": {"nodeName": "PreflightModal", "slot": "children"}})
        copy.append({"nodeName": name + "Title", "at": "/text", "text": text, "kind": "feedback",
                     "role": "hint", "copyTriage": "perceive-now", "source": S(SRC_RUN),
                     "purpose": "告知当前预跑状态"})
    for label, at, purpose in g.menu_copy_items():
        copy.append({"nodeName": "AppShell", "at": at, "text": label, "kind": "label", "role": "title",
                     "copyTriage": "perceive-now",
                     "source": S("顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"),
                     "purpose": purpose})
    # every named text node: declare it, then review its copy once
    declared = {n["nodeName"] for n in nodes}
    copied = {e["nodeName"] for e in copy}
    for node, text in TEXTS.items():
        owner, slot = LABEL_OWNER[node]
        if node not in declared:
            nodes.append({"nodeName": node, "tag": "span", "owner": {"nodeName": owner, "slot": slot},
                          "purpose": text + "文字", "source": S(SRC_CHECK)})
            declared.add(node)
        if node in copied:
            continue
        suffix = node[len(owner):] if node.startswith(owner) else "Text"
        role = "value" if suffix == "Text" else COPY_ROLE.get(suffix, "other")
        copy.append({"nodeName": node, "at": "/text", "text": text, "kind": "label",
                     "role": role, "copyTriage": "perceive-now",
                     "source": S(SRC_CHECK), "purpose": "标识" + text})
    copy += [
        {"nodeName": "NameItem", "at": "/props/rules/0/message", "text": "请输入客群名称",
         "kind": "warning", "role": "hint", "copyTriage": "perceive-now",
         "source": S("①客群名称（中文，必填）"), "purpose": "名称为空时的原生校验提示"},
        {"nodeName": "DeadlineItem", "at": "/props/rules/0/message", "text": "请选择产出截止时间",
         "kind": "warning", "role": "hint", "copyTriage": "perceive-now",
         "source": S(SRC_DEAD), "purpose": "截止时间为空时的原生校验提示"},
        {"nodeName": "SqlEditor", "at": "/props/value", "text": "{{ $state.sqlText }}",
         "kind": "value", "role": "value", "copyTriage": "perceive-now",
         "source": S(SRC_SQL), "purpose": "编辑器显示当前 SQL 文本"},
        {"nodeName": "SqlEditor", "at": "/props/placeholder", "text": "请输入只读 SELECT 语句",
         "kind": "placeholder", "role": "placeholder", "copyTriage": "perceive-now",
         "source": S(SRC_SQL), "purpose": "提示只读 SELECT 输入"},
        {"nodeName": "HitCountStatistic", "at": "/props/value", "text": "{{ $state.hitCount }}",
         "kind": "value", "role": "value", "copyTriage": "perceive-now",
         "source": S(SRC_PREVIEW), "purpose": "展示预跑命中的客群规模"},
        {"nodeName": "SampleCreditBadge", "at": "/props/text", "text": "{{ row.creditStatus }}",
         "kind": "value", "role": "value", "copyTriage": "perceive-now",
         "source": S(SRC_PREVIEW), "purpose": "逐行展示授信状态"},
        {"nodeName": "SampleLoanBadge", "at": "/props/text", "text": "{{ row.loanStatus }}",
         "kind": "value", "role": "value", "copyTriage": "perceive-now",
         "source": S(SRC_PREVIEW), "purpose": "逐行展示借据状态"},
    ]
    page = {"path": "/groups/selector", "name": "客群圈选器", "recordPage": False,
            "routePattern": "/groups/selector", "params": [], "modes": [],
            "source": S(SRC_PAGE), "pageHeader": None, "templates": [],
            "templatesNotApplicable": "Splits the SQL workflow into a basic-information Card and an SQL/校验 Card on one page; the catalog sections cover list, tabbed list, catalog tabs, detail and form pages only, so this staged SQL composition is not one of them.",
            "components": comps, "nodes": nodes,
            "copy": {"source": S(SRC_PAGE), "excluded": [], "entries": copy},
            "bindings": [
                {"nodeName": "BasicForm", "source": S(SRC_DEAD), "events": ["onFinish"]},
                {"nodeName": "SqlEditor", "source": S(SRC_SQL), "props": ["value"], "dynamicProps": ["value"],
                 "events": ["onChange"]},
                {"nodeName": "PreviewTable", "source": S(SRC_PREVIEW), "props": ["data"], "dynamicProps": ["data"],
                 "propStateDependencies": {"data": ["sampleRows", "appSource"]}},
                {"nodeName": "CheckAlert", "source": S(SRC_STATE), "props": ["type"]},
                {"nodeName": "AppShell", "source": S("顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"),
                 "props": ["appSource"], "dynamicProps": ["appSource"], "events": ["onAppSourceChange"]},
            ],
            "feedback": [
                {"nodeName": "ValidateButton", "event": "onClick", "kind": "transient", "source": S(SRC_HEAD),
                 "success": "校验通过后出现一次成功提示且校验项显示通过",
                 "failure": "校验失败时出现错误提示并保留可修正的 SQL"},
                {"nodeName": "SubmitButton", "event": "onClick", "kind": "transient", "source": S(SRC_SUBMIT),
                 "success": "预跑弹窗打开并显示进行中状态，同时出现一次成功提示",
                 "failure": "预跑失败时弹窗展示失败原因"},
            ],
            "runtimeCases": [
                {"id": "preview-page-change-1", "kind": "page-change", "nodeName": "PreviewTable",
                 "given": {"current": 1, "pageSize": 10, "sequence": 1},
                 "checks": [{"kind": "text", "text": "uid_01010", "present": True}, {"kind": "text", "text": "uid_01011", "present": False}],
                 "evidence": g.Ev(SRC_PREVIEW)},
                {"id": "preview-page-size-1", "kind": "page-size", "nodeName": "PreviewTable",
                 "given": {"current": 1, "pageSize": 20},
                 "checks": [{"kind": "text", "text": "uid_01012", "present": True}],
                 "evidence": g.Ev(SRC_PREVIEW)},
            ],
            "actionContracts": [],
            "appContext": {"required": True,
                           "evidence": g.Ev("`app_source` 由 **App 入口跳转带入**（进入客群平台时的 App 上下文），页面无 App 来源选项。"),
                           "shell": "AppShell", "binding": "$state.appSource",
                           "consumers": [{"nodeName": "PreviewTable", "property": "data", "kind": "data"}],
                           "cases": [{"id": "app-switch-selector", "kind": "app-switch", "nodeName": "AppShell",
                                      "given": {"appSource": "PESO"},
                                      "checks": [{"kind": "text", "text": "PESO", "present": True}]},
                                     {"id": "context-data-selector", "kind": "context-data",
                                      "nodeName": "PreviewTable", "given": {"appSource": "TACO"},
                                      "checks": [{"kind": "text", "text": "uid_01001", "present": True}]}]}}
    return page
