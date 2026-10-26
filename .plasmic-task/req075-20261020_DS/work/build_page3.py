#!/usr/bin/env python3
"""Compose /groups/detail (客群详情 · 通用)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE_PATH = "/groups/detail"
PAGE_NAME = "客群详情"

BASIC = [("IdItem", "客群ID", "1002"), ("KeyItem", "客群Key", "GRP_ONETIME_RECALL_20260820"),
         ("NameItem", "客群名称", "存量促活-7月客群"), ("CreatorItem", "创建人", "傅玮颖"),
         ("CreatedAtItem", "创建时间", "2026-08-20")]
SELECT_INFO = [("GroupTypeItem", "客群类型", "一次性"), ("OriginItem", "客群来源", "写SQL"),
               ("StateItem", "状态", "启用"), ("ExpireRangeItem", "有效期", "2026-08-20 ~ 2026-09-03"),
               ("OwnerItem", "负责人", "傅玮颖")]
STORAGE = [("TableItem", "存储表", "cg_mx_cg_88001"), ("RetentionItem", "保存天数", "3 天"),
           ("PartitionItem", "保留分区", "2026-08-29 ~ 2026-08-31"),
           ("DeadlineItem", "产出截止时间", "每日 18:00:00")]


def member_rows():
    out = []
    for i in range(22):
        out.append({"id": "uid_%05d" % (3001 + i), "phone": "138****%02d" % (10 + i),
                    "registerDate": "2026-07-%02d" % (1 + i % 28),
                    "appSource": ["TACO", "PESO"][i % 2],
                    "creditStatus": ["已授信", "已拒绝", "审批中"][i % 3],
                    "loanStatus": ["结清", "在贷", "逾期"][i % 3]})
    return out


def select_rows():
    out = []
    for i in range(22):
        st = ["成功", "失败", "圈选中"][i % 3]
        out.append({"id": "sel_%03d" % (i + 1),
                    "selectAt": "2026-08-%02d %02d:%02d:00" % (1 + i % 27, 6 + i % 12, i % 60),
                    "trigger": ["上线", "重新圈选", "手动圈选"][i % 3],
                    "status": st, "memberCount": "—" if st != "成功" else "12,%03d" % (300 + i),
                    "reason": "底表分区缺失" if st == "失败" else "—"})
    return out


def refresh_rows():
    out = []
    for i in range(22):
        st = ["成功", "失败"][i % 2]
        out.append({"id": "ref_%03d" % (i + 1),
                    "refreshAt": "2026-08-%02d 06:%02d:00" % (1 + i % 27, i % 60),
                    "type": ["定时", "手动"][i % 2], "memberCount": "—" if st == "失败" else "12,%03d" % (300 + i),
                    "status": st, "reason": "上游依赖缺失" if st == "失败" else "—"})
    return out


def apply_rows():
    out = []
    for i in range(22):
        out.append({"id": "app_%03d" % (i + 1),
                    "applyType": ["营销活动", "通知触达"][i % 2],
                    "target": ["发券_FLOW_v2", "首借提醒", "召回活动_A"][i % 3],
                    "status": ["成功", "失败", "圈选中"][i % 3],
                    "operator": ["张三", "李四", "傅玮颖"][i % 3],
                    "appliedAt": "2026-08-%02d %02d:%02d:00" % (1 + i % 27, 9 + i % 10, i % 60)})
    return out


def desc_group(name, title, items, column=2):
    inner = "".join(comp(n, "plasmic-antd6-descriptions-item", PROJ_ANTD, data={"key": n},
                        inner=slot("label", "<span>%s</span>" % l) + slot("children", "<span>%s</span>" % v))
                    for n, l, v in items)
    return comp(name, "plasmic-antd6-descriptions", PROJ_ANTD,
                data={"column": column, "layout": "horizontal", "size": "medium"},
                inner=slot("title", "<span>%s</span>" % title) + slot("children", inner))


def statistic(name, title, value, suffix=""):
    return comp(name, "plasmic-antd6-statistic", PROJ_ANTD, data={"value": value},
                inner=slot("title", "<span>%s</span>" % title) + slot("prefix") +
                      slot("suffix", "<span>%s</span>" % suffix if suffix else ""))


def status_col(node, title, idx, width, mapping):
    col = column(node, title, idx, width, display="custom",
                 render=comp(node.replace("Column", "Badge"), "plasmic-antd6-badge", PROJ_ANTD,
                             data={"status": "{{ " + json.dumps(mapping, ensure_ascii=False) + "[row." + idx + "] }}",
                                   "text": "{{ row." + idx + " }}"},
                             inner=slot("children")))
    return col, comp(node.replace("Column", "Badge"), "plasmic-antd6-badge", PROJ_ANTD,
                     data={"status": "{{ " + json.dumps(mapping, ensure_ascii=False) + "[row." + idx + "] }}",
                           "text": "{{ row." + idx + " }}"},
                     inner=slot("children"))


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
                         slot("children", box(desc_group("BasicDescriptions", "基础信息", BASIC) +
                                              desc_group("SelectionDescriptions", "圈选信息", SELECT_INFO) +
                                              desc_group("StorageDescriptions", "数据存储", STORAGE), gap=16)))
    kpis = desc_group("KpiDescriptions", "", [("KpiStateItem", "状态", "启用"),
                                             ("KpiLastSelectItem", "上次圈选", "2026-08-20 10:25"),
                                             ("KpiLastRefreshItem", "上次刷新", "2026-08-19 06:30")], column=3)
    kpis = box(kpis + statistic("MemberStatistic", "成员数", 12340), gap=8)
    overview = box(kpis + desc_group("OverviewDescriptions", "", [
        ("ConditionItem", "圈选条件", "写SQL · 一次性执行"),
        ("ScaleItem", "当前规模", "12,340"),
        ("LastLogItem", "最近圈选记录", "成功 · 2026-08-20 10:25")], column=1), gap=16)
    credit_map = {"已授信": "success", "已拒绝": "error", "审批中": "processing"}
    loan_map = {"结清": "default", "在贷": "processing", "逾期": "error"}
    log_map = {"成功": "success", "失败": "error", "圈选中": "processing"}
    members = table("MembersTable", "{{ ({data: $state.memberRows}) }}",
                    [column("MemberUidColumn", "UID", "id", None, ellipsis=True),
                     column("MemberPhoneColumn", "手机号", "phone", 152),
                     column("MemberRegColumn", "注册时间", "registerDate", 168),
                     column("MemberSourceColumn", "App来源", "appSource", 112),
                     column("MemberCreditColumn", "授信状态", "creditStatus", 120, display="custom",
                            render=comp("MemberCreditBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                        data={"status": "{{ " + json.dumps(credit_map, ensure_ascii=False) + "[row.creditStatus] }}",
                                              "text": "{{ row.creditStatus }}"}, inner=slot("children"))),
                     column("MemberLoanColumn", "借据状态", "loanStatus", 120, display="custom",
                            render=comp("MemberLoanBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                        data={"status": "{{ " + json.dumps(loan_map, ensure_ascii=False) + "[row.loanStatus] }}",
                                              "text": "{{ row.loanStatus }}"}, inner=slot("children")))],
                    scroll_x=1120)
    selectlog = box(filters("SelectLogFilters", "SelectLogFiltersItem", "SelectLogFiltersControl", "触发",
                            [("ALL", "全部"), ("ONLINE", "上线"), ("RESELECT", "重新圈选"), ("MANUAL", "手动圈选")]) +
                    table("SelectLogTable", "{{ ({data: $state.selectRows}) }}",
                          [column("SelectTimeColumn", "圈选时间", "selectAt", 176),
                           column("SelectTriggerColumn", "触发", "trigger", 112),
                           column("SelectStateColumn", "状态", "status", 120, display="custom",
                                  render=comp("SelectStateBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                              data={"status": "{{ " + json.dumps(log_map, ensure_ascii=False) + "[row.status] }}",
                                                    "text": "{{ row.status }}"}, inner=slot("children"))),
                           column("SelectCountColumn", "命中成员数", "memberCount", 120),
                           column("SelectReasonColumn", "失败原因", "reason", None, ellipsis=True)],
                          scroll_x=1120), gap=16)
    refreshlog = table("RefreshLogTable", "{{ ({data: $state.refreshRows}) }}",
                       [column("RefreshTimeColumn", "刷新时间", "refreshAt", 176),
                        column("RefreshTypeColumn", "类型", "type", 96),
                        column("RefreshCountColumn", "成员数", "memberCount", 112),
                        column("RefreshStateColumn", "状态", "status", 120, display="custom",
                               render=comp("RefreshStateBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                           data={"status": "{{ " + json.dumps(log_map, ensure_ascii=False) + "[row.status] }}",
                                                 "text": "{{ row.status }}"}, inner=slot("children"))),
                        column("RefreshReasonColumn", "原因", "reason", None, ellipsis=True)],
                       scroll_x=1120)
    applylog = box(filters("ApplyLogFilters", "ApplyLogFiltersItem", "ApplyLogFiltersControl", "应用类型",
                           [("ALL", "全部"), ("MARKETING", "营销活动"), ("NOTICE", "通知触达")]) +
                   table("ApplyLogTable", "{{ ({data: $state.applyRows}) }}",
                         [column("ApplyTypeColumn", "应用类型", "applyType", 120),
                          column("ApplyTargetColumn", "目标活动", "target", None),
                          column("ApplyStateColumn", "状态", "status", 120, display="custom",
                                 render=comp("ApplyStateBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                             data={"status": "{{ " + json.dumps(log_map, ensure_ascii=False) + "[row.status] }}",
                                                   "text": "{{ row.status }}"}, inner=slot("children"))),
                          column("ApplyOperatorColumn", "操作人", "operator", 112),
                          column("ApplyTimeColumn", "时间", "appliedAt", 176)],
                         scroll_x=1120), gap=16)

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
                        slot("children", desc_group("ApplyDetailDescriptions", "", [
                            ("ApplyParamItem", "应用参数", "flow_id=FLOW_v2 · campaign=发券"),
                            ("ApplyResultItem", "返回信息", "request_no=20260822000031"),
                            ("ApplyFailItem", "失败原因", "—")], column=1)) +
                        slot("footer") + slot("closeIcon"))
    body = box(archive + detail_card + drawer, name="DetailBody", gap=16)
    return shell(body)


def main():
    comps = rpc.op("read", collection="components", depth=1)["results"][0]["components"]
    page = next((c for c in comps if c["name"] == PAGE_NAME), None)
    if page:
        page_uuid = page["uuid"]
    else:
        created = rpc.op("createComponent", name=PAGE_NAME, type="page", path=PAGE_PATH, preset="Desktop")
        page_uuid = created["created"][0]["uuid"]
        print("created", page_uuid)
    existing = json.dumps(rpc.op("read", componentUuids=[page_uuid], view="context", depth=1), ensure_ascii=False)
    for name, vtype, value in (("memberRows", "array", member_rows()),
                               ("selectRows", "array", select_rows()),
                               ("refreshRows", "array", refresh_rows()),
                               ("applyRows", "array", apply_rows()),
                               ("applyDrawerOpen", "boolean", False)):
        if '"%s"' % name in existing:
            continue
        print("state", name, rpc.op("createState", componentUuid=page_uuid, name=name,
                                    variableType=vtype, initialValue=value)["created"][0]["uuid"])
    html = page_html()
    open(os.path.join(HERE, "page3.html"), "w", encoding="utf-8").write(html)
    res = rpc.op("insertHtml", componentUuid=page_uuid, html=html)
    print("messages", json.dumps(res.get("messages"), ensure_ascii=False)[:400])
    print(rpc.op("save"))
    print("PAGE", page_uuid)


if __name__ == "__main__":
    main()
