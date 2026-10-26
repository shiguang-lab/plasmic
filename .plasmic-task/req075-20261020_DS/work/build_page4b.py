#!/usr/bin/env python3
"""Rebuild /groups/onetime-create with named containers only."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

PAGE = "cVcKW-ucQxXU"
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
FLEX2 = "flex:1 1 0;min-width:0"


def steps():
    return comp("CreateSteps", "plasmic-antd6-steps", PROJ_ANTD,
                data={"current": 0, "size": "small",
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
                      "formItems": [],
                      "initialValues": {"source": "SQL", "expireDays": 14}},
                inner=slot("children",
                           '<div data-plasmic-name="SourceRow" style="display:flex;flex-direction:row;gap:16px;'
                           'width:100%;min-width:0">' +
                           comp("SourceItem", "plasmic-antd6-form-item", PROJ_ANTD,
                                data={"name": "source"}, style=FLEX2,
                                inner=slot("label", "<span>客群来源</span>") +
                                      slot("children", comp("SourceRadio", "plasmic-antd6-radio-group", PROJ_ANTD,
                                                            data={"options": [{"value": "SQL", "label": "写SQL"}],
                                                                  "defaultValue": "SQL"})) +
                                      slot("tooltip") + slot("description")) +
                           comp("ExpireItem", "plasmic-antd6-form-item", PROJ_ANTD,
                                data={"name": "expireDays",
                                      "rules": [{"ruleType": "required", "message": "请输入有效期天数"}]},
                                style=FLEX2,
                                inner=slot("label", "<span>有效期</span>") +
                                      slot("children", comp("ExpireInput", "plasmic-antd6-input-number", PROJ_ANTD,
                                                            data={"min": 1, "max": 365})) +
                                      slot("tooltip") + slot("description")) +
                           "</div>") + slot("submitSlot"))
    return card("BasicInfoCard", desc + '<div style="height:16px"></div>' + form)


def sql_card():
    extra = ('<div data-plasmic-name="OnetimeSqlActions" style="display:flex;flex-direction:row;'
             'align-items:center;gap:8px">' +
             button("OnetimeFormatButton", "格式化") + button("OnetimeValidateButton", "校验") + "</div>")
    editor = comp("OnetimeSqlEditor", "plasmic-antd6-textarea", PROJ_ANTD,
                  data={"value": "{{ $state.sqlText }}", "placeholder": "请输入只读 SELECT 语句"},
                  style="width:100%;min-height:220px;font-family:Menlo,monospace;font-size:13px")
    hit = comp("OnetimeHitCount", "plasmic-antd6-statistic", PROJ_ANTD,
               data={"value": "{{ $state.hitCount }}"},
               inner=slot("title", "<span>命中规模</span>") + slot("prefix") +
                     slot("suffix", "<span>人</span>"))
    tbl = table("OnetimePreviewTable",
                "{{ ({data: $state.sampleRows.filter(r => r.appSource===$state.appSource)}) }}",
                [column("OnetimeUidColumn", "UID", "id", None, ellipsis=True),
                 column("OnetimeRegColumn", "注册时间", "registerDate", 168),
                 column("OnetimeSourceColumn", "App来源", "appSource", 112)],
                page_size=10, sizes=(10, 20, 50), scroll_x=760)
    body = ('<div data-plasmic-name="OnetimeSqlBody" style="display:flex;flex-direction:column;gap:12px;'
            'width:100%;min-width:0">' + editor +
            alert("OnetimeCheckAlert", "success", "校验通过") + hit + tbl + "</div>")
    return comp("OnetimeSqlCard", "plasmic-antd6-card", PROJ_ANTD,
                data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                inner=slot("title") + slot("extra", extra) + slot("cover") + slot("actions") +
                      slot("children", body))


def footer():
    return ('<div data-plasmic-name="OnetimeFooter" style="display:flex;flex-direction:row;gap:12px;'
            'justify-content:flex-end;width:100%">' +
            button("OnetimeSubmitButton", "提交", "primary") + button("OnetimeSaveSqlButton", "保存 SQL") +
            button("OnetimeOnlineButton", "上线") + button("OnetimeCancelButton", "取消") + "</div>")


def modal():
    body = (alert("OnetimePreflightRunning", "info", "预跑进行中，请稍候") +
            alert("OnetimePreflightSuccess", "success", "预跑成功 · 命中规模 12,340 人") +
            alert("OnetimePreflightFailed", "error", "预跑失败：底表分区缺失"))
    return comp("OnetimePreflightModal", "plasmic-antd6-modal", PROJ_ANTD,
                data={"open": "{{ $state.preflightOpen }}", "width": "640"},
                inner=slot("trigger") + slot("title", span("OnetimePreflightTitle", "预跑结果")) +
                      slot("children", body) + slot("closeIcon"))


def page_html():
    body = ('<div data-plasmic-name="OnetimeBody" style="display:flex;flex-direction:column;gap:16px;'
            'width:100%;min-width:0">' + steps() + basic_card() + sql_card() + footer() + modal() + "</div>")
    return shell(body)


def main():
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    m = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "AppShell"', tree)
    if m:
        rpc.op("deleteElement", componentUuid=PAGE, elementUuid=m.group(1))
        print("removed shell")
    res = rpc.op("insertHtml", componentUuid=PAGE, html=page_html())
    print("messages", json.dumps(res.get("messages"), ensure_ascii=False)[:200])
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    def u(n):
        mm = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "%s"' % n, tree)
        return mm.group(1) if mm else None
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=tree and u("Steps") or None) if False else None
    # page root + appSource state/binding
    root = rpc.op("read", componentUuids=[PAGE], view="tree", depth="all")["results"][0]["rootElementUuid"]
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=root, name="OnetimePage")
    st = json.dumps(rpc.op("read", componentUuids=[PAGE], view="context", depth=1), ensure_ascii=False)
    if '"name": "appSource"' not in st:
        rpc.op("createState", componentUuid=PAGE, name="appSource", variableType="text", initialValue="TACO")
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=u("AppShell"),
           props={"appSource": "{{ $state.appSource }}"})
    for name, state in (("OnetimePreflightRunning", "running"), ("OnetimePreflightSuccess", "success"),
                        ("OnetimePreflightFailed", "failed")):
        rpc.op("changeElement", componentUuid=PAGE, elementUuid=u(name),
               visibleIf="{{ $state.preflightState === `%s` }}" % state)
    def inter(el, event, action, name):
        uid = u(el)
        if not uid:
            print("missing", el); return
        rpc.op("createInteraction", componentUuid=PAGE, elementUuid=uid, eventName=event, name=name, action=action)
        print("interaction", name)
    inter("AppShell", "onAppSourceChange", {"actionName": "customFunction",
          "code": "$state.appSource = value;"}, "syncAppSource")
    inter("SourceForm", "onFinish", {"actionName": "customFunction",
          "code": "$globalActions[\"plasmic-antd6-config-provider.showMessage\"](\"success\", \"基本信息已保存\", 3);"},
          "saveBasicInfo")
    inter("OnetimeValidateButton", "onClick", {"actionName": "customFunction",
          "code": "const ok = $state.sqlText.indexOf(`SELECT`) === 0; $state.validated = ok;"
                  "$globalActions[\"plasmic-antd6-config-provider.showMessage\"](ok ? \"success\" : \"error\","
                  " ok ? \"校验通过\" : \"校验失败\", 3);"}, "validateSql")
    inter("OnetimeFormatButton", "onClick", {"actionName": "customFunction",
          "code": "$state.sqlText = $state.sqlText.trim();"}, "formatSql")
    inter("OnetimeSqlEditor", "onChange", {"actionName": "customFunction",
          "code": "$state.sqlText = event && event.target ? event.target.value : event;"}, "trackSqlText")
    inter("OnetimeSubmitButton", "onClick", {"actionName": "customFunction",
          "code": "$state.preflightOpen = true; $state.preflightState = `running`;"
                  "$globalActions[\"plasmic-antd6-config-provider.showMessage\"](\"success\", \"已提交预跑\", 3);"},
          "startPreflight")
    for b in ("OnetimeSaveSqlButton", "OnetimeOnlineButton", "OnetimeCancelButton"):
        inter(b, "onClick", {"actionName": "navigation", "destination": "/groups"}, b[0].lower() + b[1:] + "Go")
    inter("OnetimePreflightModal", "onCancel", {"actionName": "customFunction",
          "code": "$state.preflightOpen = false;"}, "closePreflight")
    inter("OnetimePreflightModal", "onOk", {"actionName": "customFunction",
          "code": "$state.preflightOpen = false;"}, "confirmPreflight")
    print(rpc.op("save"))


if __name__ == "__main__":
    main()
