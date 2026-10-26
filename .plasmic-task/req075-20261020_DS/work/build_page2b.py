#!/usr/bin/env python3
"""Rebuild /groups/selector with named containers only (gate-clean composition)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpc
from lib import *  # noqa

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = "YW4MQIakrQnt"
SQL = ("SELECT uid, app_source, register_date\n"
       "FROM cdm_mx_dim_customer_user_df\n"
       "WHERE register_date >= '2026-07-01'\n"
       "  AND app_source = 'TACO'\n"
       "LIMIT 1000")
SAMPLE = [{"id": "uid_%05d" % (1001 + i), "registerDate": "2026-07-%02d" % (1 + i),
           "appSource": ["TACO", "PESO"][i % 2],
           "creditStatus": ["已授信", "已拒绝", "审批中"][i % 3],
           "loanStatus": ["结清", "在贷", "逾期"][i % 3]} for i in range(12)]

FLEX3 = "flex:1 1 0;min-width:0"


def basic_card():
    def item(name, key, label, control, rules=None):
        data = {"name": key}
        if rules:
            data["rules"] = rules
        return comp(name, "plasmic-antd6-form-item", PROJ_ANTD, data=data,
                    style=FLEX3,
                    inner=slot("label", "<span>%s</span>" % label) + slot("children", control) +
                          slot("tooltip") + slot("description"))

    main = ('<div data-plasmic-name="BasicRowMain" style="display:flex;flex-direction:row;gap:16px;'
            'width:100%;min-width:0">' +
            item("NameItem", "name", "客群名称", input_("NameInput", "请输入客群名称"),
                 [{"ruleType": "required", "message": "请输入客群名称"}]) +
            item("RetentionItem", "retentionDays", "数据保存天数",
                 select_("RetentionSelect", [("3", "3 天"), ("7", "7 天"), ("30", "30 天"),
                                             ("60", "60 天"), ("180", "180 天"), ("0", "长期")])) +
            item("DeadlineItem", "produceDeadline", "产出截止时间",
                 comp("DeadlineTime", "plasmic-antd6-time-picker", PROJ_ANTD,
                      data={"value": "2026-08-19T18:00:00", "format": "HH:mm:ss"}),
                 [{"ruleType": "required", "message": "请选择产出截止时间"}]) +
            "</div>")
    mode = ('<div data-plasmic-name="BasicRowMode" style="display:flex;flex-direction:row;gap:16px;'
            'width:100%;min-width:0;margin-top:16px">' +
            item("RefreshItem", "refreshMode", "刷新模式",
                 select_("RefreshSelect", [("DYNAMIC", "T+1 动态")])) +
            item("TypeItem", "groupType", "客群类型",
                 comp("TypeInput", "plasmic-antd6-input", PROJ_ANTD,
                      data={"readOnly": True, "disabled": True})) +
            "</div>")
    form = comp("BasicForm", "plasmic-antd6-form", PROJ_ANTD,
                data={"mode": "advanced", "layout": "horizontal", "labelCol": {"flex": "120px"},
                      "formItems": []},
                inner=slot("children", main + mode) + slot("submitSlot"))
    return card("BasicInfoCard", form)


def sql_card():
    extra = ('<div data-plasmic-name="SqlCardActions" style="display:flex;flex-direction:row;'
             'align-items:center;gap:8px">' +
             button("FormatButton", "格式化") + button("ValidateButton", "校验") + "</div>")
    editor = comp("SqlEditor", "plasmic-antd6-textarea", PROJ_ANTD,
                  data={"value": SQL, "placeholder": "请输入只读 SELECT 语句"},
                  style="width:100%;min-height:220px;font-family:Menlo,monospace;font-size:13px")
    checks = descriptions("CheckDescriptions",
                          [(n, l, "<span>通过</span>") for n, l, _ in CHECKS], column=1)
    summary = comp("HitCountStatistic", "plasmic-antd6-statistic", PROJ_ANTD,
                   data={"value": "{{ $state.hitCount }}"},
                   inner=slot("title", "<span>命中规模</span>") + slot("prefix") +
                         slot("suffix", "<span>人</span>"))
    tbl = table("PreviewTable", "{{ ({data: $state.sampleRows}) }}",
                [column("SampleUidColumn", "UID", "id", None, ellipsis=True),
                 column("SampleRegColumn", "注册时间", "registerDate", 168),
                 column("SampleSourceColumn", "App来源", "appSource", 112),
                 column("SampleCreditColumn", "授信状态", "creditStatus", 120, display="custom",
                        render=comp("SampleCreditBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                    data={"status": "{{ [`success`,`error`,`processing`][[`已授信`,`已拒绝`,`审批中`].indexOf(row.creditStatus)] }}",
                                          "text": "{{ row.creditStatus }}"}, inner=slot("children"))),
                 column("SampleLoanColumn", "借据状态", "loanStatus", 120, display="custom",
                        render=comp("SampleLoanBadge", "plasmic-antd6-badge", PROJ_ANTD,
                                    data={"status": "{{ [`default`,`processing`,`error`][[`结清`,`在贷`,`逾期`].indexOf(row.loanStatus)] }}",
                                          "text": "{{ row.loanStatus }}"}, inner=slot("children")))],
                page_size=10, sizes=(10, 20, 50), scroll_x=900)
    body = ('<div data-plasmic-name="SqlCardBody" style="display:flex;flex-direction:column;gap:12px;'
            'width:100%;min-width:0">' + editor +
            alert("CheckAlert", "success", "校验通过 · 结果集含 uid + app_source") +
            checks + summary + tbl + "</div>")
    return comp("SqlCard", "plasmic-antd6-card", PROJ_ANTD,
                data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                inner=slot("title") + slot("extra", extra) + slot("cover") + slot("actions") +
                      slot("children", body))


def footer():
    return ('<div data-plasmic-name="SelectorFooter" style="display:flex;flex-direction:row;gap:12px;'
            'justify-content:flex-end;width:100%">' +
            button("SubmitButton", "提交", "primary") + button("SaveSqlButton", "保存 SQL") +
            button("OnlineButton", "上线") + button("CancelButton", "取消") + "</div>")


def modal():
    body = (alert("PreflightRunning", "info", "预跑进行中，请稍候") +
            alert("PreflightSuccessAlert", "success", "预跑成功 · 命中规模 12,340 人") +
            alert("PreflightFailedAlert", "error", "预跑失败：底表分区缺失"))
    return comp("PreflightModal", "plasmic-antd6-modal", PROJ_ANTD,
                data={"open": "{{ $state.preflightOpen }}", "width": "640"},
                inner=slot("trigger") + slot("title", span("PreflightTitle", "预跑结果")) +
                      slot("children", body) + slot("closeIcon"))


def page_html():
    body = ('<div data-plasmic-name="SelectorBody" style="display:flex;flex-direction:column;gap:16px;'
            'width:100%;min-width:0">' + basic_card() + sql_card() + footer() + modal() + "</div>")
    return shell(body)


CHECKS = [("CheckSyntaxItem", "语句合法性", ""), ("CheckSourceItem", "底表", ""),
          ("CheckRoleItem", "权限", ""), ("CheckColumnItem", "结果字段", ""),
          ("CheckFilterItem", "结尾过滤", "")]


def main():
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    import re
    m = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "AppShell"', tree)
    if m:
        rpc.op("deleteElement", componentUuid=PAGE, elementUuid=m.group(1))
        print("removed old shell")
    res = rpc.op("insertHtml", componentUuid=PAGE, html=page_html())
    print("inserted", json.dumps(res.get("messages"), ensure_ascii=False)[:300])
    tree = json.dumps(rpc.op("read", componentUuids=[PAGE], view="tree", depth="all"), ensure_ascii=False)
    def u(n):
        mm = re.search(r'"uuid": "([A-Za-z0-9_\-]{12})", "name": "%s"' % n, tree)
        return mm.group(1) if mm else None
    # modal state visibility
    for name, state in (("PreflightRunning", "running"), ("PreflightSuccessAlert", "success"),
                        ("PreflightFailedAlert", "failed")):
        uid = u(name)
        if uid:
            rpc.op("changeElement", componentUuid=PAGE, elementUuid=uid,
                   visibleIf="{{ $state.preflightState === `%s` }}" % state)
    # form initial values
    rpc.op("changeElement", componentUuid=PAGE, elementUuid=u("BasicForm"),
           props={"initialValues": {"name": "", "retentionDays": "3",
                                    "produceDeadline": "2026-08-19T18:00:00",
                                    "refreshMode": "DYNAMIC", "groupType": "常规"}})
    def inter(name, event, action, owner=None):
        uid = u(owner or name)
        if not uid:
            print("missing", name); return
        try:
            rpc.op("createInteraction", componentUuid=PAGE, elementUuid=uid, eventName=event,
                   name=name[0].lower() + name[1:] + "Action", action=action)
            print("interaction", name)
        except Exception as e:
            print("ERR", name, str(e)[:120])
    inter("ValidateButton", "onClick", {"actionName": "customFunction",
          "code": "const ok = $state.sqlText.indexOf(`SELECT`) === 0;"
                  "$state.validated = ok; $state.checkPassed = ok;"
                  "$globalActions[\"plasmic-antd6-config-provider.showMessage\"](ok ? \"success\" : \"error\","
                  " ok ? \"校验通过\" : \"校验失败\", 3);"})
    inter("FormatButton", "onClick", {"actionName": "customFunction",
          "code": "$state.sqlText = $state.sqlText.trim();"})
    inter("SubmitButton", "onClick", {"actionName": "customFunction",
          "code": "$state.preflightOpen = true; $state.preflightState = `running`;"})
    inter("CancelButton", "onClick", {"actionName": "navigation", "destination": "/groups"})
    inter("SaveSqlButton", "onClick", {"actionName": "navigation", "destination": "/groups"})
    inter("OnlineButton", "onClick", {"actionName": "navigation", "destination": "/groups"})
    inter("PreflightModal", "onCancel", {"actionName": "customFunction",
          "code": "$state.preflightOpen = false;"})
    print(rpc.op("save"))


if __name__ == "__main__":
    main()
