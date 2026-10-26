#!/usr/bin/env python3
"""Build the REQ075 structure expectation from reviewed sources (page by page)."""
import hashlib, json, os, sys

TASK = "/Users/yanxianliang/shiguang/plasmic/.plasmic-task/req075-20261020_DS"
REQ = "/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/REQ_海外客群管理平台.md"
PRD = "/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/PRD_海外客群管理平台_P0.md"
TPL = os.path.join(TASK, "work/template-source.json")

_cache = {}
def _text(path):
    if path not in _cache:
        _cache[path] = open(path, encoding="utf-8").read()
    return _cache[path]

def Ev(quote, doc=PRD):
    body = _text(doc)
    if quote not in body:
        raise SystemExit("NOT VERBATIM in %s:\n%s" % (os.path.basename(doc), quote))
    return {"path": doc, "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(), "quote": quote}

def Src(quote, doc=PRD):
    Ev(quote, doc)
    return "%s: %s" % (doc, quote)

MENU = [{
    "key": "audience", "label": "客群管理",
    "children": [
        {"key": "groups", "label": "客群列表", "href": "/groups", "children": [
            {"key": "detail", "label": "客群详情", "href": "/groups/detail", "hidden": True},
            {"key": "onetime-create", "label": "新建一次性客群", "href": "/groups/onetime-create", "hidden": True},
        ]},
        {"key": "selector", "label": "客群圈选器", "href": "/groups/selector"},
    ],
}]

def shell(purpose, quote):
    return {"nodeName": "AppShell", "component": "plasmic-overseas-app-shell", "role": "shell",
            "purpose": purpose, "source": Src(quote),
            "rule": "references/libraries/overseas/components/app-shell.md",
            "props": {"productName": "海外客群管理平台", "menuItems": MENU,
                      "appSources": [{"value": "TACO", "label": "TACO"}, {"value": "PESO", "label": "PESO"}],
                      "appSource": "TACO"}}

DETAIL_BASIC = [("IdItem", "客群ID", "1002"), ("KeyItem", "客群Key", "GRP_ONETIME_RECALL_20260820"),
                ("NameItem", "客群名称", "存量促活-7月客群"), ("CreatorItem", "创建人", "傅玮颖"),
                ("CreatedAtItem", "创建时间", "2026-08-20")]
DETAIL_SELECT = [("GroupTypeItem", "客群类型", "一次性"), ("OriginItem", "客群来源", "写SQL"),
                 ("StateItem", "状态", "启用"), ("ExpireRangeItem", "有效期", "2026-08-20 ~ 2026-09-03"),
                 ("OwnerItem", "负责人", "傅玮颖")]
DETAIL_STORAGE = [("TableItem", "存储表", "cg_mx_cg_88001"), ("RetentionItem", "保存天数", "3 天"),
                  ("PartitionItem", "保留分区", "2026-08-29 ~ 2026-08-31"),
                  ("DeadlineItem", "产出截止时间", "每日 18:00:00")]

ONETIME_BASIC = [("BasicNameItem", "客群名称", "存量促活-7月客群"),
                 ("BasicKeyItem", "客群Key", "GRP_ONETIME_CUNLIANG7YUE_20260820"),
                 ("BasicTypeItem", "客群类型", "一次性"),
                 ("BasicScenarioItem", "业务场景", "客经"),
                 ("BasicOwnerItem", "负责人", "傅玮颖"),
                 ("BasicSourceItem", "App来源", "TACO（入口带入）")]

CHECKS = [("CheckSyntaxItem", "语句合法性", "仅只读 SELECT，禁止 DDL/DML 与危险函数"),
          ("CheckSourceItem", "底表", "限 dwt / cdm 产出表"),
          ("CheckRoleItem", "权限", "执行需运营及以上，只读仅查看"),
          ("CheckColumnItem", "结果字段", "须含 uid 与 app_source 两列"),
          ("CheckFilterItem", "结尾过滤", "按进入时 app_source 过滤")]

STATUS_DICT = {"INITIALIZED": "初始化", "SELECTING": "圈选中", "SELECT_FAILED": "圈选失败",
               "ACTIVE": "启用", "INACTIVE": "停用"}
BADGE = {"初始化": "default", "圈选中": "processing", "圈选失败": "error", "启用": "success", "停用": "warning"}

SCENARIOS = ["获客", "风险", "客经", "贷后", "公共"]
OWNERS = ["傅玮颖", "陈晓", "李明", "王晓"]
NAMES = ["夏日促活", "存量促活-7月客群", "首借未支用召回", "逾期M1提醒", "高额度未复借",
         "新客首借引导", "沉默30天唤醒", "额度提额候选", "首贷结清促复借", "电销高意向名单",
         "APP下载未注册", "注册未授信", "授信未首借", "M0逾期提醒", "优质客群复贷",
         "低活跃促活", "老客回归", "首借结清", "大额需求客群", "风险观察名单",
         "渠道TACO获客", "渠道PESO获客", "节日营销名单", "测试客群A"]

def group_rows(market="MX"):
    rows = []
    keys = list(STATUS_DICT)
    for i in range(24):
        typ = "一次性" if i % 7 == 3 else "常规"
        rows.append({
            "id": str(1001 + i),
            "groupKey": ("GRP_ONETIME_" if typ == "一次性" else "GRP_REGULAR_") + "CAMP%02d20260820" % (i + 1),
            "name": NAMES[i], "type": typ, "scenario": SCENARIOS[i % 5],
            "status": STATUS_DICT[keys[i % 5]],
            "updatedAt": "2026-08-%02d %02d:%02d:00" % (10 + (i % 19), 9 + (i % 8), (i * 7) % 60),
            "owner": ("傅玮颖" if i < 21 else OWNERS[(i % 3) + 1]), "market": market,
        })
    return rows

def table_data(rows):
    return "{{ " + json.dumps({"data": rows}, ensure_ascii=False) + " }}"

ACTIONS = ('{{ [{"key":"detail","label":"详情"},'
           '(row.status==="初始化"||row.status==="圈选失败")?{"key":"edit","label":"编辑"}:false,'
           'row.status==="初始化"?{"key":"online","label":"上线","confirm":{"title":"上线后开始正式圈选，确认上线？","okText":"上线","cancelText":"取消"}}:false,'
           'row.status==="圈选失败"?{"key":"reselect","label":"重新圈选"}:false,'
           'row.status==="停用"?{"key":"enable","label":"启用","confirm":{"title":"启用将重新圈选，确认启用？","okText":"启用","cancelText":"取消"}}:false,'
           'row.status==="启用"&&$state.currentUser.role==="管理员"?{"key":"disable","label":"停用","confirm":{"title":"停用后该客群不可用于应用，确认停用？","okText":"停用","cancelText":"取消"}}:false,'
           '{"key":"copy","label":"复制"},'
           'row.status==="初始化"?{"key":"delete","label":"删除","confirm":{"title":"删除后不可恢复，确认删除？","okText":"删除","cancelText":"取消"}}:false,'
           'row.status==="启用"&&$state.currentUser.role==="管理员"?{"key":"export","label":"导出名单"}:false] }}')

FILTER_EXPR = ("($state.appliedFilters.market===`ALL` || r.market===$state.appliedFilters.market)"
               " && ($state.appliedFilters.type===`ALL` || r.type===$state.appliedFilters.type)"
               " && ($state.appliedFilters.scenario===`ALL` || r.scenario===$state.appliedFilters.scenario)"
               " && ($state.appliedFilters.status===`ALL` || r.status===$state.appliedFilters.status)"
               " && (!$state.appliedFilters.keyword || r.name.indexOf($state.appliedFilters.keyword)>=0"
               " || r.groupKey.indexOf($state.appliedFilters.keyword)>=0)")

BADGE_EXPR = "{{ [`default`,`processing`,`error`,`success`,`warning`][[`初始化`,`圈选中`,`圈选失败`,`启用`,`停用`].indexOf(row.status)] }}"

ITEMS_EXPR = ('{{ [{"key":"detail","label":"详情"},'
              'row.status===`初始化`||row.status===`圈选失败`?{"key":"edit","label":"编辑"}:false,'
              'row.status===`初始化`?{"key":"online","label":"上线","confirm":{"title":"上线后开始正式圈选，确认上线？","okText":"上线","cancelText":"取消"}}:false,'
              'row.status===`圈选失败`?{"key":"reselect","label":"重新圈选"}:false,'
              'row.status===`停用`?{"key":"enable","label":"启用","confirm":{"title":"启用将重新圈选，确认启用？","okText":"启用","cancelText":"取消"}}:false,'
              'row.status===`启用`&&$state.currentUser.role===`管理员`?{"key":"disable","label":"停用","confirm":{"title":"停用后该客群不可用于应用，确认停用？","okText":"停用","cancelText":"取消"}}:false,'
              '{"key":"copy","label":"复制"},'
              'row.status===`初始化`?{"key":"delete","label":"删除","confirm":{"title":"删除后不可恢复，确认删除？","okText":"删除","cancelText":"取消"}}:false,'
              'row.status===`启用`&&$state.currentUser.role===`管理员`?{"key":"export","label":"导出名单"}:false] }}')

COLUMN_TITLES = [("GroupIDColumn", "客群ID", "id", 88, "text"),
                 ("GroupKeyColumn", "客群Key", "groupKey", 146, "text"),
                 ("NameColumn", "名称", "name", None, "text"),
                 ("TypeColumn", "类型", "type", 84, "text"),
                 ("ScenarioColumn", "场景", "scenario", 84, "text"),
                 ("StatusColumn", "状态", "status", 112, "status"),
                 ("UpdatedColumn", "更新时间", "updatedAt", 190, "text"),
                 ("OwnerColumn", "负责人", "owner", 96, "text"),
                 ("ActionsColumn", "操作", None, 184, "actions")]


def group_title_nodes(prefix):
    out = []
    for col, title, _, _, _ in COLUMN_TITLES:
        suffix = {"GroupIDColumn": "GroupIDTitle", "GroupKeyColumn": "GroupKeyTitle", "NameColumn": "NameTitle",
                  "TypeColumn": "TypeTitle", "ScenarioColumn": "ScenarioTitle", "StatusColumn": "StatusTitle",
                  "UpdatedColumn": "UpdatedTitle", "OwnerColumn": "OwnerTitle",
                  "ActionsColumn": "ActionsTitle"}[col]
        out.append((prefix + suffix, title, prefix + col))
    return out


def group_columns(prefix, owner):
    cols = []
    for col, title, idx, width, kind in COLUMN_TITLES:
        node = prefix + col
        if kind == "status":
            cols.append({"nodeName": node, "component": "plasmic-antd6-table-column", "role": "status",
                         "purpose": title + "列", "source": Src("状态 `全部 / 初始化 / 圈选中 / 圈选失败 / 启用 / 停用`"),
                         "rule": "references/libraries/antd_v6/components/badge.md",
                         "props": {"dataIndex": idx, "displayType": "custom", "width": width},
                         "statusMap": {k: {"status": BADGE[k], "label": k} for k in BADGE},
                         "owner": {"nodeName": owner, "slot": "children"}})
            cols.append({"nodeName": prefix + "StatusBadge", "component": "plasmic-antd6-badge", "role": "status",
                         "purpose": "状态文字与语义色",
                         "source": Src("状态 `全部 / 初始化 / 圈选中 / 圈选失败 / 启用 / 停用`"),
                         "rule": "references/libraries/antd_v6/components/badge.md",
                         "props": {"status": BADGE_EXPR, "text": "{{ row.status }}"},
                         "dynamicProps": ["status", "text"],
                         "owner": {"nodeName": node, "slot": "render"}})
        elif kind == "actions":
            cols.append({"nodeName": node, "component": "plasmic-antd6-table-column", "role": "widget",
                         "purpose": title + "列", "source": Src("行操作：详情——跳转 §4.4；编辑——仅初始化/圈选失败态"),
                         "rule": "references/libraries/react_ui/components/action-group.md",
                         "props": {"displayType": "custom", "fixed": "right", "width": width},
                         "owner": {"nodeName": owner, "slot": "children"}})
            cols.append({"nodeName": prefix + "RowActions", "component": "plasmic-react-ui-action-group",
                         "role": "row-actions", "purpose": "按客群状态与当前角色显隐的行操作",
                         "source": Src("行操作：详情——跳转 §4.4；编辑——仅初始化/圈选失败态"),
                         "rule": "references/libraries/react_ui/components/action-group.md",
                         "props": {"max": 3, "items": ITEMS_EXPR, "dropdownProps": {"trigger": ["hover"]}},
                         "dynamicProps": ["items"],
                         "owner": {"nodeName": node, "slot": "render"}})
        else:
            p = {"dataIndex": idx, "displayType": "text", "width": width}
            if idx in ("groupKey", "name"):
                p["ellipsis"] = True
            cols.append({"nodeName": node, "component": "plasmic-antd6-table-column", "role": "widget",
                         "purpose": title + "列", "source": Src("列表展示**客群 ID / 客群 Key / 名称**三标识"),
                         "rule": "references/libraries/antd_v6/components/table.md",
                         "props": p, "owner": {"nodeName": owner, "slot": "children"}})
    return cols


def menu_copy_items():
    return [("客群管理", "/props/menuItems/0/label", "一级菜单：客群管理"),
            ("客群列表", "/props/menuItems/0/children/0/label", "二级菜单：客群列表"),
            ("客群详情", "/props/menuItems/0/children/0/children/0/label", "隐藏路由：客群详情"),
            ("新建一次性客群", "/props/menuItems/0/children/0/children/1/label", "隐藏路由：新建一次性客群"),
            ("客群圈选器", "/props/menuItems/0/children/1/label", "二级菜单：客群圈选器")]


def page_runtime_cases():
    def case(cid, kind, node, given, checks, quote, extra=None):
        c = {"id": cid, "kind": kind, "nodeName": node, "given": given, "checks": checks, "evidence": Ev(quote)}
        if extra:
            c.update(extra)
        return c
    q = lambda pairs: [{"kind": "text", "text": t, "present": p} for t, p in pairs]
    cases = [
        case("filters-query-1", "query", "GroupFilters", {"keyword": "夏日促活", "submit": True},
             q([("夏日促活", True), ("首借未支用召回", False)]), "筛选区：市场 / **场景** / 类型 / 状态 / 关键字"),
        case("filters-reset-1", "reset", "GroupFilters", {"keyword": "夏日促活", "reset": True},
             q([("首借未支用召回", True)]), "筛选区：市场 / **场景** / 类型 / 状态 / 关键字"),
        case("all-page-change-1", "page-change", "AllGroupTable", {"current": 1, "pageSize": 20, "sequence": 1},
             q([("夏日促活", True), ("节日营销名单", False)]), "分页（每页默认 20，可调）"),
        case("all-page-change-2", "page-change", "AllGroupTable", {"current": 2, "pageSize": 20, "sequence": 2},
             q([("渠道TACO获客", True), ("夏日促活", False)]), "分页（每页默认 20，可调）"),
        case("all-page-size-1", "page-size", "AllGroupTable", {"current": 1, "pageSize": 50},
             q([("夏日促活", True), ("渠道TACO获客", True)]), "分页（每页默认 20，可调）"),
        case("mine-page-change-1", "page-change", "MineGroupTable", {"current": 1, "pageSize": 20, "sequence": 1},
             q([("夏日促活", True)]), "「我负责的」仅展示 `owner` 为当前登录人的客群。"),
        case("mine-page-size-1", "page-size", "MineGroupTable", {"current": 1, "pageSize": 50},
             q([("夏日促活", True)]), "「我负责的」仅展示 `owner` 为当前登录人的客群。"),
    ]
    return cases


ROW_ACTIONS = [
    ("detail", "详情", "行操作：详情——跳转 §4.4", False, (), ()),
    ("edit", "编辑", "编辑——仅初始化/圈选失败态", False, (), ("初始化",)),
    ("online", "上线", "| 上线 | `INITIALIZED → SELECTING` |", True, ({"from": "初始化", "to": "圈选中", "text": "圈选中"},), ("初始化",)),
    ("reselect", "重新圈选", "| 重新圈选 | `SELECT_FAILED → SELECTING` |", False,
     ({"from": "圈选失败", "to": "圈选中", "text": "圈选中"},), ("圈选失败",)),
    ("enable", "启用", "| 启用（重新圈选） | `INACTIVE → RE_SELECTING` |", True,
     ({"from": "停用", "to": "重新启用圈选中", "text": "重新启用圈选中"},), ("停用",)),
    ("disable", "停用", "| 停用 | `ACTIVE → INACTIVE` | **仅管理员**", True,
     ({"from": "启用", "to": "停用", "text": "停用"},), ("启用",)),
    ("copy", "复制", "复制——复制条件新建客群（初始化态）", False, (), ()),
    ("delete", "删除", "删除——**仅初始化态可操作**，二次确认", True,
     ({"from": "初始化", "to": "已删除", "text": "已删除"},), ("初始化",)),
    ("export", "导出名单", "**导出名单**——发起名单导出（**仅管理员**", False, (), ("启用",)),
]


def page_action_contracts():
    def case(cid, kind, node, given, checks, quote, transition=None):
        c = {"id": cid, "kind": kind, "nodeName": node, "given": given, "checks": checks, "evidence": Ev(quote)}
        if transition:
            c["transition"] = transition
        return c
    out = []
    for owner in ("AllRowActions", "MineRowActions"):
        for key, label, quote, confirm, transitions, statuses in ROW_ACTIONS:
            cases = [
                case(owner + "-" + key + "-allowed", "permission-allowed", owner,
                     {"currentUser": {"role": "管理员", "name": "傅玮颖"},
                      "record": {"status": statuses[0] if statuses else "启用"}},
                     [{"kind": "count", "role": "button", "name": label, "count": 1}], quote),
                case(owner + "-" + key + "-denied", "permission-denied", owner,
                     {"currentUser": {"role": "运营", "name": "陈晓"},
                      "record": {"status": statuses[0] if statuses else "启用"}},
                     [{"kind": "count", "role": "button", "name": label, "count": 0}], quote),
            ]
            if confirm:
                for decision, kind in (("cancel", "confirm-cancel"), ("accept", "confirm-accept")):
                    cases.append(case(owner + "-" + key + "-" + decision, kind, owner,
                                      {"currentUser": {"role": "管理员"},
                                       "record": {"status": statuses[0] if statuses else "启用"},
                                       "decision": decision},
                                      [{"kind": "text", "text": label, "present": True}], quote))
            for tr in transitions:
                cases.append(case(owner + "-" + key + "-transition-" + tr["to"], "state-transition", owner,
                                  {"currentUser": {"role": "管理员"}, "record": {"status": tr["from"]},
                                   "decision": "accept"},
                                  [{"kind": "text", "text": tr["text"], "present": True}], quote, transition=tr))
            out.append({"nodeName": owner, "key": key, "evidence": Ev(quote), "confirm": confirm,
                        "transitions": list(transitions), "cases": cases})
    return out


def page1():
    rows = group_rows()
    comps, nodes, copy = [], [], []
    Q_MENU = "顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"
    Q_FILTER = "筛选区：市场 / **场景** / 类型 / 状态 / 关键字"
    Q_LIST = "列表展示**客群 ID / 客群 Key / 名称**三标识"
    Q_SCOPE = "**归属切换**：表格工具栏 `[全部客群 | 我负责的]`"
    Q_PAGE = "分页（每页默认 20，可调）"
    Q_NEW = "**新建客群 ▾ 下拉**（操作区唯一新建入口）"
    comps.append({"nodeName": "AppShell", "component": "plasmic-overseas-app-shell", "role": "shell",
                  "purpose": "客群管理后台外壳：客群管理菜单与市场/App 上下文",
                  "source": Src(Q_MENU),
                  "rule": "references/libraries/overseas/components/app-shell.md",
                  "props": {"productName": "海外客群管理平台", "menuItems": MENU,
                            "appSources": [{"value": "TACO", "label": "TACO"}, {"value": "PESO", "label": "PESO"}],
                            "appSource": "{{ $state.appSource }}"}})
    nodes.append({"nodeName": "GroupListPage", "tag": "div", "owner": None,
                  "purpose": "客群列表页根容器，承载应用外壳", "source": Src("客群列表页")})
    nodes.append({"nodeName": "ListBody", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "客群列表业务区纵向容器", "source": Src("列表页统一：筛选区 → 操作区 → 表格区 → 分页")})
    comps.append({"nodeName": "GroupFilters", "component": "plasmic-overseas-search-form", "role": "query",
                  "purpose": "按市场、场景、类型、状态与关键字筛选客群",
                  "source": Src(Q_FILTER),
                  "rule": "references/libraries/overseas/components/search-form.md",
                  "props": {"colSpan": 6,
                            "initialValues": {"market": "ALL", "scenario": "ALL", "type": "ALL",
                                              "status": "ALL", "keyword": ""}}})
    filters = [("FilterMarket", "market", "市场", "MarketSelect",
                [("ALL", "全部"), ("MX", "墨西哥 MX"), ("VN", "越南 VN")]),
               ("FilterScenario", "scenario", "场景", "ScenarioSelect",
                [("ALL", "全部"), ("获客", "获客"), ("风险", "风险"), ("客经", "客经"),
                 ("贷后", "贷后"), ("公共", "公共")]),
               ("FilterType", "type", "类型", "TypeSelect",
                [("ALL", "全部"), ("常规", "常规"), ("一次性", "一次性")]),
               ("FilterStatus", "status", "状态", "StatusSelect",
                [("ALL", "全部"), ("初始化", "初始化"), ("圈选中", "圈选中"), ("圈选失败", "圈选失败"),
                 ("启用", "启用"), ("停用", "停用")])]
    for item, name, label, sel, opts in filters:
        comps.append({"nodeName": item, "component": "plasmic-overseas-search-form-item", "role": "widget",
                      "purpose": "按" + label + "筛选客群", "source": Src(Q_FILTER),
                      "rule": "references/libraries/overseas/components/search-form.md",
                      "props": {"name": name, "label": label},
                      "owner": {"nodeName": "GroupFilters", "slot": "children"}})
        comps.append({"nodeName": sel, "component": "plasmic-antd6-select", "role": "field-choice",
                      "purpose": label + "筛选取值", "source": Src("场景为单选下拉（枚举见 §5.1 FC-01-02）"),
                      "rule": "references/libraries/antd_v6/components/select.md",
                      "props": {"options": [{"value": v, "label": l} for v, l in opts], "defaultValue": None},
                      "owner": {"nodeName": item, "slot": "children"}})
        copy.append({"nodeName": item, "at": "/props/label", "text": label, "kind": "label",
                     "role": "fieldLabel", "copyTriage": "perceive-now",
                     "source": Src(Q_FILTER), "purpose": "标识该筛选项"})
        for k, (v, l) in enumerate(opts):
            copy.append({"nodeName": sel, "at": "/props/options/%d/label" % k, "text": l, "kind": "value",
                         "role": "value", "copyTriage": "perceive-now",
                         "source": Src("场景为单选下拉（枚举见 §5.1 FC-01-02）"), "purpose": label + "可选取值"})
    comps.append({"nodeName": "FilterKeyword", "component": "plasmic-overseas-search-form-item", "role": "widget",
                  "purpose": "按客群名称或 Key 检索", "source": Src(Q_FILTER),
                  "rule": "references/libraries/overseas/components/search-form.md",
                  "props": {"name": "keyword", "label": "关键字"},
                  "owner": {"nodeName": "GroupFilters", "slot": "children"}})
    comps.append({"nodeName": "KeywordInput", "component": "plasmic-antd6-input", "role": "widget",
                  "purpose": "客群名称或 Key 输入", "source": Src(Q_FILTER),
                  "rule": "references/libraries/antd_v6/components/input.md",
                  "props": {"placeholder": "客群名称或 Key", "allowClear": True},
                  "owner": {"nodeName": "FilterKeyword", "slot": "children"}})
    copy += [
        {"nodeName": "FilterKeyword", "at": "/props/label", "text": "关键字", "kind": "label",
         "role": "fieldLabel", "copyTriage": "perceive-now", "source": Src(Q_FILTER),
         "purpose": "标识关键字筛选项"},
        {"nodeName": "KeywordInput", "at": "/props/placeholder", "text": "客群名称或 Key",
         "kind": "placeholder", "role": "placeholder", "copyTriage": "perceive-now",
         "source": Src(Q_FILTER), "purpose": "说明可检索的客群标识"},
    ]
    comps.append({"nodeName": "GroupListCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "客群列表的共享底色，承载归属切换与表格",
                  "condition": "列表的归属切换与表格共享同一背景与左右内边距",
                  "source": Src(Q_SCOPE), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "0 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    comps.append({"nodeName": "ScopeTabs", "component": "plasmic-antd6-tabs", "role": "content-scope",
                  "purpose": "全部客群 / 我负责的 互斥归属视图", "source": Src(Q_SCOPE),
                  "rule": "references/libraries/antd_v6/components/tabs.md",
                  "props": {"defaultActiveKey": "all", "type": "line", "size": "medium"},
                  "owner": {"nodeName": "GroupListCard", "slot": "children"}})
    scope = [("All", "全部客群", "all"), ("Mine", "我负责的", "mine")]
    for pre, label, key in scope:
        comps.append({"nodeName": pre + "Tab", "component": "plasmic-antd6-tab-item", "role": "widget",
                      "purpose": label + "归属视图", "source": Src(Q_SCOPE),
                      "rule": "references/libraries/antd_v6/components/tabs.md",
                      "props": {"key": key}, "owner": {"nodeName": "ScopeTabs", "slot": "items"}})
        span_name = pre + ("GroupsTabLabel" if pre == "All" else "GroupsTabLabel")
        nodes.append({"nodeName": span_name, "tag": "span",
                      "owner": {"nodeName": pre + "Tab", "slot": "label"},
                      "purpose": label + "标签文字", "source": Src(Q_SCOPE)})
        copy.append({"nodeName": span_name, "at": "/text", "text": label, "kind": "label",
                     "role": "title", "copyTriage": "perceive-now", "source": Src(Q_SCOPE),
                     "purpose": "切换列表归属范围"})
        data = ("{{ ({data: $state.allGroups.filter(r => " + FILTER_EXPR.replace("&& r.market", "&& r.appSource===$state.appSource && r.market") +
                (")}) }}" if pre == "All" else
                "{{ ({data: $state.allGroups.filter(r => " + FILTER_EXPR.replace("&& r.market", "&& r.appSource===$state.appSource && r.market") +
                " && r.owner===$state.currentUser.name)}) }}"))
        comps.append({"nodeName": pre + "GroupTable", "component": "plasmic-antd6-table", "role": "pagination",
                      "purpose": label + "客群表格，默认每页 20 条", "source": Src(Q_PAGE),
                      "rule": "references/libraries/antd_v6/components/table.md",
                      "props": {"data": data, "rowKey": "id", "size": "large",
                                "pagination": {"defaultPageSize": 20, "pageSizeOptions": [20, 50, 100],
                                               "showSizeChanger": True},
                                "scroll": {"x": 1160}},
                      "owner": {"nodeName": pre + "Tab", "slot": "children"}})
        for c in group_columns(pre, pre + "GroupTable"):
            comps.append(c)
        for span_name, title, owner in group_title_nodes(pre):
            nodes.append({"nodeName": span_name, "tag": "span",
                          "owner": {"nodeName": owner, "slot": "title"},
                          "purpose": title + "列标题文字", "source": Src(Q_LIST)})
            copy.append({"nodeName": span_name, "at": "/text", "text": title, "kind": "label",
                         "role": "columnTitle", "copyTriage": "perceive-now",
                         "source": Src(Q_LIST), "purpose": "列标题"})
    comps.append({"nodeName": "CreateMenu", "component": "plasmic-antd6-dropdown", "role": "action-menu",
                  "purpose": "新建客群下拉：常规客群 / 一次性客群", "source": Src(Q_NEW),
                  "rule": "references/libraries/antd_v6/components/dropdown.md",
                  "props": {"menuItemsJson": [{"type": "item", "key": "regular", "label": "常规客群"},
                                              {"type": "item", "key": "onetime", "label": "一次性客群"}]},
                  "owner": {"nodeName": "ScopeTabs", "slot": "tabBarExtraContentRight"}})
    comps.append({"nodeName": "CreateGroupButton", "component": "plasmic-antd6-button", "role": "widget",
                  "purpose": "打开新建客群下拉", "source": Src(Q_NEW),
                  "rule": "references/libraries/antd_v6/components/dropdown.md",
                  "props": {"type": "primary", "iconPlacement": "start"},
                  "owner": {"nodeName": "CreateMenu", "slot": "children"}})
    copy += [
        {"nodeName": "CreateGroupLabel", "at": "/text", "text": "新建客群", "kind": "action",
         "role": "button", "copyTriage": "perceive-now", "source": Src(Q_NEW), "purpose": "打开新建客群入口"},
        {"nodeName": "CreateMenu", "at": "/props/menuItemsJson/0/label", "text": "常规客群", "kind": "action",
         "role": "button", "copyTriage": "perceive-now", "source": Src("②**新建常规客群**"),
         "purpose": "进入常规客群圈选器"},
        {"nodeName": "CreateMenu", "at": "/props/menuItemsJson/1/label", "text": "一次性客群", "kind": "action",
         "role": "button", "copyTriage": "perceive-now", "source": Src("①**新建一次性客群**"),
         "purpose": "进入一次性客群建群页"},
    ]
    for label, at, purpose in menu_copy_items():
        copy.append({"nodeName": "AppShell", "at": at, "text": label, "kind": "label", "role": "title",
                     "copyTriage": "perceive-now", "source": Src(Q_MENU), "purpose": purpose})
    nodes += [
        {"nodeName": "CreateGroupContent", "component": "plasmic-antd6-space",
         "owner": {"nodeName": "CreateGroupButton", "slot": "children"},
         "purpose": "排列新建客群文字与下拉指示", "source": Src(Q_NEW)},
        {"nodeName": "CreateGroupLabel", "tag": "span",
         "owner": {"nodeName": "CreateGroupContent", "slot": "children"},
         "purpose": "新建客群按钮文字", "source": Src(Q_NEW)},
        {"nodeName": "CreateMenuIndicator", "component": "plasmic-antd-icon-DownOutlined",
         "owner": {"nodeName": "CreateGroupContent", "slot": "children"},
         "purpose": "下拉菜单指示", "source": Src(Q_NEW)},
        {"nodeName": "CreateMenuIcon", "component": "plasmic-antd-icon-PlusOutlined",
         "owner": {"nodeName": "CreateGroupButton", "slot": "icon"},
         "purpose": "新建动作图标", "source": Src(Q_NEW)},
    ]
    page = {"path": "/groups", "name": "客群列表", "recordPage": False,
            "routePattern": "/groups", "params": [], "modes": [],
            "source": Src("客群列表页"), "pageHeader": None,
            "templates": [{"sourceProjectId": "145nN6S5QQBwgjtNUwuiQZ",
                           "componentName": "TabsTableSection", "mode": "reference",
                           "adaptation": "Retain the inspected Card(body padding 0 20px) > Tabs(line/medium) > TabItem > Table hierarchy, the All/Mine scope pair, the tabBarExtraContentRight primary-action Slot and the fixed-right action Column with ActionGroup; replace sample columns, records, actions and primary action with 客群 fields and the 新建客群 ▾ menu.",
                           "evidence": {"path": TPL, "sha256": hashlib.sha256(open(TPL, "rb").read()).hexdigest()}}],
            "components": comps, "nodes": nodes,
            "copy": {"source": Src("客群列表页"), "excluded": [], "entries": copy},
            "bindings": [], "feedback": [], "runtimeCases": [], "actionContracts": []}
    page["bindings"] = [
        {"nodeName": "AllGroupTable", "source": Src(Q_LIST), "props": ["data"], "dynamicProps": ["data"],
         "propStateDependencies": {"data": ["allGroups", "appliedFilters", "appSource"]}},
        {"nodeName": "MineGroupTable", "source": Src("「我负责的」仅展示 `owner` 为当前登录人的客群。"),
         "props": ["data"], "dynamicProps": ["data"],
         "propStateDependencies": {"data": ["allGroups", "appliedFilters", "appSource", "currentUser"]}},
        {"nodeName": "GroupFilters", "source": Src(Q_FILTER), "events": ["onSearch", "onReset"]},
        {"nodeName": "AllRowActions", "source": Src("行操作：详情——跳转 §4.4"), "events": ["onAction"],
         "dynamicProps": ["items"], "propStateDependencies": {"items": ["currentUser"]}},
        {"nodeName": "MineRowActions", "source": Src("行操作：详情——跳转 §4.4"), "events": ["onAction"],
         "dynamicProps": ["items"], "propStateDependencies": {"items": ["currentUser"]}},
        {"nodeName": "CreateMenu", "source": Src(Q_NEW), "events": ["onAction"]},
        {"nodeName": "AppShell", "source": Src(Q_MENU), "props": ["appSource"], "dynamicProps": ["appSource"],
         "events": ["onAppSourceChange"]},
    ]
    page["rowActions"] = [
        {"column": "AllActionsColumn", "control": "AllRowActions", "event": "onAction", "source": Src("行操作：详情——跳转 §4.4")},
        {"column": "MineActionsColumn", "control": "MineRowActions", "event": "onAction", "source": Src("行操作：详情——跳转 §4.4")},
    ]
    page["feedback"] = [
        {"nodeName": "AllRowActions", "event": "onAction", "kind": "transient",
         "source": Src("**停用、导出仅管理员**"),
         "success": "确认后的动作出现一次成功 Message，行状态随之更新",
         "failure": "拒绝或失败时不改变行数据，出现一次错误 Message"},
        {"nodeName": "MineRowActions", "event": "onAction", "kind": "transient",
         "source": Src("**停用、导出仅管理员**"),
         "success": "确认后的动作出现一次成功 Message，行状态随之更新",
         "failure": "拒绝或失败时不改变行数据，出现一次错误 Message"},
    ]
    page["runtimeCases"] = page_runtime_cases()
    page["actionContracts"] = page_action_contracts()
    page["appContext"] = {
        "required": True,
        "evidence": Ev("`app_source` 由 **App 入口跳转带入**（进入客群平台时的 App 上下文），页面无 App 来源选项。"),
        "shell": "AppShell", "binding": "$state.appSource",
        "consumers": [{"nodeName": "AllGroupTable", "property": "data", "kind": "data"},
                      {"nodeName": "MineGroupTable", "property": "data", "kind": "data"}],
        "cases": [
            {"id": "app-switch-1", "kind": "app-switch", "nodeName": "AppShell",
             "given": {"appSource": "PESO"},
             "checks": [{"kind": "text", "text": "PESO", "present": True}]},
            {"id": "context-data-1", "kind": "context-data", "nodeName": "AllGroupTable",
             "given": {"appSource": "TACO"},
             "checks": [{"kind": "text", "text": "夏日促活", "present": True}]},
            {"id": "context-data-2", "kind": "context-data", "nodeName": "MineGroupTable",
             "given": {"appSource": "TACO"},
             "checks": [{"kind": "text", "text": "夏日促活", "present": True}]},
        ],
    }
    return page


# ------------------------------------------------------------------ page 2 (圈选器)
CHECKS = [("CheckSyntaxItem", "语句合法性", "仅只读 SELECT，禁止 DDL/DML 与危险函数"),
          ("CheckSourceItem", "底表", "限 dwt / cdm 产出表"),
          ("CheckRoleItem", "权限", "执行需运营及以上，只读仅查看"),
          ("CheckColumnItem", "结果字段", "须含 uid 与 app_source 两列"),
          ("CheckFilterItem", "结尾过滤", "按进入时 app_source 过滤")]


# ------------------------------------------------------------------ page 4 (一次性建群)
ONETIME_BASIC = [("BasicNameItem", "客群名称", "存量促活-7月客群"),
                 ("BasicKeyItem", "客群Key", "GRP_ONETIME_CUNLIANG7YUE_20260820"),
                 ("BasicTypeItem", "客群类型", "一次性"),
                 ("BasicScenarioItem", "业务场景", "客经"),
                 ("BasicOwnerItem", "负责人", "傅玮颖"),
                 ("BasicSourceItem", "App来源", "TACO（入口带入）")]


# ------------------------------------------------------------------ page 3 (详情)
DETAIL_BASIC = [("IdItem", "客群ID", "1002"), ("KeyItem", "客群Key", "GRP_ONETIME_RECALL_20260820"),
                ("NameItem", "客群名称", "存量促活-7月客群"), ("CreatorItem", "创建人", "傅玮颖"),
                ("CreatedAtItem", "创建时间", "2026-08-20")]
DETAIL_SELECT = [("GroupTypeItem", "客群类型", "一次性"), ("OriginItem", "客群来源", "写SQL"),
                 ("StateItem", "状态", "启用"), ("ExpireRangeItem", "有效期", "2026-08-20 ~ 2026-09-03"),
                 ("OwnerItem", "负责人", "傅玮颖")]
DETAIL_STORAGE = [("TableItem", "存储表", "cg_mx_cg_88001"), ("RetentionItem", "保存天数", "3 天"),
                  ("PartitionItem", "保留分区", "2026-08-29 ~ 2026-08-31"),
                  ("DeadlineItem", "产出截止时间", "每日 18:00:00")]
