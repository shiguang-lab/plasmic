#!/usr/bin/env python3
"""Compose /groups/onetime-create (一次性客群建群页)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE_PATH = "/groups/onetime-create"
PAGE_NAME = "新建一次性客群"

SQL = ("SELECT uid, app_source, register_date\n"
       "FROM cdm_mx_dim_customer_user_df\n"
       "WHERE register_date >= '2026-07-01'\n"
       "  AND app_source = 'TACO'\n"
       "LIMIT 1000")
SAMPLE = [{"id": "uid_%05d" % (2001 + i), "registerDate": "2026-07-%02d" % (1 + i),
           "appSource": ["TACO", "PESO"][i % 2]} for i in range(12)]

BASIC = [("BasicNameItem", "客群名称", "存量促活-7月客群"),
         ("BasicKeyItem", "客群Key", "GRP_ONETIME_CUNLIANG7YUE_20260820"),
         ("BasicTypeItem", "客群类型", "一次性"),
         ("BasicScenarioItem", "业务场景", "客经"),
         ("BasicOwnerItem", "负责人", "傅玮颖"),
         ("BasicSourceItem", "App来源", "TACO（入口带入）")]


def steps():
    return comp("CreateSteps", "plasmic-antd6-steps", PROJ_ANTD,
                data={"current": 1, "size": "small",
                      "items": [{"title": "填写SQL校验"}, {"title": "提交自动预跑"}, {"title": "保存SQL"},
                                {"title": "上线圈选"}, {"title": "启用生效"}]})


def basic_card():
    items = "".join(comp(n, "plasmic-antd6-descriptions-item", PROJ_ANTD, data={"key": n},
                         inner=slot("label", "<span>%s</span>" % l) + slot("children", "<span>%s</span>" % v))
                    for n, l, v in BASIC)
    desc = comp("BasicDescriptions", "plasmic-antd6-descriptions", PROJ_ANTD,
                data={"column": 3, "layout": "horizontal", "size": "medium"},
                inner=slot("title") + slot("children", items))
    form = comp("SourceForm", "plasmic-antd6-form", PROJ_ANTD,
                data={"mode": "advanced", "layout": "horizontal", "labelCol": {"flex": "96px"},
                      "formItems": []},
                inner=slot("children", row(
                    cell(form_item("SourceItem", "source", "客群来源",
                                   comp("SourceRadio", "plasmic-antd6-radio-group", PROJ_ANTD,
                                        data={"options": [{"value": "SQL", "label": "写SQL"}],
                                              "defaultValue": "SQL"}))
                         + form_item("ExpireItem", "expireDays", "有效期",
                                     comp("ExpireInput", "plasmic-antd6-input-number", PROJ_ANTD,
                                          data={"value": 14, "min": 1, "max": 365}),
                                     [{"ruleType": "required", "message": "请输入有效期天数"}]),
                         "calc(50% - 8px)"))) + slot("submitSlot"))
    return card("BasicInfoCard", desc + form)


def sql_card():
    extra = ('<div style="display:flex;flex-direction:row;align-items:center;gap:8px;width:100%">' +
             button("OnetimeFormatButton", "格式化") + button("OnetimeValidateButton", "校验") + "</div>")
    editor = comp("OnetimeSqlEditor", "plasmic-antd6-textarea", PROJ_ANTD,
                  data={"value": SQL, "placeholder": "请输入只读 SELECT 语句"},
                  style="width:100%;min-height:220px;font-family:Menlo,monospace;font-size:13px")
    hit = comp("OnetimeHitCount", "plasmic-antd6-statistic", PROJ_ANTD,
               data={"value": "{{ $state.hitCount }}"},
               inner=slot("title", "<span>命中规模</span>") + slot("prefix") + slot("suffix", "<span>人</span>"))
    tbl = table("OnetimePreviewTable", "{{ ({data: $state.sampleRows}) }}",
                [column("OnetimeUidColumn", "UID", "id", None, ellipsis=True),
                 column("OnetimeRegColumn", "注册时间", "registerDate", 168),
                 column("OnetimeSourceColumn", "App来源", "appSource", 112)],
                page_size=10, sizes=(10, 20, 50), scroll_x=760)
    body = box(editor + alert("OnetimeCheckAlert", "success", "校验通过 · 结果集含 uid + app_source") +
               hit + tbl, gap=12)
    return comp("OnetimeSqlCard", "plasmic-antd6-card", PROJ_ANTD,
                data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                inner=slot("title") + slot("extra", extra) + slot("cover") + slot("actions") +
                      slot("children", body))


def footer():
    return ('<div style="display:flex;flex-direction:row;gap:12px;justify-content:flex-end;width:100%">' +
            button("OnetimeSubmitButton", "提交", "primary") + button("OnetimeSaveSqlButton", "保存 SQL") +
            button("OnetimeOnlineButton", "上线") + button("OnetimeCancelButton", "取消") + "</div>")


def modal():
    body = box(
        '<div data-visible-if="{{ $state.preflightState === `running` }}" style="display:flex;align-items:center;gap:12px">'
        '<span>预跑进行中，请稍候</span></div>'
        + '<div data-visible-if="{{ $state.preflightState === `success` }}" style="width:100%">'
        + alert("OnetimePreflightSuccess", "success", "预跑成功 · 命中规模 12,340 人") + "</div>"
        + '<div data-visible-if="{{ $state.preflightState === `failed` }}" style="width:100%">'
        + alert("OnetimePreflightFailed", "error", "预跑失败：底表分区缺失") + "</div>", gap=12)
    return comp("OnetimePreflightModal", "plasmic-antd6-modal", PROJ_ANTD,
                data={"open": "{{ $state.preflightOpen }}", "width": "640"},
                inner=slot("trigger") + slot("title", span("OnetimePreflightTitle", "预跑结果")) +
                      slot("children", body) + slot("footer") + slot("closeIcon"))


def page_html():
    body = box(steps() + basic_card() + sql_card() + footer() + modal(), name="OnetimeBody", gap=16)
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
                               ("preflightState", "text", "running"), ("validated", "boolean", False)):
        if '"%s"' % name in existing:
            continue
        print("state", name, rpc.op("createState", componentUuid=page_uuid, name=name,
                                    variableType=vtype, initialValue=value)["created"][0]["uuid"])
    html = page_html()
    open(os.path.join(HERE, "page4.html"), "w", encoding="utf-8").write(html)
    res = rpc.op("insertHtml", componentUuid=page_uuid, html=html)
    print("messages", json.dumps(res.get("messages"), ensure_ascii=False)[:300])
    print(rpc.op("save"))
    print("PAGE", page_uuid)


if __name__ == "__main__":
    main()
