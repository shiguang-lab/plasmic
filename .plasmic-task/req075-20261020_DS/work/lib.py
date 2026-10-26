"""Shared markup helpers for the REQ075 prototype pages."""
import json

PROJ_ANTD = "eYLujTHmWfX9qEoQaFDSi4"
PROJ_OVER = "f3f4ju424PVNTAQPkwovrE"
PROJ_ICON = "vuoraLeVbtw7rQTKJ6UKar"
PROJ_RUI = "vJfWZAFzStvt61gEWotC7k"

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

APP_SOURCES = [{"value": "TACO", "label": "TACO"}, {"value": "PESO", "label": "PESO"}]
SCENARIOS = ["获客", "风险", "客经", "贷后", "公共"]
OWNERS = ["傅玮颖", "陈晓", "李明", "王晓"]


def props(obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return raw.replace("&", "&amp;").replace("'", "&#39;")


def comp(name, registration, project, data=None, inner=None, style=None):
    attrs = ['data-plasmic-name="%s"' % name, 'data-plasmic-component="%s"' % registration,
             'data-plasmic-project="%s"' % project]
    if data is not None:
        attrs.append("data-props='%s'" % props(data))
    if style:
        attrs.append('style="%s"' % style)
    return "<plasmic-component %s>%s</plasmic-component>" % (" ".join(attrs), inner or "")


def slot(name, inner=""):
    return '<slot name="%s">%s</slot>' % (name, inner)


def span(name, text):
    return '<span data-plasmic-name="%s">%s</span>' % (name, text)


def icon(name, glyph, size=16):
    return comp(name, "plasmic-antd-icon-%s" % glyph, PROJ_ICON, inner="",
                style="font-size:%dpx;color:currentColor" % size)


def button(name, label, kind="default", icon_glyph=None, icon_end=False):
    data = {"type": kind, "iconPlacement": "end" if icon_end else "start"}
    inner = slot("children", '<span>%s</span>' % label)
    if icon_glyph:
        inner = slot("icon", icon(name + "Icon", icon_glyph)) + inner
    else:
        inner = slot("icon") + inner
    return comp(name, "plasmic-antd6-button", PROJ_ANTD, data=data, inner=inner)


def card(name, inner, padding="16px 20px", data=None):
    d = {"size": "medium", "variant": "outlined", "styles": {"body": {"padding": padding}}}
    if data:
        d.update(data)
    return comp(name, "plasmic-antd6-card", PROJ_ANTD, data=d,
                inner=slot("title") + slot("extra") + slot("cover") + slot("actions") + slot("children", inner))


def titled_card(name, title, inner):
    return comp(name, "plasmic-antd6-card", PROJ_ANTD,
                data={"size": "medium", "variant": "outlined", "styles": {"body": {"padding": "16px 20px"}}},
                inner=slot("title", '<span>%s</span>' % title) + slot("extra") + slot("cover") +
                      slot("actions") + slot("children", inner))


def row(inner, gap=16, name=None):
    nm = ' data-plasmic-name="%s"' % name if name else ""
    return ('<div%s style="display:flex;flex-direction:row;gap:%dpx;width:100%%;min-width:0;flex-wrap:wrap">%s</div>'
            % (nm, gap, inner))


def box(inner, name=None, direction="column", gap=0, style=""):
    nm = ' data-plasmic-name="%s"' % name if name else ""
    return ('<div%s style="display:flex;flex-direction:%s;gap:%dpx;width:100%%;min-width:0;%s">%s</div>'
            % (nm, direction, gap, style, inner))


def cell(inner, basis="33%"):
    return ('<div style="flex:1 1 %s;min-width:0;display:flex;flex-direction:column">%s</div>' % (basis, inner))


def form_item(name, key, label, control, rules=None):
    data = {"name": key}
    if rules:
        data["rules"] = rules
    return comp(name, "plasmic-antd6-form-item", PROJ_ANTD, data=data,
                inner=slot("label", '<span>%s</span>' % label) + slot("children", control) +
                      slot("tooltip") + slot("description"))


def input_(name, placeholder=None, value=None, readonly=False, disabled=False, allow_clear=False):
    d = {}
    if placeholder:
        d["placeholder"] = placeholder
    if value is not None:
        d["value"] = value
    if readonly:
        d["readOnly"] = True
    if disabled:
        d["disabled"] = True
    if allow_clear:
        d["allowClear"] = True
    return comp(name, "plasmic-antd6-input", PROJ_ANTD, data=d)


def textarea(name, placeholder=None, value=None, autosize=True):
    d = {"autoSize": autosize}
    if placeholder:
        d["placeholder"] = placeholder
    if value is not None:
        d["value"] = value
    return comp(name, "plasmic-antd6-textarea", PROJ_ANTD, data=d)


def select_(name, options, default=None, placeholder=None, show_search=False):
    d = {"options": [{"value": v, "label": l} for v, l in options]}
    if default is not None:
        d["defaultValue"] = default
    if show_search:
        d["showSearch"] = True
    inner = slot("placeholder", placeholder) if placeholder else slot("placeholder")
    return comp(name, "plasmic-antd6-select", PROJ_ANTD, data=d, inner=inner)


def input_number(name, default, minimum=None, maximum=None):
    d = {"value": default}
    if minimum is not None:
        d["min"] = minimum
    if maximum is not None:
        d["max"] = maximum
    return comp(name, "plasmic-antd6-input-number", PROJ_ANTD, data=d)


def time_picker(name, default):
    return comp(name, "plasmic-antd6-time-picker", PROJ_ANTD, data={"value": default, "format": "HH:mm:ss"})


def alert(name, type_="success", title="", inner=None):
    return comp(name, "plasmic-antd6-alert", PROJ_ANTD,
                data={"type": type_, "showIcon": True},
                inner=slot("title", '<span>%s</span>' % title if title else "") + slot("description", inner or ""))


def descriptions(name, items, column=2, title=None):
    inner = []
    for i, (item_name, label, content) in enumerate(items):
        inner.append(comp(item_name, "plasmic-antd6-descriptions-item", PROJ_ANTD,
                          data={"key": item_name},
                          inner=slot("label", '<span>%s</span>' % label) + slot("children", content)))
    return comp(name, "plasmic-antd6-descriptions", PROJ_ANTD,
                data={"column": column, "layout": "horizontal", "size": "medium", "bordered": False},
                inner=(slot("title", '<span>%s</span>' % title) if title else slot("title")) +
                      slot("children", "".join(inner)))


def column(name, title, data_index=None, width=None, display="text", ellipsis=False, render=None, fixed=None):
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


def table(name, data, columns, page_size=20, sizes=(20, 50, 100), scroll_x=1140):
    data_prop = data if isinstance(data, str) else {"data": {"data": data}}
    d = {"data": data_prop, "rowKey": "id", "size": "large",
         "pagination": {"defaultPageSize": page_size, "pageSizeOptions": list(sizes), "showSizeChanger": True},
         "scroll": {"x": scroll_x}}
    return comp(name, "plasmic-antd6-table", PROJ_ANTD, data=d,
                inner=slot("children", "".join(columns)) + slot("title"), style="width:100%;min-width:0")


def shell(inner):
    return comp("AppShell", "plasmic-overseas-app-shell", PROJ_OVER,
                data={"productName": "海外客群管理平台", "menuItems": MENU, "appSource": "TACO",
                      "appSources": APP_SOURCES},
                inner=slot("children", inner))
