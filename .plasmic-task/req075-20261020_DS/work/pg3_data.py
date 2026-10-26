"""Reviewed declarations for /groups/detail (page 3)."""
import sys
sys.path.insert(0, '.')
import gen_plan as g

SRC_PAGE = "客群详情页（查看客群情况 · 通用）"
SRC_ARCHIVE = "**信息区左右两列**"
SRC_TABS = "Tab：常规 **基本信息/概览/成员/圈选记录/刷新记录/应用记录/观测**"
SRC_OVERVIEW = "概览顶部 **KPI 卡行**"
SRC_MEMBERS = "全量成员分页列表（脱敏）"
SRC_SELECT = "圈选记录"
SRC_REFRESH = "刷新记录"
SRC_APPLY = "应用记录"
SRC_DRAWER = "操作: [详情](抽屉: 应用参数/返回信息/失败原因)"
SRC_MENU = "顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"

BASIC = [("IdItem", "客群ID", "1002"), ("KeyItem", "客群Key", "GRP_ONETIME_RECALL_20260820"),
         ("NameItem", "客群名称", "存量促活-7月客群"), ("CreatorItem", "创建人", "傅玮颖"),
         ("CreatedAtItem", "创建时间", "2026-08-20")]
SELECT_INFO = [("GroupTypeItem", "客群类型", "一次性"), ("OriginItem", "客群来源", "写SQL"),
               ("StateItem", "状态", "启用"), ("ExpireRangeItem", "有效期", "2026-08-20 ~ 2026-09-03"),
               ("OwnerItem", "负责人", "傅玮颖")]
STORAGE = [("TableItem", "存储表", "cg_mx_cg_88001"), ("RetentionItem", "保存天数", "3 天"),
           ("PartitionItem", "保留分区", "2026-08-29 ~ 2026-08-31"),
           ("DeadlineItem", "产出截止时间", "每日 18:00:00")]
KPI = [("KpiStateItem", "状态", "启用"), ("KpiLastSelectItem", "上次圈选", "2026-08-20 10:25"),
       ("KpiLastRefreshItem", "上次刷新", "2026-08-19 06:30")]
OVERVIEW = [("ConditionItem", "圈选条件", "写SQL · 一次性执行"),
            ("ScaleItem", "当前规模", "12,340"),
            ("LastLogItem", "最近圈选记录", "成功 · 2026-08-20 10:25")]
APPLY_DETAIL = [("ApplyParamItem", "应用参数", "flow_id=FLOW_v2 · campaign=发券"),
                ("ApplyResultItem", "返回信息", "request_no=20260822000031"),
                ("ApplyFailItem", "失败原因", "—")]



GROUPS = [("BasicDescriptions", "基础信息", BASIC), ("SelectionDescriptions", "圈选信息", SELECT_INFO),
          ("StorageDescriptions", "数据存储", STORAGE), ("KpiDescriptions", "", KPI),
          ("OverviewDescriptions", "", OVERVIEW), ("ApplyDetailDescriptions", "", APPLY_DETAIL)]
TABS = [("OverviewTab", "概览"), ("MembersTab", "成员"), ("SelectLogTab", "圈选记录"),
        ("RefreshLogTab", "刷新记录"), ("ApplyLogTab", "应用记录")]
COLUMNS = {
    "MembersTable": [("MemberUidColumn", "UID"), ("MemberPhoneColumn", "手机号"),
                     ("MemberRegColumn", "注册时间"), ("MemberSourceColumn", "App来源"),
                     ("MemberCreditColumn", "授信状态"), ("MemberLoanColumn", "借据状态")],
    "SelectLogTable": [("SelectTimeColumn", "圈选时间"), ("SelectTriggerColumn", "触发"),
                       ("SelectStateColumn", "状态"), ("SelectCountColumn", "命中成员数"),
                       ("SelectReasonColumn", "失败原因")],
    "RefreshLogTable": [("RefreshTimeColumn", "刷新时间"), ("RefreshTypeColumn", "类型"),
                        ("RefreshCountColumn", "成员数"), ("RefreshStateColumn", "状态"),
                        ("RefreshReasonColumn", "原因")],
    "ApplyLogTable": [("ApplyTypeColumn", "应用类型"), ("ApplyTargetColumn", "目标活动"),
                      ("ApplyStateColumn", "状态"), ("ApplyOperatorColumn", "操作人"),
                      ("ApplyTimeColumn", "时间"), ("ApplyActionsColumn", "操作")],
}

STATUS_MAP = {"成功": "success", "失败": "error", "圈选中": "processing",
              "已授信": "success", "已拒绝": "error", "审批中": "processing",
              "在贷": "processing", "逾期": "error", "结清": "default"}


def page():
    S = g.Src
    comps, nodes, copy = [], [], []
    comps.append({"nodeName": "AppShell", "component": "plasmic-overseas-app-shell", "role": "shell",
                  "purpose": "客群详情外壳：客群管理菜单与市场/App 上下文", "source": S(SRC_MENU),
                  "rule": "references/libraries/overseas/components/app-shell.md",
                  "props": {"productName": "海外客群管理平台", "menuItems": g.MENU,
                            "appSources": [{"value": "TACO", "label": "TACO"}, {"value": "PESO", "label": "PESO"}],
                            "appSource": "{{ $state.appSource }}"}})
    for n in ("DetailPage",):
        nodes.append({"nodeName": n, "tag": "div", "owner": None,
                      "purpose": "客群详情页根容器，承载应用外壳", "source": S(SRC_PAGE)})
    nodes.append({"nodeName": "DetailBody", "tag": "div", "owner": {"nodeName": "AppShell", "slot": "children"},
                  "purpose": "详情业务区纵向容器", "source": S(SRC_PAGE)})
    comps.append({"nodeName": "ArchiveCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "只读档案：基础信息、圈选信息与数据存储", "condition": "详情只读档案构成独立业务信息面",
                  "source": S(SRC_ARCHIVE), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "ArchiveGroups", "tag": "div",
                  "owner": {"nodeName": "ArchiveCard", "slot": "children"},
                  "purpose": "档案分组纵向容器", "source": S(SRC_ARCHIVE)})
    for group, title, items in GROUPS[:3]:
        comps.append({"nodeName": group, "component": "plasmic-antd6-descriptions", "role": "read-only-group",
                      "purpose": title + "组", "source": S(SRC_ARCHIVE),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"column": 2, "layout": "horizontal", "size": "medium"},
                      "owner": {"nodeName": "ArchiveCard", "slot": "children"}})
        if title:
            copy.append({"nodeName": group + "Title", "at": "/text", "text": title, "kind": "label",
                         "role": "title", "copyTriage": "perceive-now", "source": S(SRC_ARCHIVE),
                         "purpose": "标识档案分组"})
        for node, label, value in items:
            comps.append({"nodeName": node, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                          "purpose": label + "只读字段", "source": S(SRC_ARCHIVE),
                          "rule": "references/libraries/antd_v6/components/descriptions.md",
                          "props": {"key": node}, "owner": {"nodeName": group, "slot": "children"}})
            copy.append({"nodeName": node + "Label", "at": "/text", "text": label, "kind": "label",
                         "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(SRC_ARCHIVE),
                         "purpose": "标识只读字段"})
            copy.append({"nodeName": node + "Text", "at": "/text", "text": value, "kind": "value",
                         "role": "value", "copyTriage": "perceive-now", "source": S(SRC_ARCHIVE),
                         "purpose": "展示该字段值"})
    comps.append({"nodeName": "DetailCard", "component": "plasmic-antd6-card", "role": "surface",
                  "purpose": "概览、成员与各类记录 Tab", "condition": "详情 Tab 内容共享同一背景与左右内边距",
                  "source": S(SRC_TABS), "rule": "references/libraries/antd_v6/components/card.md",
                  "props": {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "0 20px"}}},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    comps.append({"nodeName": "DetailTabs", "component": "plasmic-antd6-tabs", "role": "content-scope",
                  "purpose": "概览/成员/圈选记录/刷新记录/应用记录 内容切换", "source": S(SRC_TABS),
                  "rule": "references/libraries/antd_v6/components/tabs.md",
                  "props": {"defaultActiveKey": "overview", "type": "line", "size": "medium"},
                  "owner": {"nodeName": "DetailCard", "slot": "children"}})
    for node, label in TABS:
        comps.append({"nodeName": node, "component": "plasmic-antd6-tab-item", "role": "widget",
                      "purpose": label + "视图", "source": S(SRC_TABS),
                      "rule": "references/libraries/antd_v6/components/tabs.md",
                      "props": {"key": {"OverviewTab": "overview", "MembersTab": "members",
                                        "SelectLogTab": "selectlog", "RefreshLogTab": "refreshlog",
                                        "ApplyLogTab": "applylog"}[node]},
                      "owner": {"nodeName": "DetailTabs", "slot": "items"}})
        copy.append({"nodeName": node + "Label", "at": "/text", "text": label, "kind": "label",
                     "role": "title", "copyTriage": "perceive-now", "source": S(SRC_TABS),
                     "purpose": "切换详情内容"})
    # overview
    nodes.append({"nodeName": "OverviewKpi", "tag": "div", "owner": {"nodeName": "OverviewTab", "slot": "children"},
                  "purpose": "概览 KPI 行", "source": S(SRC_OVERVIEW)})
    nodes.append({"nodeName": "OverviewBody", "tag": "div",
                  "owner": {"nodeName": "OverviewTab", "slot": "children"},
                  "purpose": "概览内容纵向容器", "source": S(SRC_OVERVIEW)})
    comps.append({"nodeName": "KpiDescriptions", "component": "plasmic-antd6-descriptions", "role": "read-only-group",
                  "purpose": "状态、上次圈选与上次刷新概览", "source": S(SRC_OVERVIEW),
                  "rule": "references/libraries/antd_v6/components/descriptions.md",
                  "props": {"column": 3, "layout": "horizontal", "size": "medium"},
                  "owner": {"nodeName": "OverviewTab", "slot": "children"}})
    for node, label, value in KPI:
        comps.append({"nodeName": node, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                      "purpose": label + "概览字段", "source": S(SRC_OVERVIEW),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"key": node}, "owner": {"nodeName": "KpiDescriptions", "slot": "children"}})
        copy.append({"nodeName": node + "Label", "at": "/text", "text": label, "kind": "label",
                     "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(SRC_OVERVIEW),
                     "purpose": "标识概览字段"})
        copy.append({"nodeName": node + "Text", "at": "/text", "text": value, "kind": "value",
                     "role": "value", "copyTriage": "perceive-now", "source": S(SRC_OVERVIEW),
                     "purpose": "展示该概览字段值"})
    comps.append({"nodeName": "MemberStatistic", "component": "plasmic-antd6-statistic", "role": "widget",
                  "purpose": "成员数指标", "source": S(SRC_OVERVIEW),
                  "rule": "references/libraries/antd_v6/components/statistic.md",
                  "props": {"value": 12340}, "owner": {"nodeName": "OverviewTab", "slot": "children"}})
    copy.append({"nodeName": "MemberStatisticTitle", "at": "/text", "text": "成员数", "kind": "label",
                 "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(SRC_OVERVIEW),
                 "purpose": "标识成员数指标"})
    comps.append({"nodeName": "OverviewDescriptions", "component": "plasmic-antd6-descriptions",
                  "role": "read-only-group", "purpose": "圈选条件与最近圈选记录", "source": S(SRC_OVERVIEW),
                  "rule": "references/libraries/antd_v6/components/descriptions.md",
                  "props": {"column": 1, "layout": "horizontal", "size": "medium"},
                  "owner": {"nodeName": "OverviewTab", "slot": "children"}})
    for node, label, value in OVERVIEW:
        comps.append({"nodeName": node, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                      "purpose": label, "source": S(SRC_OVERVIEW),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"key": node}, "owner": {"nodeName": "OverviewDescriptions", "slot": "children"}})
        copy.append({"nodeName": node + "Label", "at": "/text", "text": label, "kind": "label",
                     "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(SRC_OVERVIEW),
                     "purpose": "标识摘要字段"})
        copy.append({"nodeName": node + "Text", "at": "/text", "text": value, "kind": "value",
                     "role": "value", "copyTriage": "perceive-now", "source": S(SRC_OVERVIEW),
                     "purpose": "展示该摘要字段值"})
    return page_rest(S, comps, nodes, copy)


def page_rest(S, comps, nodes, copy):
    TABLES = [
        ("MembersTab", "MembersBody", "MembersTable", "{{ ({data: $state.memberRows.filter(r => r.appSource===$state.appSource)}) }}",
         SRC_MEMBERS, 1120, None),
        ("SelectLogTab", "SelectLogBody", "SelectLogTable", "{{ ({data: $state.selectRows}) }}", SRC_SELECT, 1120,
         ("SelectLogFilters", "SelectLogFiltersItem", "SelectLogFiltersControl", "触发",
          [("ALL", "全部"), ("ONLINE", "上线"), ("RESELECT", "重新圈选"), ("MANUAL", "手动圈选")])),
        ("RefreshLogTab", "RefreshLogBody", "RefreshLogTable", "{{ ({data: $state.refreshRows}) }}", SRC_REFRESH,
         1120, None),
        ("ApplyLogTab", "ApplyLogBody", "ApplyLogTable", "{{ ({data: $state.applyRows}) }}", SRC_APPLY, 1200,
         ("ApplyLogFilters", "ApplyLogFiltersItem", "ApplyLogFiltersControl", "应用类型",
          [("ALL", "全部"), ("MARKETING", "营销活动"), ("NOTICE", "通知触达")])),
    ]
    for tab, body_name, table_name, data, quote, scroll, filt in TABLES:
        if body_name != "MembersBody":
            nodes.append({"nodeName": body_name, "tag": "div", "owner": {"nodeName": tab, "slot": "children"},
                          "purpose": "Tab 内容纵向容器", "source": S(quote)})
        if filt:
            fname, item, control, label, opts = filt
            comps.append({"nodeName": fname, "component": "plasmic-overseas-search-form", "role": "query",
                          "purpose": "按" + label + "筛选记录", "source": S(quote),
                          "rule": "references/libraries/overseas/components/search-form.md",
                          "props": {"colSpan": 6},
                          "owner": {"nodeName": tab, "slot": "children"}})
            comps.append({"nodeName": item, "component": "plasmic-overseas-search-form-item", "role": "widget",
                          "purpose": label + "筛选", "source": S(quote),
                          "rule": "references/libraries/overseas/components/search-form.md",
                          "props": {"name": label, "label": label},
                          "owner": {"nodeName": fname, "slot": "children"}})
            comps.append({"nodeName": control, "component": "plasmic-antd6-select", "role": "field-choice",
                          "purpose": label + "取值", "source": S(quote),
                          "rule": "references/libraries/antd_v6/components/select.md",
                          "props": {"options": [{"value": v, "label": l} for v, l in opts],
                                    "defaultValue": "ALL"},
                          "owner": {"nodeName": item, "slot": "children"}})
            copy.append({"nodeName": item, "at": "/props/label", "text": label, "kind": "label",
                         "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(quote),
                         "purpose": "标识筛选项"})
            for i, (v, l) in enumerate(opts):
                copy.append({"nodeName": control, "at": "/props/options/%d/label" % i, "text": l,
                             "kind": "value", "role": "value", "copyTriage": "perceive-now",
                             "source": S(quote), "purpose": label + "可选取值"})
            copy.append({"nodeName": control, "at": "/props/defaultValue", "text": "ALL", "kind": "value",
                         "role": "value", "copyTriage": "perceive-now", "source": S(quote),
                         "purpose": "筛选项默认全部"})
        comps.append({"nodeName": table_name, "component": "plasmic-antd6-table", "role": "pagination",
                      "purpose": quote, "source": S(quote),
                      "rule": "references/libraries/antd_v6/components/table.md",
                      "props": {"data": data, "rowKey": "id", "size": "large",
                                "pagination": {"defaultPageSize": 20, "pageSizeOptions": [20, 50, 100],
                                               "showSizeChanger": True,
                                               "showTotal": "{{ (total, range) => `共 ${total} 条` }}"},
                                "scroll": {"x": scroll}},
                      "owner": {"nodeName": tab, "slot": "children"}})
        for col, title in COLUMNS[table_name]:
            status = any(col.endswith("StateColumn") or col.endswith("CreditColumn") or col.endswith("LoanColumn")
                         for _ in [0])
            p = {"displayType": "custom" if status else "text"}
            if col.endswith("ActionsColumn"):
                p.update({"width": 96, "fixed": "right", "displayType": "custom"})
            else:
                idx = {"MemberUidColumn": "id", "MemberPhoneColumn": "phone", "MemberRegColumn": "registerDate",
                       "MemberSourceColumn": "appSource", "MemberCreditColumn": "creditStatus",
                       "MemberLoanColumn": "loanStatus", "SelectTimeColumn": "selectAt",
                       "SelectTriggerColumn": "trigger", "SelectStateColumn": "status",
                       "SelectCountColumn": "memberCount", "SelectReasonColumn": "reason",
                       "RefreshTimeColumn": "refreshAt", "RefreshTypeColumn": "type",
                       "RefreshCountColumn": "memberCount", "RefreshStateColumn": "status",
                       "RefreshReasonColumn": "reason", "ApplyTypeColumn": "applyType",
                       "ApplyTargetColumn": "target", "ApplyStateColumn": "status",
                       "ApplyOperatorColumn": "operator", "ApplyTimeColumn": "appliedAt"}[col]
                p["dataIndex"] = idx
                w = {"MemberPhoneColumn": 152, "MemberRegColumn": 168, "MemberSourceColumn": 112,
                     "MemberCreditColumn": 120, "MemberLoanColumn": 120, "SelectTimeColumn": 176,
                     "SelectTriggerColumn": 112, "SelectStateColumn": 120, "SelectCountColumn": 120,
                     "RefreshTimeColumn": 176, "RefreshTypeColumn": 96, "RefreshCountColumn": 112,
                     "RefreshStateColumn": 120, "ApplyTypeColumn": 120, "ApplyStateColumn": 120,
                     "ApplyOperatorColumn": 112, "ApplyTimeColumn": 176}.get(col)
                p["width"] = w
                if not w:
                    p["ellipsis"] = True
            c = {"nodeName": col, "component": "plasmic-antd6-table-column",
                 "role": "status" if status else "widget", "purpose": title + "列", "source": S(quote),
                 "rule": "references/libraries/antd_v6/components/%s.md" % ("badge" if status else "table"),
                 "props": p, "owner": {"nodeName": table_name, "slot": "children"}}
            if status:
                c["statusMap"] = {k: {"status": v, "label": k} for k, v in STATUS_MAP.items()}
            comps.append(c)
            if status:
                comps.append({"nodeName": col.replace("Column", "Badge"), "component": "plasmic-antd6-badge",
                              "role": "status", "purpose": title + "语义色", "source": S(quote),
                              "rule": "references/libraries/antd_v6/components/badge.md",
                              "props": {"status": "{{ [`success`,`error`,`processing`,`default`][[`成功`,`失败`,`圈选中`,`已授信`,`已拒绝`,`审批中`,`在贷`,`逾期`,`结清`].indexOf(row.%s)] }}" % p["dataIndex"],
                                        "text": "{{ row.%s }}" % p["dataIndex"]},
                              "dynamicProps": ["status", "text"],
                              "owner": {"nodeName": col, "slot": "render"}})
            if col == "ApplyActionsColumn":
                comps.append({"nodeName": "ApplyRowActions", "component": "plasmic-react-ui-action-group",
                              "role": "row-actions", "purpose": "查看应用详情",
                              "source": S(SRC_DRAWER),
                              "rule": "references/libraries/react_ui/components/action-group.md",
                              "props": {"max": 3, "items": [{"key": "detail", "label": "详情"}]},
                              "owner": {"nodeName": col, "slot": "render"}})
                copy.append({"nodeName": "ApplyRowActions", "at": "/props/items/0/label", "text": "详情",
                             "kind": "action", "role": "button", "copyTriage": "perceive-now",
                             "source": S(SRC_DRAWER), "purpose": "打开该行应用详情抽屉"})
            if status:
                copy.append({"nodeName": col.replace("Column", "Badge"), "at": "/props/text",
                             "text": "{{ row.%s }}" % p["dataIndex"], "kind": "value", "role": "value",
                             "copyTriage": "perceive-now", "source": S(quote),
                             "purpose": "逐行显示" + title})
            copy.append({"nodeName": col + "Title", "at": "/text", "text": title, "kind": "label",
                         "role": "columnTitle", "copyTriage": "perceive-now", "source": S(quote),
                         "purpose": "列标题"})
    # drawer
    comps.append({"nodeName": "ApplyDetailDrawer", "component": "plasmic-antd6-drawer",
                  "role": "overlay-information", "purpose": "应用参数、返回信息与失败原因",
                  "source": S(SRC_DRAWER),
                  "rule": "references/libraries/antd_v6/compositions/modal-drawer.md",
                  "props": {"open": "{{ $state.applyDrawerOpen }}", "width": 480, "placement": "right"},
                  "owner": {"nodeName": "AppShell", "slot": "children"}})
    nodes.append({"nodeName": "ApplyDrawerBody", "tag": "div",
                  "owner": {"nodeName": "ApplyDetailDrawer", "slot": "children"},
                  "purpose": "抽屉内容容器", "source": S(SRC_DRAWER)})
    nodes.append({"nodeName": "ApplyDrawerTitle", "tag": "span",
                  "owner": {"nodeName": "ApplyDetailDrawer", "slot": "title"},
                  "purpose": "抽屉标题文字", "source": S(SRC_DRAWER)})
    copy.append({"nodeName": "ApplyDrawerTitle", "at": "/text", "text": "应用详情", "kind": "label",
                 "role": "title", "copyTriage": "perceive-now", "source": S(SRC_DRAWER),
                 "purpose": "说明抽屉用途"})
    comps.append({"nodeName": "ApplyDetailDescriptions", "component": "plasmic-antd6-descriptions",
                  "role": "read-only-group", "purpose": "应用参数、返回信息与失败原因",
                  "source": S(SRC_DRAWER), "rule": "references/libraries/antd_v6/components/descriptions.md",
                  "props": {"column": 1, "layout": "horizontal", "size": "medium"},
                  "owner": {"nodeName": "ApplyDetailDrawer", "slot": "children"}})
    for node, label, value in APPLY_DETAIL:
        comps.append({"nodeName": node, "component": "plasmic-antd6-descriptions-item", "role": "widget",
                      "purpose": label, "source": S(SRC_DRAWER),
                      "rule": "references/libraries/antd_v6/components/descriptions.md",
                      "props": {"key": node}, "owner": {"nodeName": "ApplyDetailDescriptions", "slot": "children"}})
        copy.append({"nodeName": node + "Label", "at": "/text", "text": label, "kind": "label",
                     "role": "fieldLabel", "copyTriage": "perceive-now", "source": S(SRC_DRAWER),
                     "purpose": "标识抽屉字段"})
        copy.append({"nodeName": node + "Text", "at": "/text", "text": value, "kind": "value",
                     "role": "value", "copyTriage": "perceive-now", "source": S(SRC_DRAWER),
                     "purpose": "展示该字段值"})
    for label, at, purpose in g.menu_copy_items():
        copy.append({"nodeName": "AppShell", "at": at, "text": label, "kind": "label", "role": "title",
                     "copyTriage": "perceive-now", "source": S(SRC_MENU), "purpose": purpose})
    names = {c["nodeName"] for c in comps} | {n["nodeName"] for n in nodes}
    SLOT = {"Label": "label", "Text": "children", "Title": "title"}
    for e in copy:
        nm = e["nodeName"]
        if nm in names:
            continue
        owner, slot = None, "children"
        for suffix, sl in SLOT.items():
            if nm.endswith(suffix) and nm[: -len(suffix)] in names:
                owner, slot = nm[: -len(suffix)], sl
                break
        if owner is None:
            print("UNRESOLVED copy owner", nm)
            continue
        nodes.append({"nodeName": nm, "tag": "span", "owner": {"nodeName": owner, "slot": slot},
                      "purpose": e["text"] + "文字", "source": e["source"]})
        names.add(nm)
    page = {"path": "/groups/detail", "name": "客群详情", "recordPage": False,
            "routePattern": "/groups/detail", "params": [], "modes": [],
            "source": S(SRC_PAGE), "pageHeader": None, "templates": [],
            "templatesNotApplicable": "The catalog has no tabbed record-detail composition (RecordDetailPage is a single summary plus related table without Tab-scoped tables), so the page composes registered Card/Descriptions/Tabs/Table/Drawer directly.",
            "components": comps, "nodes": nodes,
            "copy": {"source": S(SRC_PAGE), "excluded": [], "entries": copy},
            "bindings": [
                {"nodeName": "MembersTable", "source": S(SRC_MEMBERS), "props": ["data"], "dynamicProps": ["data"],
                 "propStateDependencies": {"data": ["memberRows", "appSource"]}},
                {"nodeName": "SelectLogTable", "source": S(SRC_SELECT), "props": ["data"], "dynamicProps": ["data"],
                 "propStateDependencies": {"data": ["selectRows"]}},
                {"nodeName": "RefreshLogTable", "source": S(SRC_REFRESH), "props": ["data"], "dynamicProps": ["data"],
                 "propStateDependencies": {"data": ["refreshRows"]}},
                {"nodeName": "ApplyLogTable", "source": S(SRC_APPLY), "props": ["data"], "dynamicProps": ["data"],
                 "propStateDependencies": {"data": ["applyRows"]}},
                {"nodeName": "SelectLogFilters", "source": S(SRC_SELECT), "events": ["onSearch", "onReset"]},
                {"nodeName": "ApplyLogFilters", "source": S(SRC_APPLY), "events": ["onSearch", "onReset"]},
                {"nodeName": "ApplyRowActions", "source": S(SRC_DRAWER), "events": ["onAction"]},
                {"nodeName": "ApplyDetailDrawer", "source": S(SRC_DRAWER), "props": ["open"],
                 "dynamicProps": ["open"], "events": ["onOpenChange"]},
                {"nodeName": "AppShell", "source": S(SRC_MENU), "props": ["appSource"],
                 "dynamicProps": ["appSource"], "events": ["onAppSourceChange"]},
            ],
            "feedback": [{"nodeName": "ApplyRowActions", "event": "onAction", "kind": "transient",
                          "source": S(SRC_DRAWER), "success": "点击详情后抽屉打开并出现一次成功提示",
                          "failure": "失败时保留抽屉关闭并提示错误"}],
            "runtimeCases": [
                {"id": "members-page-change-1", "kind": "page-change", "nodeName": "MembersTable",
                 "given": {"current": 1, "pageSize": 20, "sequence": 1},
                 "checks": [{"kind": "text", "text": "uid_03011", "present": True}, {"kind": "text", "text": "uid_03013", "present": False}], "evidence": g.Ev(SRC_MEMBERS)},
                {"id": "members-page-size-1", "kind": "page-size", "nodeName": "MembersTable",
                 "given": {"current": 1, "pageSize": 50},
                 "checks": [{"kind": "text", "text": "uid_03012", "present": True}], "evidence": g.Ev(SRC_MEMBERS)},
                {"id": "selectlog-query-1", "kind": "query", "nodeName": "SelectLogFilters",
                 "given": {"触发": "上线", "submit": True},
                 "checks": [{"kind": "text", "text": "上线", "present": True}], "evidence": g.Ev(SRC_SELECT)},
                {"id": "selectlog-reset-1", "kind": "reset", "nodeName": "SelectLogFilters",
                 "given": {"触发": "上线", "reset": True},
                 "checks": [{"kind": "text", "text": "成功", "present": True}], "evidence": g.Ev(SRC_SELECT)},
                {"id": "selectlog-page-change-1", "kind": "page-change", "nodeName": "SelectLogTable",
                 "given": {"current": 1, "pageSize": 20, "sequence": 1},
                 "checks": [{"kind": "text", "text": "sel_020", "present": True}, {"kind": "text", "text": "sel_021", "present": False}], "evidence": g.Ev(SRC_SELECT)},
                {"id": "selectlog-page-size-1", "kind": "page-size", "nodeName": "SelectLogTable",
                 "given": {"current": 1, "pageSize": 50},
                 "checks": [{"kind": "text", "text": "sel_022", "present": True}], "evidence": g.Ev(SRC_SELECT)},
                {"id": "refreshlog-page-change-1", "kind": "page-change", "nodeName": "RefreshLogTable",
                 "given": {"current": 1, "pageSize": 20, "sequence": 1},
                 "checks": [{"kind": "text", "text": "ref_020", "present": True}, {"kind": "text", "text": "ref_021", "present": False}], "evidence": g.Ev(SRC_REFRESH)},
                {"id": "refreshlog-page-size-1", "kind": "page-size", "nodeName": "RefreshLogTable",
                 "given": {"current": 1, "pageSize": 50},
                 "checks": [{"kind": "text", "text": "ref_022", "present": True}], "evidence": g.Ev(SRC_REFRESH)},
                {"id": "applylog-query-1", "kind": "query", "nodeName": "ApplyLogFilters",
                 "given": {"应用类型": "营销活动", "submit": True},
                 "checks": [{"kind": "text", "text": "营销活动", "present": True}], "evidence": g.Ev(SRC_APPLY)},
                {"id": "applylog-reset-1", "kind": "reset", "nodeName": "ApplyLogFilters",
                 "given": {"应用类型": "营销活动", "reset": True},
                 "checks": [{"kind": "text", "text": "营销活动", "present": True}], "evidence": g.Ev(SRC_APPLY)},
                {"id": "applylog-page-change-1", "kind": "page-change", "nodeName": "ApplyLogTable",
                 "given": {"current": 1, "pageSize": 20, "sequence": 1},
                 "checks": [{"kind": "text", "text": "app_020", "present": True}, {"kind": "text", "text": "app_021", "present": False}], "evidence": g.Ev(SRC_APPLY)},
                {"id": "applylog-page-size-1", "kind": "page-size", "nodeName": "ApplyLogTable",
                 "given": {"current": 1, "pageSize": 50},
                 "checks": [{"kind": "text", "text": "app_022", "present": True}], "evidence": g.Ev(SRC_APPLY)},
            ],
            "actionContracts": [{
                "nodeName": "ApplyRowActions", "key": "detail", "evidence": g.Ev(SRC_DRAWER),
                "confirm": False, "transitions": [],
                "cases": [
                    {"id": "applyrows-detail-allowed", "kind": "permission-allowed", "nodeName": "ApplyRowActions",
                     "given": {"currentUser": {"role": "只读", "name": "王晓"}, "record": {"status": "成功"}},
                     "checks": [{"kind": "count", "role": "button", "name": "详情", "count": 1}]},
                    {"id": "applyrows-detail-denied", "kind": "permission-denied", "nodeName": "ApplyRowActions",
                     "given": {"currentUser": {"role": "无权限用户", "name": "外部"}, "record": {"status": "成功"}},
                     "checks": [{"kind": "count", "role": "button", "name": "详情", "count": 0}]},
                ]}],
            "appContext": {"required": True,
                           "evidence": g.Ev("`app_source` 由 **App 入口跳转带入**（进入客群平台时的 App 上下文），页面无 App 来源选项。"),
                           "shell": "AppShell", "binding": "$state.appSource",
                           "consumers": [{"nodeName": "MembersTable", "property": "data", "kind": "data"}],
                           "cases": [{"id": "app-switch-detail", "kind": "app-switch", "nodeName": "AppShell",
                                      "given": {"appSource": "PESO"},
                                      "checks": [{"kind": "text", "text": "PESO", "present": True}]},
                                     {"id": "context-data-detail", "kind": "context-data",
                                      "nodeName": "MembersTable", "given": {"appSource": "TACO", "tab": "成员"},
                                      "checks": [{"kind": "text", "text": "uid_03001", "present": True}]}]}}
    return page
