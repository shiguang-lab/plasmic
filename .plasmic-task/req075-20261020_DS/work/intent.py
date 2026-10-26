"""Emit the planned Slot intent for a Page from its reviewed node inventory."""
import json, sys
sys.path.insert(0, '.')
import rpc

NAMES = json.load(open("component-names.json"))
CARD_PADDING = {"GroupListCard": "0 20px", "BasicInfoCard": "16px 20px", "SqlCard": "16px 20px",
                "OnetimeSqlCard": "16px 20px", "DetailCard": "0 20px", "ArchiveCard": "16px 20px"}
PROJECTS = {"eYLujTHmWfX9qEoQaFDSi4", "f3f4ju424PVNTAQPkwovrE",
            "vJfWZAFzStvt61gEWotC7k", "vuoraLeVbtw7rQTKJ6UKar"}


def emit(el, out, depth=0):
    pad = "  " * depth
    reg = el.get("registeredComponentUuid")
    if reg:
        name = NAMES.get(reg, reg)
        if name == "plasmic-antd6-card":
            pad_prop = CARD_PADDING.get(el.get("name"), "16px 20px")
            out.append('%s<plasmic-component data-plasmic-name="%s" data-plasmic-component="%s" '
                       'data-props=\'{"size":"medium","variant":"outlined","styles":{"body":{"padding":"%s"}}}\'>'
                       % (pad, el.get("name") or "Element", name, pad_prop))
            if not (el.get("slots") and any(x["name"] == "title" and (x.get("children") or []) for x in el.get("slots"))):
                out.append('%s  <slot name="title"></slot>' % pad)
        else:
            out.append('%s<plasmic-component data-plasmic-name="%s" data-plasmic-component="%s">'
                       % (pad, el.get("name") or "Element", name))
        if name == "plasmic-antd6-card":
            kids_all = {x["name"]: (x.get("children") or []) for x in (el.get("slots") or [])}
            first = None
            for x in (el.get("slots") or []):
                if x["name"] == "children" and (x.get("children") or []):
                    first = x["children"][0]
                    break
            if first is not None and NAMES.get(first.get("registeredComponentUuid")) == "plasmic-antd6-tabs":
                out.append('%s  <slot name="extra"></slot>' % pad)
        for s in el.get("slots") or []:
            kids = s.get("children") or []
            if not kids:
                continue
            if name == "plasmic-antd6-card" and s["name"] == "title" and not kids:
                continue
            out.append('%s  <slot name="%s">' % (pad, s["name"]))
            for k in kids:
                emit(k, out, depth + 2)
            out.append('%s  </slot>' % pad)
        out.append('%s</plasmic-component>' % pad)
    else:
        out.append('%s<div>' % pad)
        for s in el.get("slots") or []:
            for k in s.get("children") or []:
                emit(k, out, depth + 1)
        for k in el.get("children") or []:
            emit(k, out, depth + 1)
        out.append('%s</div>' % pad)


def main(page_uuid, path):
    tree = rpc.op("read", componentUuids=[page_uuid], view="tree", depth="all")["results"][0]
    out = ["<!-- Reviewed Slot intent for %s: components and direct Slots supplied. -->" % path]
    emit(tree["tree"], out)
    html = "\n".join(out)
    fn = "intent-%s.html" % path.strip("/").replace("/", "-")
    open(fn, "w", encoding="utf-8").write(html)
    print(fn, len(html))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
