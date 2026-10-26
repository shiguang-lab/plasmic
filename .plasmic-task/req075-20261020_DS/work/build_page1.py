#!/usr/bin/env python3
"""Compose the /groups Page from the reviewed plan through documented transports."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ_ANTD = "eYLujTHmWfX9qEoQaFDSi4"
PROJ_OVER = "f3f4ju424PVNTAQPkwovrE"
PROJ_ICON = "vuoraLeVbtw7rQTKJ6UKar"
PROJ_RUI = "vJfWZAFzStvt61gEWotC7k"

STATUS = ["初始化", "圈选中", "圈选失败", "启用", "停用"]
BADGE = ["default", "processing", "error", "success", "warning"]
SCENARIOS = ["获客", "风险", "客经", "贷后", "公共"]
NAMES = ["夏日促活", "存量促活-7月客群", "首借未支用召回", "逾期M1提醒", "高额度未复借",
         "新客首借引导", "沉默30天唤醒", "额度提额候选", "首贷结清促复借", "电销高意向名单",
         "APP下载未注册", "注册未授信", "授信未首借", "M0逾期提醒", "优质客群复贷",
         "低活跃促活", "老客回归", "首借结清", "大额需求客群", "风险观察名单",
         "渠道TACO获客", "渠道PESO获客", "节日营销名单", "测试客群A"]
OWNERS = ["傅玮颖", "陈晓", "李明", "王晓"]

def rows():
    out = []
    for i in range(24):
        typ = "一次性" if i % 7 == 3 else "常规"
        out.append({
            "id": str(1001 + i),
            "groupKey": ("GRP_ONETIME_" if typ == "一次性" else "GRP_REGULAR_") + "CAMP%02d20260820" % (i + 1),
            "name": NAMES[i], "type": typ, "scenario": SCENARIOS[i % 5],
            "status": STATUS[i % 5],
            "updatedAt": "2026-08-%02d %02d:%02d:00" % (10 + (i % 19), 9 + (i % 8), (i * 7) % 60),
            "owner": "傅玮颖" if i < 21 else OWNERS[(i % 3) + 1], "market": "MX",
        })
    return out

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

FILTER_EXPR = ("($state.appliedFilters.market===`ALL` || r.market===$state.appliedFilters.market)"
               " && ($state.appliedFilters.type===`ALL` || r.type===$state.appliedFilters.type)"
               " && ($state.appliedFilters.scenario===`ALL` || r.scenario===$state.appliedFilters.scenario)"
               " && ($state.appliedFilters.status===`ALL` || r.status===$state.appliedFilters.status)"
               " && (!$state.appliedFilters.keyword || r.name.indexOf($state.appliedFilters.keyword)>=0"
               " || r.groupKey.indexOf($state.appliedFilters.keyword)>=0)")
DATA_ALL = "{{ {data: $state.allGroups.filter(r => %s)} }}" % FILTER_EXPR
DATA_MINE = "{{ {data: $state.allGroups.filter(r => %s && r.owner===$state.currentUser.name)} }}" % FILTER_EXPR
BADGE_EXPR = "{{ [`default`,`processing`,`error`,`success`,`warning`][[`初始化`,`圈选中`,`圈选失败`,`启用`,`停用`].indexOf(row.status)] }}"

ITEMS_EXPR = (
    "{{ [{\"key\":\"detail\",\"label\":\"详情\"},"
    "row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,"
    "row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,"
    "row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,"
    "row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,"
    "row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,"
    "{\"key\":\"copy\",\"label\":\"复制\"},"
    "row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,"
    "row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}"
)


def props(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def comp(name, registration, project, data=None, inner=None, style=None, uuids=None):
    attrs = ['data-plasmic-name="%s"' % name, 'data-plasmic-component="%s"' % registration,
             'data-plasmic-project="%s"' % project]
    if data is not None:
        attrs.append("data-props='%s'" % props(data))
    if style:
        attrs.append('style="%s"' % style)
    body = inner or ""
    return "<plasmic-component %s>%s</plasmic-component>" % (" ".join(attrs), body)


def slot(name, inner=""):
    return '<slot name="%s">%s</slot>' % (name, inner)


def text_span(name, text):
    return '<span data-plasmic-name="%s">%s</span>' % (name, text)


def icon(name, glyph):
    return comp(name, "plasmic-antd-icon-%s" % glyph, PROJ_ICON,
                inner="", style="font-size:16px;color:currentColor")


def select(name, options, default=None):
    data = {"options": [{"value": v, "label": l} for v, l in options]}
    if default is not None:
        data["defaultValue"] = default
    return comp(name, "plasmic-antd6-select", PROJ_ANTD, data=data)


def column(name, title, data_index=None, width=None, display="text", ellipsis=False,
           render=None, fixed=None):
    data = {"displayType": display}
    if data_index:
        data["dataIndex"] = data_index
    if width is not None:
        data["width"] = width
    if ellipsis:
        data["ellipsis"] = True
    if fixed:
        data["fixed"] = fixed
    inner = slot("title", '<span>%s</span>' % title)
    if render:
        inner += slot("render", render)
    return comp(name, "plasmic-antd6-table-column", PROJ_ANTD, data=data, inner=inner)


def table(name, data_expr, prefix):
    cols = [
        column(prefix + "GroupIDColumn", "客群ID", "id", 96),
        column(prefix + "GroupKeyColumn", "客群Key", "groupKey", 232, ellipsis=True),
        column(prefix + "NameColumn", "名称", "name", None, ellipsis=True),
        column(prefix + "TypeColumn", "类型", "type", 88),
        column(prefix + "ScenarioColumn", "场景", "scenario", 88),
        column(prefix + "StatusColumn", "状态", "status", 120, display="custom",
               render=comp(prefix + "StatusBadge", "plasmic-antd6-badge", PROJ_ANTD,
                           data={"status": BADGE_EXPR, "text": "{{ row.status }}"},
                           inner=slot("children"))),
        column(prefix + "UpdatedColumn", "更新时间", "updatedAt", 176),
        column(prefix + "OwnerColumn", "负责人", "owner", 112),
        column(prefix + "ActionsColumn", "操作", None, 220, display="custom", fixed="right",
               render=comp(prefix + "RowActions", "plasmic-react-ui-action-group", PROJ_RUI,
                           data={"max": 3, "items": ITEMS_EXPR,
                                 "dropdownProps": {"trigger": ["hover"]}},
                           inner=slot("children") + slot("moreIcon"))),
    ]
    data = {"data": {"data": data_expr}, "rowKey": "id", "size": "large",
            "pagination": {"defaultPageSize": 20, "pageSizeOptions": [20, 50, 100], "showSizeChanger": True},
            "scroll": {"x": 1320}}
    return comp(name, "plasmic-antd6-table", PROJ_ANTD, data=data,
                inner=slot("children", "".join(cols)) + slot("title"),
                style="width:100%;min-width:0")


def filters():
    items = []
    defs = [("FilterMarket", "market", "市场", "MarketSelect",
             [("ALL", "全部"), ("MX", "墨西哥 MX"), ("VN", "越南 VN")]),
            ("FilterScenario", "scenario", "场景", "ScenarioSelect",
             [("ALL", "全部")] + [(s, s) for s in SCENARIOS]),
            ("FilterType", "type", "类型", "TypeSelect",
             [("ALL", "全部"), ("常规", "常规"), ("一次性", "一次性")]),
            ("FilterStatus", "status", "状态", "StatusSelect",
             [("ALL", "全部")] + [(s, s) for s in STATUS])]
    for item, key, label, ctl, opts in defs:
        items.append(comp(item, "plasmic-overseas-search-form-item", PROJ_OVER,
                          data={"name": key, "label": label},
                          inner=slot("children", select(ctl, opts, "ALL"))))
    items.append(comp("FilterKeyword", "plasmic-overseas-search-form-item", PROJ_OVER,
                      data={"name": "keyword", "label": "关键字"},
                      inner=slot("children", comp("KeywordInput", "plasmic-antd6-input", PROJ_ANTD,
                                                  data={"placeholder": "客群名称或 Key", "allowClear": True}))))
    return comp("GroupFilters", "plasmic-overseas-search-form", PROJ_OVER,
                data={"colSpan": 6},
                inner=slot("children", "".join(items)) + slot("extraActions"))


def create_menu():
    button = comp("CreateGroupButton", "plasmic-antd6-button", PROJ_ANTD,
                  data={"type": "primary", "iconPlacement": "start"},
                  inner=slot("icon", icon("CreateMenuIcon", "PlusOutlined")) +
                        slot("children", comp("CreateGroupContent", "plasmic-antd6-space", PROJ_ANTD,
                                              data={"size": 4, "align": "center"},
                                              inner=slot("children", text_span("CreateGroupLabel", "新建客群")
                                                         + icon("CreateMenuIndicator", "DownOutlined")))))
    return comp("CreateMenu", "plasmic-antd6-dropdown", PROJ_ANTD,
                data={"menuItemsJson": [{"type": "item", "key": "regular", "label": "常规客群"},
                                        {"type": "item", "key": "onetime", "label": "一次性客群"}]},
                inner=slot("menuItems") + slot("children", button))


def modal_form():
    fields = [
        ("NameItem", "name", "客群名称", "NameInput", "input",
         {"placeholder": "请输入客群名称"}, [{"ruleType": "required", "message": "请输入客群名称"}]),
        ("KeyItem", "groupKey", "客群Key", "KeyInput", "input",
         {"placeholder": "GRP_ONETIME_名称_日期"}, [{"ruleType": "required", "message": "请输入客群Key"}]),
        ("TypeItem", "type", "客群类型", "TypeInput", "input",
         {"value": "一次性", "readOnly": True, "disabled": True}, []),
        ("ScenarioItem", "scenario", "业务场景", "ScenarioSelect2", "select",
         {"placeholder": "请选择业务场景", "options": [{"value": s, "label": s} for s in SCENARIOS]},
         [{"ruleType": "required", "message": "请选择业务场景"}]),
        ("OwnerItem", "owner", "负责人", "OwnerSelect", "select",
         {"placeholder": "请选择负责人", "showSearch": True,
          "options": [{"value": o, "label": o} for o in OWNERS]},
         [{"ruleType": "required", "message": "请选择负责人"}]),
    ]
    items = []
    for item, key, label, ctl, kind, data, rules in fields:
        if kind == "input":
            control = comp(ctl, "plasmic-antd6-input", PROJ_ANTD, data=data)
        else:
            control = comp(ctl, "plasmic-antd6-select", PROJ_ANTD,
                           data={k: v for k, v in data.items() if k != "placeholder"},
                           inner=slot("placeholder", data["placeholder"]))
        items.append(comp(item, "plasmic-antd6-form-item", PROJ_ANTD,
                          data={"name": key, "rules": rules} if rules else {"name": key},
                          inner=slot("label", '<span>%s</span>' % label) + slot("children", control) +
                                slot("tooltip") + slot("description")))
    return comp("CreateOnetimeForm", "plasmic-antd6-form", PROJ_ANTD,
                data={"mode": "advanced", "layout": "vertical", "formItems": []},
                inner=slot("children", "".join(items)) + slot("submitSlot"))


def page_html():
    all_tab = comp("AllTab", "plasmic-antd6-tab-item", PROJ_ANTD, data={"key": "all"},
                   inner=slot("label", "<span>全部客群</span>") + slot("children", table("AllGroupTable", DATA_ALL, "All"))
                         + slot("icon") + slot("closeIcon"))
    mine_tab = comp("MineTab", "plasmic-antd6-tab-item", PROJ_ANTD, data={"key": "mine"},
                    inner=slot("label", "<span>我负责的</span>") + slot("children", table("MineGroupTable", DATA_MINE, "Mine"))
                          + slot("icon") + slot("closeIcon"))
    tabs = comp("ScopeTabs", "plasmic-antd6-tabs", PROJ_ANTD,
                data={"defaultActiveKey": "all", "type": "line", "size": "medium"},
                inner=slot("items", all_tab + mine_tab) +
                      slot("tabBarExtraContentRight", create_menu()) +
                      slot("tabBarExtraContentLeft") + slot("addIcon") + slot("removeIcon"),
                style="width:100%;min-width:0")
    card = comp("GroupListCard", "plasmic-antd6-card", PROJ_ANTD,
                data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "0 20px"}}},
                inner=slot("title") + slot("extra") + slot("cover") + slot("actions") + slot("children", tabs))
    modal = comp("CreateOnetimeModal", "plasmic-antd6-modal", PROJ_ANTD,
                 data={"open": False, "width": "520"},
                 inner=slot("trigger") + slot("title", text_span("CreateModalTitle", "新建一次性客群")) +
                       slot("children", modal_form()) + slot("footer") + slot("closeIcon"))
    body = ('<div data-plasmic-name="ListBody" style="display:flex;flex-direction:column;width:100%;min-width:0">'
            + filters() + card + modal + "</div>")
    return comp("AppShell", "plasmic-overseas-app-shell", PROJ_OVER,
                data={"productName": "海外客群管理平台", "menuItems": MENU, "appSource": "TACO",
                      "appSources": [{"value": "TACO", "label": "TACO"}, {"value": "PESO", "label": "PESO"}]},
                inner=slot("children", body))


def main():
    comps = rpc.op("read", collection="components", depth=1)["results"][0]["components"]
    page = next((c for c in comps if c["name"] == "客群列表"), None)
    if page:
        print("page exists", json.dumps(page))
        page_uuid = page["uuid"]
        root = page.get("rootElementUuid")
    else:
        created = rpc.op("createComponent", name="客群列表", type="page", path="/groups", preset="Desktop")
        print("created", json.dumps(created, ensure_ascii=False))
        page_uuid = created["created"][0]["uuid"]
        root = created["created"][0]["rootElementUuid"]
        print("canvas", rpc.op("updateCanvas", canvasName="Custom arena 1", name="页面总览"))
    states = rpc.op("read", componentUuids=[page_uuid], view="context", depth=1)
    existing = json.dumps(states, ensure_ascii=False)
    for name, vtype, value in (("allGroups", "array", rows()),
                               ("appliedFilters", "object",
                                {"market": "ALL", "scenario": "ALL", "type": "ALL", "status": "ALL", "keyword": ""}),
                               ("currentUser", "object", {"role": "管理员", "name": "傅玮颖"}),
                               ("createModalOpen", "boolean", False)):
        if '"%s"' % name in existing:
            continue
        print("state", name, rpc.op("createState", componentUuid=page_uuid, name=name,
                                    variableType=vtype, initialValue=value))
    html = page_html()
    open(os.path.join(HERE, "page1.html"), "w", encoding="utf-8").write(html)
    res = rpc.op("insertHtml", componentUuid=page_uuid, html=html)
    print("insertHtml", json.dumps(res, ensure_ascii=False)[:1200])
    print("save", rpc.op("save"))


if __name__ == "__main__":
    main()
