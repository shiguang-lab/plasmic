"""Derive the Form, Descriptions and overlay inventories and the Slot intent from a Page plan.

The plan (structure-expectation.json) already records every functional instance,
its owner Slot, native props, text nodes and UI copy. Writing the same facts again
in four more files invites drift, so these drafts are derived mechanically.
Values the plan cannot decide stay "__DECIDE__" (for example a measured label
width or whether a footer action performs business work); gates reject them
until they are decided. The drafts are generation inputs reviewed like the plan;
they never read the saved model, so they cannot be fitted to the output.
"""
import json
import re
from copy import deepcopy
from html import escape
from urllib.parse import quote

PENDING = '__DECIDE__'
FORM = 'plasmicantd6form'
FORM_ITEM = 'plasmicantd6formitem'
ROW, COL = 'plasmicantd6row', 'plasmicantd6col'
DESCRIPTIONS, DESCRIPTIONS_ITEM = 'plasmicantd6descriptions', 'plasmicantd6descriptionsitem'
MODAL, DRAWER = 'plasmicantd6modal', 'plasmicantd6drawer'
BUTTON = 'plasmicantd6button'
SEARCH_FORM = 'plasmicoverseassearchform'
CARD = 'plasmicantd6card'
FIELD_CONTROLS = {
    'plasmicantd6input', 'plasmicantd6textarea', 'plasmicantd6inputpassword', 'plasmicantd6inputnumber',
    'plasmicantd6select', 'plasmicantd6treeselect', 'plasmicantd6cascader', 'plasmicantd6datepicker',
    'plasmicantd6daterangepicker', 'plasmicantd6rangepicker', 'plasmicantd6timepicker', 'plasmicantd6checkbox',
    'plasmicantd6checkboxgroup', 'plasmicantd6radiogroup', 'plasmicantd6switch', 'plasmicantd6slider',
    'plasmicantd6autocomplete', 'plasmicantd6upload', 'plasmicantd6segmented'}


def norm(value):
    return re.sub(r'[^a-z0-9]', '', str(value or '').lower())


class PagePlan:
    """Owner/Slot graph of one planned Page: components, native nodes and copy."""

    def __init__(self, page):
        self.page = page
        self.specs = [c for c in page.get('components', []) if isinstance(c, dict) and isinstance(c.get('nodeName'), str)]
        self.nodes = [n for n in page.get('nodes', []) if isinstance(n, dict) and isinstance(n.get('nodeName'), str)]
        self.by_name = {c['nodeName']: c for c in self.specs}
        self.node_by_name = {n['nodeName']: n for n in self.nodes}
        copy = page.get('copy') if isinstance(page.get('copy'), dict) else {}
        self.copy = [e for e in copy.get('entries', []) if isinstance(e, dict)]
        self.text = {e['nodeName']: e['text'] for e in self.copy
                     if isinstance(e, dict) and e.get('at') == '/text' and isinstance(e.get('text'), str)}
        self.order = {name: i for i, name in enumerate([*self.by_name, *self.node_by_name])}

    def owner(self, name):
        entry = self.by_name.get(name) or self.node_by_name.get(name) or {}
        owner = entry.get('owner')
        return (owner.get('nodeName'), owner.get('slot')) if isinstance(owner, dict) else (None, None)

    def children(self, name, slot=None):
        """Direct components and nodes owned by name (in one Slot when given), in plan order."""
        items = [n for n in [*self.by_name, *self.node_by_name]
                 if self.owner(n)[0] == name and (slot is None or self.owner(n)[1] == slot)]
        return sorted(items, key=self.order.get)

    def ancestors(self, name):
        seen, current = [], self.owner(name)[0]
        while current and current not in seen:
            seen.append(current)
            current = self.owner(current)[0]
        return seen

    def kind(self, name):
        return norm(self.by_name.get(name, {}).get('component'))

    def props(self, name):
        values = self.by_name.get(name, {}).get('props')
        return values if isinstance(values, dict) else {}

    def slot_text(self, name, slot):
        """Copy text of the native text nodes in a Slot, joined; None when the Slot has none."""
        texts = [self.text[n] for n in self.children(name, slot) if n in self.text]
        return ' '.join(texts) if texts else None

    def slot_copy(self, name, slot):
        children = set(self.descendants(name, slot))
        return [e for e in self.copy if e.get('nodeName') in children and e.get('at') == '/text'
                or e.get('nodeName') == name and e.get('at') in (f'/slots/{slot}/text', f'/props/{slot}')]

    def descendants(self, name, slot=None):
        result = []
        for child in self.children(name, slot):
            result.append(child)
            result.extend(self.descendants(child))
        return result


# Planning estimate of an Ant Design horizontal label at the 14px theme size
# (form-layout.md#columns-and-label-width); the rendered measurement replaces it.
WIDE_CHAR_PX, NARROW_CHAR_PX = 14, 8
REQUIRED_MARK_PX, COLON_PX, HELP_ICON_PX, LABEL_PADDING_PX = 11, 14, 18, 8


def label_px(label):
    import unicodedata
    return sum(WIDE_CHAR_PX if unicodedata.east_asian_width(c) in ('W', 'F') else NARROW_CHAR_PX for c in str(label))


def required(field):
    return any(isinstance(rule, dict) and (rule.get('ruleType') == 'required' or rule.get('required') is True)
               for rule in field.get('rules', []))


def estimated_label_px(fields):
    """Widest label + required mark + colon + help icon + 8px padding, rounded up to 4px."""
    widths = [label_px(f['label']) + (REQUIRED_MARK_PX if required(f) else 0) + COLON_PX
              + (HELP_ICON_PX if f.get('tooltip') else 0) + LABEL_PADDING_PX for f in fields]
    widest = max(widths) if widths else 0
    return -(-widest // 4) * 4


def form_inventory(plan):
    form_kinds = {FORM, SEARCH_FORM}
    pages = []
    for page in plan.get('pages', []):
        graph = PagePlan(page)
        forms = []
        for form in [n for n in graph.by_name if graph.kind(n) == FORM]:
            props = graph.props(form)
            declaration = graph.by_name[form]
            items = [n for n in graph.descendants(form) if graph.kind(n) == FORM_ITEM
                     and (isinstance(graph.props(n).get('name'), str)
                          or any(graph.kind(c) in FIELD_CONTROLS for c in graph.children(n, 'children')))]
            overlay = next((a for a in graph.ancestors(form) if graph.kind(a) in (MODAL, DRAWER)), None)
            in_overlay = overlay is not None
            fields, spans, units = [], {}, []
            for item in items:
                values = graph.props(item)
                item_spec = graph.by_name[item]
                controls = [n for n in graph.children(item, 'children') if n in graph.by_name]
                field = {'nodeName': item, 'name': values.get('name') or PENDING,
                         'label': graph.slot_text(item, 'label') or values.get('label') or PENDING,
                         'control': controls[0] if controls else PENDING,
                         'rules': deepcopy(values.get('rules') if values.get('rules') is not None else [])}
                for slot in ('tooltip', 'description'):
                    text = graph.slot_text(item, slot) or values.get(slot)
                    if text:
                        field[slot] = text
                for key in ('copyTriage', 'excludedCopy', 'controlWidthReason', 'description',
                            'descriptionPlacement', 'descriptionNode'):
                    if key in item_spec:
                        field[key] = deepcopy(item_spec[key])
                if 'validateFirst' in values:
                    field['validateFirst'] = values['validateFirst']
                for slot in ('tooltip', 'description'):
                    if not field.get(slot):
                        continue
                    copies = graph.slot_copy(item, slot)
                    decision = next((e['copyTriage'] for e in copies if 'copyTriage' in e),
                                    'perceive-on-demand' if slot == 'tooltip' else 'perceive-now')
                    field.setdefault('copyTriage', decision)
                    if slot == 'description' and 'copyTriage' not in item_spec:
                        field['copyTriage'] = decision
                    units.append({'field': item, 'text': field[slot], 'decision': decision, 'source': PENDING})
                units.extend({'field': item, 'text': excluded.get('text', PENDING),
                              'decision': 'not-user-facing', 'source': deepcopy(excluded.get('source', PENDING))}
                             for excluded in field.get('excludedCopy', []) if isinstance(excluded, dict))
                owner, _ = graph.owner(item)
                if owner and graph.kind(owner) == COL:
                    spans[item] = graph.props(owner).get('span')
                fields.append(field)
            entry = {'name': form, 'formLayout': props.get('layout', PENDING), 'fields': fields}
            for key in ('labelCol', 'labelAlign'):
                if key in props:
                    entry[key] = deepcopy(props[key])
            rows = []
            for item in items:
                owner, _ = graph.owner(item)
                row = graph.owner(owner)[0] if owner and graph.kind(owner) == COL else None
                if row and graph.kind(row) == ROW and row not in rows:
                    rows.append(row)
            if rows and len(fields) >= 2:
                short = [s for s in spans.values() if isinstance(s, int) and s < 24]
                columns = 24 // min(short) if short else 1
                entry['layout'] = {'container': rows[0] if len(rows) == 1 else rows, 'columns': columns,
                                   'gutter': graph.props(rows[0]).get('gutter', 16)}
                for field in fields:
                    if spans.get(field['nodeName']) == 24 and columns > 1:
                        field['span'] = columns
            elif not in_overlay and len(fields) >= 2:
                entry['layout'] = PENDING
            if entry['formLayout'] == 'horizontal' and not in_overlay and len(fields) >= 2:
                labels = [f['label'] for f in fields if f['label'] != PENDING]
                estimate = estimated_label_px(fields) if labels and len(labels) == len(fields) else PENDING
                # The plan's labelCol starts from estimatedPx; measuredPx comes from the rendered label.
                entry['labelWidth'] = {'longestLabel': max(labels, key=label_px) if labels else PENDING,
                                       'estimatedPx': estimate, 'measuredPx': PENDING, 'measuredFrom': PENDING}
            if units:
                entry['sourceCopyUnits'] = units
            for key in ('layout', 'layoutReason', 'columnsReason', 'labelAlignReason', 'labelWidth', 'sourceCopyUnits'):
                if key in declaration:
                    entry[key] = deepcopy(declaration[key])
            if in_overlay and isinstance(entry.get('layout'), dict):
                prop, key = ('width', 'modalWidth') if graph.kind(overlay) == MODAL else ('size', 'drawerSize')
                entry['layout'].setdefault(key, graph.props(overlay).get(prop, PENDING))
            if entry['formLayout'] != ('vertical' if in_overlay else 'horizontal'):
                entry.setdefault('layoutReason', PENDING)
            if not in_overlay and isinstance(entry.get('layout'), dict) and entry['layout'].get('columns') != 3:
                entry.setdefault('columnsReason', PENDING)
            if entry['formLayout'] == 'horizontal' and props.get('labelAlign', 'right') != 'right':
                entry.setdefault('labelAlignReason', PENDING)
            forms.append(entry)
        standalone = [{'nodeName': n, 'reason': deepcopy(graph.by_name[n].get('reason', PENDING))} for n in graph.by_name
                      if graph.kind(n) in FIELD_CONTROLS
                      and not any(graph.kind(a) in form_kinds for a in graph.ancestors(n))]
        pages.append({'path': page.get('path'), 'forms': forms, 'standaloneControls': standalone})
    return {'pages': pages}


def descriptions_inventory(plan):
    pages = []
    for page in plan.get('pages', []):
        graph = PagePlan(page)
        groups = []
        for name in [n for n in graph.by_name if graph.kind(n) == DESCRIPTIONS]:
            props = graph.props(name)
            group = {'name': name, 'container': graph.owner(name)[0] or PENDING,
                     'title': graph.slot_text(name, 'title') or props.get('title') or '',
                     'column': props.get('column', PENDING)}
            for key in ('columnReason', 'itemsReason'):
                if key in graph.by_name[name]:
                    group[key] = deepcopy(graph.by_name[name][key])
            if 'items' in props:
                group['items'] = props['items']
                if props['items'] is not None:
                    group.setdefault('itemsReason', PENDING)
            else:
                group['itemSlots'] = []
                for item in [n for n in graph.children(name, 'children') if graph.kind(n) == DESCRIPTIONS_ITEM]:
                    values = graph.props(item)
                    entry = {'name': item, 'key': values.get('key', item),
                             'label': graph.slot_text(item, 'label') or values.get('label') or PENDING,
                             'children': graph.slot_text(item, 'children') or values.get('children') or PENDING}
                    if 'span' in values:
                        entry['span'] = values['span']
                    group['itemSlots'].append(entry)
            groups.append(group)
        pages.append({'path': page.get('path'), 'groups': groups})
    return {'pages': pages}


def overlay_inventory(plan):
    pages = []
    for page in plan.get('pages', []):
        graph = PagePlan(page)
        overlays = []
        for name in [n for n in graph.by_name if graph.kind(n) in (MODAL, DRAWER)]:
            props, kind = graph.props(name), graph.kind(name)
            footer_children = graph.children(name, 'footer')
            if props.get('hideFooter') is True or ('footer' in props and props['footer'] is None):
                footer, actions = 'none', []
            elif footer_children:
                footer = 'custom'
                buttons = [n for n in graph.descendants(name, 'footer') if graph.kind(n) == BUTTON]
                actions = [{'name': b, 'effect': PENDING} for b in buttons]
            elif kind == DRAWER:
                footer, actions = 'none', []
            else:
                footer = 'native'
                actions = [{'name': 'nativeCancel', 'effect': 'dismiss'}, {'name': 'nativeOk', 'effect': PENDING}]
            entry = {'name': name, 'component': graph.by_name[name]['component'],
                     'closeIcon': props.get('closable', True) is not False, 'footer': footer,
                     'footerActions': actions,
                     'trigger': [n for n in graph.children(name, 'trigger') if n in graph.by_name]}
            dimension = 'width' if kind == MODAL else 'size'
            if dimension in props:
                entry[dimension] = deepcopy(props[dimension])
            overlays.append(entry)
        pages.append({'path': page.get('path'), 'overlays': overlays})
    return {'pages': pages}


def slot_intent(page):
    """Planned component tree with every supplied Slot, for verify_slots.py."""
    graph = PagePlan(page)
    attr = lambda value: escape(json.dumps(value, ensure_ascii=False, separators=(',', ':')), quote=True)

    def render(name):
        if name in graph.node_by_name:
            node = graph.node_by_name[name]
            tag = node.get('tag') if isinstance(node.get('tag'), str) and re.fullmatch(r'[a-z][a-z0-9]*', node['tag']) else 'div'
            inner = escape(graph.text.get(name, '')) + ''.join(render(c) for c in graph.children(name))
            return f'<{tag}>{inner}</{tag}>'
        spec = graph.by_name[name]
        props = {}
        if graph.kind(name) == CARD and isinstance(graph.props(name).get('styles'), dict):
            props['styles'] = graph.props(name)['styles']
        slots = {}
        for child in graph.children(name):
            slots.setdefault(graph.owner(child)[1] or 'children', []).append(child)
        empty = ['title', 'extra'] if graph.kind(name) == CARD and spec.get('header') == 'none' else []
        body = ''.join(f'<slot name="{escape(slot)}">{"".join(render(c) for c in children)}</slot>'
                       for slot, children in slots.items())
        body += ''.join(f'<slot name="{slot}"></slot>' for slot in empty if slot not in slots)
        data = f' data-props="{attr(props)}"' if props else ''
        return (f'<plasmic-component data-plasmic-name="{escape(name)}" '
                f'data-plasmic-component="{escape(spec["component"])}"{data}>{body}</plasmic-component>')

    roots = [n for n in [*graph.by_name, *graph.node_by_name]
             if graph.owner(n)[0] is None or graph.owner(n)[0] not in {*graph.by_name, *graph.node_by_name}]
    return ''.join(render(r) for r in sorted(roots, key=graph.order.get))


def pending_count(value):
    if value == PENDING:
        return 1
    if isinstance(value, dict):
        return sum(pending_count(v) for v in value.values())
    if isinstance(value, list):
        return sum(pending_count(v) for v in value)
    return 0


def route_slug(path):
    return quote(path, safe='')
