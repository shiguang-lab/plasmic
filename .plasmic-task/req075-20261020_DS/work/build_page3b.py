#!/usr/bin/env python3
"""Rebuild /groups/detail with named containers only."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

PAGE = "NisuOsxUy7dG"
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

STATUS_MAP = {"成功": "success", "失败": "error", "圈选中": "processing",
              "已授信": "success", "已拒绝": "error", "审批中": "processing",
              "在贷": "processing", "逾期": "error", "结清": "default"}


def desc(name, title, items, column=2):
    inner = "".join(comp(n, "plasmic-antd6-descriptions-item", PROJ_ANTD, data={"key": n},
                         inner=slot("label", "<span>%s</span>" % l) + slot("children", "<span>%s</span>" % v))
                    for n, l, v in items)
    return comp(name, "plasmic-antd6-descriptions", PROJ_ANTD,
                data={"column": column, "layout": "horizontal", "size": "medium"},
                inner=(slot("title", "<span>%s</span>" % title) if title else slot("title")) +
                      slot("children", inner))


def status_col(name, title, idx, width):
    badge = name.replace("Column", "Badge")
    return (column(name, title, idx, width, display="custom",
                   render=comp(badge, "plasmic-antd6-badge", PROJ_ANTD,
                               data={"status": "{{ [`success`,`error`,`processing`,`default`]["
                                              "[`成功`,`失败`,`圈选中`,`已授信`,`已拒绝`,`审批中`,`在贷`,`逾期`,`结清`]"
                                              ".indexOf(row.%s)] }}" % idx,
                                     "text": "{{ row.%s }}" % idx},
                               inner=slot("children"))),
            badge)


def rows(kind, n=22):
    out = []
    for i in range(n):
        if kind == "member":
            out.append({"id": "uid_%05d" % (3001 + i), "phone": "138****%02d" % (10 + i),
                        "registerDate": "2026-07-%02d" % (1 + i % 28),
                        "appSource": "TACO" if i < 12 else "PESO",
                        "creditStatus": ["已授信", "已拒绝", "审批中"][i % 3],
                        "loanStatus": ["结清", "在贷", "逾期"][i % 3]})
        elif kind == "select":
            st = ["成功", "失败", "圈选中"][i % 3]
            out.append({"id": "sel_%03d" % (i + 1),
                        "selectAt": "2026-08-%02d %02d:%02d:00" % (1 + i % 27, 6 + i % 12, i % 60),
                        "trigger": ["上线", "重新圈选", "手动圈选"][i % 3], "status": st,
                        "memberCount": "—" if st != "成功" else "12,%03d" % (300 + i),
                        "reason": "底表分区缺失" if st == "失败" else "—"})
        elif kind == "refresh":
            st = ["成功", "失败"][i % 2]
            out.append({"id": "ref_%03d" % (i + 1),
                        "refreshAt": "2026-08-%02d 06:%02d:00" % (1 + i % 27, i % 60),
                        "type": ["定时", "手动"][i % 2],
                        "memberCount": "—" if st == "失败" else "12,%03d" % (300 + i),
                        "status": st, "reason": "上游依赖缺失" if st == "失败" else "—"})
        else:
            out.append({"id": "app_%03d" % (i + 1),
                        "applyType": ["营销活动", "通知触达"][i % 2],
                        "target": ["发券_FLOW_v2", "首借提醒", "召回活动_A"][i % 3],
                        "status": ["成功", "失败", "圈选中"][i % 3],
                        "operator": ["张三", "李四", "傅玮颖"][i % 3],
                        "appliedAt": "2026-08-%02d %02d:%02d:00" % (1 + i % 27, 9 + i % 10, i % 60)})
    return out


def filters(name, item, control, label, options):
    sel = select_(control, options, "ALL")
    return comp(name, "plasmic-overseas-search-form", PROJ_OVER, data={"colSpan": 6},
                inner=slot("children", comp(item, "plasmic-overseas-search-form-item", PROJ_OVER,
                                            data={"name": label, "label": label},
                                            inner=slot("children", sel))) + slot("extraActions"))


def page_html():
    archive = comp("ArchiveCard", "plasmic-antd6-card", PROJ_ANTD,
                   data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                   inner=slot("title") + slot("extra") + slot("cover") + slot("actions") +
                         slot("children",
                              '<div data-plasmic-name="ArchiveGroups" style="display:flex;flex-direction:column;gap:16px;width:100%;min-width:0">' +
                              desc("BasicDescriptions", "基础信息", BASIC) +
                              desc("SelectionDescriptions", "圈选信息", SELECT_INFO) +
                              desc("StorageDescriptions", "数据存储", STORAGE) + "</div>"))
    kpi = ('<div data-plasmic-name="OverviewKpi" style="display:flex;flex-direction:row;gap:24px;'
           'width:100%;min-width:0;align-items:flex-end">' +
           desc("KpiDescriptions", "", KPI, column=3) +
           comp("MemberStatistic", "plasmic-antd6-statistic", PROJ_ANTD, data={"value": 12340},
                inner=slot("title", "<span>成员数</span>") + slot("prefix") + slot("suffix")) + "</div>")
    overview = ('<div data-plasmic-name="OverviewBody" style="display:flex;flex-direction:column;gap:16px;'
                'width:100%;min-width:0;padding-bottom:16px">' + kpi +
                desc("OverviewDescriptions", "", OVERVIEW, column=1) + "</div>")
    cols_member = []
    rendered = []
    for name, title, idx, width, kind in (("MemberUidColumn", "UID", "id", None, "text"),
                                          ("MemberPhoneColumn", "手机号", "phone", 152, "text"),
                                          ("MemberRegColumn", "注册时间", "registerDate", 168, "text"),
                                          ("MemberSourceColumn", "App来源", "appSource", 112, "text"),
                                          ("MemberCreditColumn", "授信状态", "creditStatus", 120, "status"),
                                          ("MemberLoanColumn", "借据状态", "loanStatus", 120, "status")):
        if kind == "status":
            c, badge = status_col(name, title, idx, width)
            cols_member.append(c); rendered.append(badge)
        else:
            cols_member.append(column(name, title, idx, width, ellipsis=(width is None)))
    members = table("MembersTable", "{{ ({data: $state.memberRows.filter(r => r.appSource===$state.appSource)}) }}",
                    cols_member, scroll_x=1120)
    cols_select = []
    for name, title, idx, width, kind in (("SelectTimeColumn", "圈选时间", "selectAt", 176, "text"),
                                          ("SelectTriggerColumn", "触发", "trigger", 112, "text"),
                                          ("SelectStateColumn", "状态", "status", 120, "status"),
                                          ("SelectCountColumn", "命中成员数", "memberCount", 120, "text"),
                                          ("SelectReasonColumn", "失败原因", "reason", None, "text")):
        if kind == "status":
            c, badge = status_col(name, title, idx, width); cols_select.append(c); rendered.append(badge)
        else:
            cols_select.append(column(name, title, idx, width, ellipsis=(width is None)))
    selectlog = ('<div data-plasmic-name="SelectLogBody" style="display:flex;flex-direction:column;gap:16px;'
                 'width:100%;min-width:0;padding-bottom:16px">' +
                 filters("SelectLogFilters", "SelectLogFiltersItem", "SelectLogFiltersControl", "触发",
                         [("ALL", "全部"), ("ONLINE", "上线"), ("RESELECT", "重新圈选"), ("MANUAL", "手动圈选")]) +
                 table("SelectLogTable", "{{ ({data: $state.selectRows}) }}", cols_select, scroll_x=1120) +
                 "</div>")
    cols_refresh = []
    for name, title, idx, width, kind in (("RefreshTimeColumn", "刷新时间", "refreshAt", 176, "text"),
                                          ("RefreshTypeColumn", "类型", "type", 96, "text"),
                                          ("RefreshCountColumn", "成员数", "memberCount", 112, "text"),
                                          ("RefreshStateColumn", "状态", "status", 120, "status"),
                                          ("RefreshReasonColumn", "原因", "reason", None, "text")):
        if kind == "status":
            c, badge = status_col(name, title, idx, width); cols_refresh.append(c); rendered.append(badge)
        else:
            cols_refresh.append(column(name, title, idx, width, ellipsis=(width is None)))
    refreshlog = ('<div data-plasmic-name="RefreshLogBody" style="width:100%;min-width:0;padding-bottom:16px">' +
                  table("RefreshLogTable", "{{ ({data: $state.refreshRows}) }}", cols_refresh, scroll_x=1120) + "</div>")
    cols_apply = []
    for name, title, idx, width, kind in (("ApplyTypeColumn", "应用类型", "applyType", 120, "text"),
                                          ("ApplyTargetColumn", "目标活动", "target", None, "text"),
                                          ("ApplyStateColumn", "状态", "status", 120, "status"),
                                          ("ApplyOperatorColumn", "操作人", "operator", 112, "text"),
                                          ("ApplyTimeColumn", "时间", "appliedAt", 176, "text")):
        if kind == "status":
            c, badge = status_col(name, title, idx, width); cols_apply.append(c); rendered.append(badge)
        else:
            cols_apply.append(column(name, title, idx, width, ellipsis=(width is None)))
    cols_apply.append(column("ApplyActionsColumn", "操作", None, 96, display="custom", fixed="right",
                             render=comp("ApplyRowActions", "plasmic-react-ui-action-group", PROJ_RUI,
                                         data={"max": 3, "items": [{"key": "detail", "label": "详情"}]},
                                         inner=slot("children") + slot("moreIcon"))))
    applylog = ('<div data-plasmic-name="ApplyLogBody" style="display:flex;flex-direction:column;gap:16px;'
                'width:100%;min-width:0;padding-bottom:16px">' +
                filters("ApplyLogFilters", "ApplyLogFiltersItem", "ApplyLogFiltersControl", "应用类型",
                        [("ALL", "全部"), ("MARKETING", "营销活动"), ("NOTICE", "通知触达")]) +
                table("ApplyLogTable", "{{ ({data: $state.applyRows}) }}", cols_apply, scroll_x=1200) + "</div>")

    def tab(node, label, key, content):
        return comp(node, "plasmic-antd6-tab-item", PROJ_ANTD, data={"key": key},
                    inner=slot("label", "<span>%s</span>" % label) + slot("children", content) +
                          slot("icon") + slot("closeIcon"))

    tabs = comp("DetailTabs", "plasmic-antd6-tabs", PROJ_ANTD,
                data={"defaultActiveKey": "overview", "type": "line", "size": "medium"},
                inner=slot("items", tab("OverviewTab", "概览", "overview", overview) +
                                     tab("MembersTab", "成员", "members", members) +
                                     tab("SelectLogTab", "圈选记录", "selectlog", selectlog) +
                                     tab("RefreshLogTab", "刷新记录", "refreshlog", refreshlog) +
                                     tab("ApplyLogTab", "应用记录", "applylog", applylog)) +
                      slot("tabBarExtraContentRight") + slot("tabBarExtraContentLeft") +
                      slot("addIcon") + slot("removeIcon"), style="width:100%;min-width:0")
    detail_card = comp("DetailCard", "plasmic-antd6-card", PROJ_ANTD,
                       data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "0 20px"}}},
                       inner=slot("title") + slot("extra") + slot("cover") + slot("actions") +
                             slot("children", tabs))
    drawer = comp("ApplyDetailDrawer", "plasmic-antd6-drawer", PROJ_ANTD,
                  data={"open": "{{ $state.applyDrawerOpen }}", "width": 480, "placement": "right"},
                  inner=slot("title", span("ApplyDrawerTitle", "应用详情")) +
                        slot("children", '<div data-plasmic-name="ApplyDrawerBody" style="width:100%;min-width:0">' +
                             desc("ApplyDetailDescriptions", "", APPLY_DETAIL, column=1) + "</div>") +
                        slot("footer") + slot("closeIcon"))
    body = ('<div data-plasmic-name="DetailBody" style="display:flex;flex-direction:column;gap:16px;'
            'width:100%;min-width:0">' + archive + detail_card + drawer + "</div>")
    return shell(body)


def main():
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    m = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "AppShell"', tree)
    if m:
        rpc.op("deleteElement", componentUuid=PAGE, elementUuid=m.group(1))
        print("removed shell")
    res = rpc.op("insertHtml", componentUuid=PAGE, html=page_html())
    print("messages", json.dumps(res.get("messages"), ensure_ascii=False)[:200])
    root = rpc.op("read", componentUuids=[PAGE], view="tree", depth="all")["results"][0]["rootElementUuid"]
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=root, name="DetailPage")
    st = json.dumps(rpc.op("read", componentUuids=[PAGE], view="context", depth=1), ensure_ascii=False)
    if '"name": "appSource"' not in st:
        rpc.op("createState", componentUuid=PAGE, name="appSource", variableType="text", initialValue="TACO")
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    def u(n):
        mm = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "%s"' % n, tree)
        return mm.group(1) if mm else None
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=u("AppShell"), props={"appSource": "{{ $state.appSource }}"})
    rpc.op("createInteraction", componentUuid=PAGE, elementUuid=u("AppShell"), eventName="onAppSourceChange",
           name="syncAppSource", action={"actionName": "customFunction", "code": "$state.appSource = value;"})
    rpc.op("createInteraction", componentUuid=PAGE, elementUuid=u("ApplyRowActions"), eventName="onAction",
           name="openApplyDetail", action={"actionName": "customFunction",
           "code": "$state.applyDrawerOpen = true;"
                   "$globalActions[\"plasmic-antd6-config-provider.showMessage\"](\"success\", \"已打开应用详情\", 3);"})
    rpc.op("createInteraction", componentUuid=PAGE, elementUuid=u("ApplyDetailDrawer"), eventName="onOpenChange",
           name="closeApplyDetail", action={"actionName": "customFunction", "code": "$state.applyDrawerOpen = open;"})
    print(rpc.op("save"))


if __name__ == "__main__":
    main()
