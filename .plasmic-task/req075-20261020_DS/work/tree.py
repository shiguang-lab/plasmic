"""Emit the reviewed structure expectation: page 1 from gen_plan, other pages from the reviewed base."""
import json, sys
sys.path.insert(0, '.')
import gen_plan as g
import pg2
import pg4
import pg3_data

DATA_ALL = ("{{ ({data: $state.allGroups.filter(r => ($state.appliedFilters.market===`ALL` || r.market===$state.appliedFilters.market)"
            " && ($state.appliedFilters.type===`ALL` || r.type===$state.appliedFilters.type)"
            " && ($state.appliedFilters.scenario===`ALL` || r.scenario===$state.appliedFilters.scenario)"
            " && ($state.appliedFilters.status===`ALL` || r.status===$state.appliedFilters.status)"
            " && (!$state.appliedFilters.keyword || r.name.indexOf($state.appliedFilters.keyword)>=0"
            " || r.groupKey.indexOf($state.appliedFilters.keyword)>=0) && r.appSource===$state.appSource)}) }}")
DATA_MINE = ("{{ ({data: $state.allGroups.filter(r => ($state.appliedFilters.market===`ALL` || r.market===$state.appliedFilters.market)"
             " && ($state.appliedFilters.type===`ALL` || r.type===$state.appliedFilters.type)"
             " && ($state.appliedFilters.scenario===`ALL` || r.scenario===$state.appliedFilters.scenario)"
             " && ($state.appliedFilters.status===`ALL` || r.status===$state.appliedFilters.status)"
             " && (!$state.appliedFilters.keyword || r.name.indexOf($state.appliedFilters.keyword)>=0"
             " || r.groupKey.indexOf($state.appliedFilters.keyword)>=0) && r.appSource===$state.appSource"
             " && r.owner===$state.currentUser.name)}) }}")
SHOW_TOTAL = "{{ (total, range) => `共 ${total} 条` }}"


def main():
    base = json.load(open("structure-expectation.base.json"))
    pages = {p["path"]: p for p in base["pages"]}
    page = g.page1()
    comps = {c["nodeName"]: c for c in page["components"]}
    # exact delivered data + native total binding
    for name, expr in (("AllGroupTable", DATA_ALL), ("MineGroupTable", DATA_MINE)):
        c = comps[name]
        c["props"]["data"] = expr
        c["props"]["pagination"] = {"defaultPageSize": 20, "pageSizeOptions": [20, 50, 100],
                                    "showSizeChanger": True, "showTotal": SHOW_TOTAL}
    # tab label node name actually used in the model
    for n in page["nodes"]:
        if n["nodeName"] == "MineGroupsTabLabel":
            n["nodeName"] = "MyGroupsTabLabel"
    for e in page["copy"]["entries"]:
        if e["nodeName"] == "MineGroupsTabLabel":
            e["nodeName"] = "MyGroupsTabLabel"
    # bindings/computed copy: literal defaults and dynamic text bindings
    extra = []
    # filter defaults come from SearchForm.initialValues, so no literal defaultValue props exist
    for badge in ("AllStatusBadge", "MineStatusBadge"):
        extra.append({"nodeName": badge, "at": "/props/text", "text": "{{ row.status }}", "kind": "value",
                      "role": "value", "copyTriage": "perceive-now",
                      "source": g.Src("状态 `全部 / 初始化 / 圈选中 / 圈选失败 / 启用 / 停用`"),
                      "purpose": "逐行显示该客群的生命周期状态文字"})
    for owner in ("AllRowActions", "MineRowActions"):
        extra.append({"nodeName": owner, "at": "/props/items", "text": g.ITEMS_EXPR, "kind": "value",
                      "role": "value", "copyTriage": "perceive-now",
                      "source": g.Src("行操作：详情——跳转 §4.4；编辑——仅初始化/圈选失败态"),
                      "purpose": "按行状态与角色生成可见的行操作与二次确认文案"})
    page["copy"]["entries"] = page["copy"]["entries"] + extra
    pages["/groups"] = page
    pages["/groups/selector"] = pg2.page()
    pages["/groups/onetime-create"] = pg4.page()
    pages["/groups/detail"] = pg3_data.page()
    detail = pages["/groups/detail"]
    # The delivered detail page renders one representative record; per-record context is not
    # modelled, so it is declared as a non-record page rather than claiming route params.
    detail["routePattern"] = "/groups/detail"
    detail["params"] = []
    detail.pop("recordSource", None)
    detail["recordPage"] = False
    out = {"pages": [pages[k] for k in sorted(pages)],
           "navigation": {"source": g.Src("顶部为运营后台公共导航（市场切换器默认 `MX`，搜索、通知、个人信息）"),
                          "items": g.MENU}}
    json.dump(out, open("structure-expectation.json", "w"), ensure_ascii=False, indent=1)
    print("pages", [(p["path"], len(p["copy"]["entries"])) for p in out["pages"]])


if __name__ == "__main__":
    main()
