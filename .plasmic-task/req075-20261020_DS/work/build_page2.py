#!/usr/bin/env python3
"""Compose /groups/selector (常规客群圈选器 · SQL 模式)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE_PATH = "/groups/selector"
PAGE_NAME = "客群圈选器"

SQL = ("SELECT uid, app_source, register_date\n"
       "FROM cdm_mx_dim_customer_user_df\n"
       "WHERE register_date >= '2026-07-01'\n"
       "  AND app_source = 'TACO'\n"
       "LIMIT 1000")

SAMPLE = []
for i in range(12):
    SAMPLE.append({"id": "uid_%05d" % (1001 + i),
                   "registerDate": "2026-07-%02d" % (1 + i),
                   "appSource": ["TACO", "PESO"][i % 2],
                   "creditStatus": ["已授信", "已拒绝", "审批中"][i % 3],
                   "loanStatus": ["结清", "在贷", "逾期"][i % 3]})


def basic_card():
    items = [
        form_item("NameItem", "name", "客群名称", input_("NameInput", "请输入客群名称"),
                  [{"ruleType": "required", "message": "请输入客群名称"}]),
        form_item("RetentionItem", "retentionDays", "数据保存天数",
                  select_("RetentionSelect", [("3", "3 天"), ("7", "7 天"), ("30", "30 天"),
                                              ("60", "60 天"), ("180", "180 天"), ("0", "长期")], "3"),
                  [{"ruleType": "required", "message": "请选择数据保存天数"}]),
        form_item("DeadlineItem", "produceDeadline", "产出截止时间",
                  time_picker("DeadlineTime", "2026-08-19T18:00:00"),
                  [{"ruleType": "required", "message": "请选择产出截止时间"}]),
        form_item("RefreshItem", "refreshMode", "刷新模式",
                  select_("RefreshSelect", [("DYNAMIC", "T+1 动态")], "DYNAMIC")),
        form_item("TypeItem", "groupType", "客群类型",
                  input_("TypeInput", value="常规", readonly=True, disabled=True)),
    ]
    form = comp("BasicForm", "plasmic-antd6-form", PROJ_ANTD,
                data={"mode": "advanced", "layout": "horizontal", "labelCol": {"flex": "120px"},
                      "formItems": []},
                inner=slot("children",
                           row("".join(cell(i, "calc(33.333% - 11px)") for i in items[:3])) + row("".join(cell(i, "calc(33.333% - 11px)") for i in items[3:])))
                      + slot("submitSlot"))
    return card("BasicInfoCard", form)


def sql_card():
    extra = ('<div style="display:flex;flex-direction:row;align-items:center;gap:8px;width:100%">' +
             button("FormatButton", "格式化") + button("ValidateButton", "校验") + "</div>")
    checks = descriptions("CheckDescriptions",
                          [(n, l, '<span>%s</span>' % ("通过" if True else "待校验")) for n, l, _ in CHECKS_LOCAL],
                          column=1)
    summary = comp("HitCountStatistic", "plasmic-antd6-statistic", PROJ_ANTD,
                   data={"value": "{{ $state.hitCount }}"},
                   inner=slot("title", "<span>命中规模</span>") + slot("prefix") + slot("suffix", "<span>人</span>"))
    editor = comp("SqlEditor", "plasmic-antd6-textarea", PROJ_ANTD,
                  data={"value": SQL, "placeholder": "请输入只读 SELECT 语句"},
                  style="width:100%;min-height:220px;font-family:Menlo,monospace;font-size:13px")
    body = box(editor
               + alert("CheckAlert", "success", "校验通过 · 结果集含 uid + app_source") + checks + summary
               + table("PreviewTable", "{{ ({data: $state.sampleRows}) }}",
                       [column("SampleUidColumn", "UID", "id", None, ellipsis=True),
                        column("SampleRegColumn", "注册时间", "registerDate", 168),
                        column("SampleSourceColumn", "App来源", "appSource", 112),
                        column("SampleCreditColumn", "授信状态", "creditStatus", 120, display="custom",
                               render=comp("SampleCreditBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                           data={"status": "{{ {\"已授信\":\"success\",\"已拒绝\":\"error\",\"审批中\":\"processing\"}[row.creditStatus] }}",
                                                 "text": "{{ row.creditStatus }}"},
                                           inner=slot("children"))),
                        column("SampleLoanColumn", "借据状态", "loanStatus", 120, display="custom",
                               render=comp("SampleLoanBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                           data={"status": "{{ {\"结清\":\"default\",\"在贷\":\"processing\",\"逾期\":\"error\"}[row.loanStatus] }}",
                                                 "text": "{{ row.loanStatus }}"},
                                           inner=slot("children")))],
                       page_size=10, sizes=(10, 20, 50), scroll_x=900),
               gap=12)
    c = comp("SqlCard", "plasmic-antd6-card", PROJ_ANTD,
             data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
             inner=slot("title") + slot("extra", extra) + slot("cover") + slot("actions") +
                   slot("children", body))
    return c


CHECKS_LOCAL = [("CheckSyntaxItem", "语句合法性", ""), ("CheckSourceItem", "底表", ""),
                ("CheckRoleItem", "权限", ""), ("CheckColumnItem", "结果字段", ""),
                ("CheckFilterItem", "结尾过滤", "")]


def footer():
    return box(row('<span style="display:inline-flex;gap:12px;justify-content:flex-end">' +
                   button("SubmitButton", "提交", "primary") + button("SaveSqlButton", "保存 SQL") +
                   button("OnlineButton", "上线") + button("CancelButton", "取消") + "</span>",
                   gap=12), name="SelectorFooter")


def modal():
    body = box(
        '<div data-visible-if="{{ $state.preflightState === `running` }}" style="display:flex;align-items:center;gap:12px">'
        '<span>预跑进行中，请稍候</span></div>'
        + '<div data-visible-if="{{ $state.preflightState === `success` }}" style="width:100%">'
        + alert("PreflightSuccessAlert", "success", "预跑成功 · 命中规模 12,340 人") + "</div>"
        + '<div data-visible-if="{{ $state.preflightState === `failed` }}" style="width:100%">'
        + alert("PreflightFailedAlert", "error", "预跑失败：底表分区缺失") + "</div>", gap=12)
    return comp("PreflightModal", "plasmic-antd6-modal", PROJ_ANTD,
                data={"open": "{{ $state.preflightOpen }}", "width": "640"},
                inner=slot("trigger") + slot("title", span("PreflightTitle", "预跑结果")) +
                      slot("children", body) + slot("footer") + slot("closeIcon"))


def page_html():
    body = box(basic_card() + sql_card() + footer(), name="SelectorBody", gap=16)
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
    for name, vtype, value in (("sqlText", "text", SQL), ("sampleRows", "array", SAMPLE),
                               ("hitCount", "number", 12340), ("preflightOpen", "boolean", False),
                               ("preflightState", "text", "running"), ("validated", "boolean", False),
                               ("checkPassed", "boolean", False)):
        if '"%s"' % name in existing:
            continue
        print("state", name, rpc.op("createState", componentUuid=page_uuid, name=name,
                                    variableType=vtype, initialValue=value)["created"][0]["uuid"])
    if page and json.dumps(rpc.op("read", componentUuids=[page_uuid], view="tree", depth="all")).find("PreflightModal") > 0:
        print("already composed")
        return
    html = page_html()
    open(os.path.join(HERE, "page2.html"), "w", encoding="utf-8").write(html)
    res = rpc.op("insertHtml", componentUuid=page_uuid, html=html)
    print("insert", json.dumps(res, ensure_ascii=False)[:400])
    print(rpc.op("save"))
    print(page_uuid)


if __name__ == "__main__":
    main()
