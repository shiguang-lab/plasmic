import copy
import html
import json
import hashlib
from pathlib import Path
import tempfile
import unittest

from verify_structure import check, check_complete_names, check_components, check_search_forms, matches_props
from verify_forms import TextTree, walk


class StructureTests(unittest.TestCase):
    def test_full_suite_names_include_unnamed_roots_and_hidden_children(self):
        markup = '<div id="root"><slot name="children"><span data-plasmic-name="Label">Text</span><div id="hidden" hidden></div></slot></div>'
        self.assertEqual(len(check_complete_names({"results": [{"type": "page", "baseVariantTplTree": markup}]})), 2)
        markup = markup.replace('id="root"', 'id="root" data-plasmic-name="Root"').replace('id="hidden"', 'id="hidden" data-plasmic-name="HiddenContent"')
        self.assertEqual(check_complete_names({"results": [{"type": "page", "baseVariantTplTree": markup}]}), [])
        inherited = '<div data-editable="false" id="library"><span id="inherited"></span></div><svg><path></path></svg>'
        self.assertEqual(check_complete_names({"results": [{"type": "page", "baseVariantTplTree": inherited}]}), [])

    def test_dropdown_json_actions_require_keys_including_nested_items(self):
        original = self.pages["results"][0]["baseVariantTplTree"]
        for items, passes in [
            ([{"value": "onetime", "label": "一次性"}], False),
            ([{"key": "onetime", "label": "一次性"}, {"key": "regular", "label": "常规"}], True),
            ([{"type": "group", "children": [{"key": "same"}, {"key": "same"}]}], False),
            ([{"type": "group", "children": [{"value": "regular"}]}], False),
        ]:
            values = html.escape(json.dumps({"menuItemsJson": items}), quote=True)
            self.pages["results"][0]["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Create" data-plasmic-component="plasmic-antd6-dropdown" data-props="' + values + '"></plasmic-component>'
            self.assertEqual(self.result()["passed"], passes)

    def dropdown_markup(self, children, icon="", button_values=None, dropdown_values=None, wrap=False):
        button_props = html.escape(json.dumps(button_values or {}), quote=True)
        dropdown_props = html.escape(json.dumps(dropdown_values or {}), quote=True)
        button = '<plasmic-component data-plasmic-name="Create" data-plasmic-component="plasmic-antd6-button" data-props="' + button_props + '"><slot name="children">' + children + '</slot><slot name="icon">' + icon + '</slot></plasmic-component>'
        trigger = '<plasmic-component data-plasmic-component="plasmic-antd6-space"><slot name="children">' + button + '</slot></plasmic-component>' if wrap else button
        return '<plasmic-component data-plasmic-name="CreateMenu" data-plasmic-component="plasmic-antd6-dropdown" data-props="' + dropdown_props + '"><slot name="children">' + trigger + '</slot></plasmic-component>'

    def dropdown_errors(self, markup):
        return check_components(list(walk(TextTree(markup).root)), "/records")

    def test_dropdown_text_button_requires_one_trailing_native_chevron(self):
        label = '<span>新建客群</span>'
        down = '<plasmic-component data-plasmic-component="plasmicAntdIconDownOutlined"></plasmic-component>'
        plus = '<plasmic-component data-plasmic-component="plasmicAntdIconPlusOutlined"></plasmic-component>'
        for markup in (
            self.dropdown_markup(label + down),
            self.dropdown_markup(label + down, plus),
            self.dropdown_markup(label, down, {"iconPlacement": "end"}),
            self.dropdown_markup(label, down, {"iconPlacement": '{{ "end" }}'}),
            self.dropdown_markup(label + down, plus, wrap=True),
            self.dropdown_markup('<plasmic-component data-plasmic-component="plasmic-antd6-space"><slot name="children">' + label + down + '</slot></plasmic-component>'),
        ):
            with self.subTest(markup=markup):
                self.assertEqual(self.dropdown_errors(markup), [])
        for markup in (
            self.dropdown_markup(label),
            self.dropdown_markup(label, plus),
            self.dropdown_markup(down + label),
            self.dropdown_markup(label + down + down),
            self.dropdown_markup(label + down, down, {"iconPlacement": "end"}),
            self.dropdown_markup(label, down),
            self.dropdown_markup(label + ' ▼'),
            self.dropdown_markup(label, dropdown_values={"arrow": True}),
            self.dropdown_markup(label + down, plus, {"iconPlacement": "end"}),
        ):
            with self.subTest(markup=markup):
                self.assertEqual([e["check"] for e in self.dropdown_errors(markup)], ["dropdownIndicator"])

    def test_dropdown_indicator_does_not_change_plain_buttons_or_icon_triggers(self):
        plain_button = '<plasmic-component data-plasmic-component="plasmic-antd6-button"><slot name="children">保存</slot></plasmic-component>'
        more = '<plasmic-component data-plasmic-component="plasmicAntdIconMoreOutlined"></plasmic-component>'
        avatar = '<plasmic-component data-plasmic-component="plasmic-antd6-dropdown"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-avatar"></plasmic-component></slot></plasmic-component>'
        for markup in (plain_button, self.dropdown_markup("", more), avatar,
                       self.dropdown_markup("右键操作", dropdown_values={"trigger": "contextMenu"}),
                       '<plasmic-component data-plasmic-component="plasmic-react-ui-action-group"></plasmic-component>'):
            with self.subTest(markup=markup):
                self.assertEqual(self.dropdown_errors(markup), [])

    def test_dropdown_end_icon_slot_cannot_mix_indicator_with_other_icons_or_text(self):
        down = '<plasmic-component data-plasmic-component="plasmicAntdIconDownOutlined"></plasmic-component>'
        plus = '<plasmic-component data-plasmic-component="plasmicAntdIconPlusOutlined"></plasmic-component>'
        for icon in (down + plus, plus + down, down + '<span>展开</span>'):
            with self.subTest(icon=icon):
                errors = self.dropdown_errors(self.dropdown_markup("新建客群", icon, {"iconPlacement": "end"}))
                self.assertEqual([e["check"] for e in errors], ["dropdownIndicator"])

    def test_search_fields_need_labels_and_collapse_rows_cannot_be_changed_without_review(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        def render(label, rows=1, custom=""):
            form_props = html.escape(json.dumps({"colSpan": 6, "minRows": rows, "collapsed": True}), quote=True)
            item_props = html.escape(json.dumps({"name": "keyword", "label": label}), quote=True)
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Filters" data-plasmic-component="plasmic-overseas-search-form" data-props="' + form_props + '"><slot name="children"><plasmic-component data-plasmic-name="Keyword" data-plasmic-component="plasmic-overseas-search-form-item" data-props="' + item_props + '">' + custom + '<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input" data-props=\'{"placeholder":"搜索客群名称 / Key"}\'></plasmic-component></slot></plasmic-component></slot></plasmic-component>'
        render("")
        self.assertTrue(any(e.get("check") == "searchFieldLabel" for e in self.result()["errors"]))
        render("关键词", 2)
        self.assertTrue(any(e.get("check") == "searchFormLayout" for e in self.result()["errors"]))
        render("关键词")
        self.assertTrue(self.result()["passed"])
        render("", custom='<slot name="labelContent"><span>关键词</span></slot>')
        self.assertTrue(self.result()["passed"])
        self.expected["pages"][0]["components"] = [
            {"nodeName": "Filters", "component": "plasmic-overseas-search-form", "source": "Explicit approved two-row query", "props": {"minRows": 2}, "overrides": self.override('minRows', 2)},
            {"nodeName": "Keyword", "component": "plasmic-overseas-search-form-item", "source": "Explicit approved label-free search", "props": {"label": ""}},
        ]
        render("", 2)
        self.assertTrue(self.result()["passed"])

    def search_form_markup(self, name="Filters", field="Keyword", values=None, field_values=None):
        form_props = html.escape(json.dumps(values or {}), quote=True)
        item_props = html.escape(json.dumps({"name": field, "label": field, **(field_values or {})}), quote=True)
        return '<plasmic-component data-plasmic-name="' + name + '" data-plasmic-component="plasmic-overseas-search-form" data-props="' + form_props + '"><slot name="children"><plasmic-component data-plasmic-name="' + field + '" data-plasmic-component="plasmic-overseas-search-form-item" data-props="' + item_props + '"></plasmic-component></slot></plasmic-component>'

    def search_form_errors(self, markup, declarations=None):
        return check_search_forms({"components": declarations or []}, TextTree(markup).root, "/records")

    def test_search_field_span_inherits_reviewed_grid_without_undeclared_widening(self):
        for value in (None, 6, '{{ 6 }}'):
            with self.subTest(span=value):
                self.assertEqual(self.search_form_errors(self.search_form_markup(field_values={"span": value})), [])
        for value in (8, '{{ 8 }}', '{{ $state.columns }}'):
            with self.subTest(span=value):
                errors = self.search_form_errors(self.search_form_markup(field_values={"span": value}))
                self.assertEqual([e["check"] for e in errors], ["searchFieldSpan"])
                self.assertEqual(errors[0]["expectedSpan"], 6)

    def test_search_field_span_override_needs_explicit_span_and_nonempty_source(self):
        markup = self.search_form_markup(field="DateRange", field_values={"span": 8})
        declaration = {"nodeName": "DateRange", "component": "plasmic-overseas-search-form-item",
                       "source": "Approved date-range query layout", "props": {"span": 8}, "overrides": self.override('span', 8)}
        self.assertEqual(self.search_form_errors(markup, [declaration]), [])
        for source in (None, "", "  ", False):
            with self.subTest(source=source):
                errors = self.search_form_errors(markup, [{**declaration, "source": source, "overrides": {}}])
                self.assertEqual([e["check"] for e in errors], ["searchFieldSpan"])
        self.assertTrue(self.search_form_errors(markup, [{**declaration, "props": {}}]))

    def test_search_form_columns_and_inherited_fields_follow_reviewed_parent(self):
        markup = self.search_form_markup(values={"colSpan": 8})
        self.assertEqual({e["check"] for e in self.search_form_errors(markup)}, {"searchFormLayout", "searchFieldSpan"})
        declaration = {"nodeName": "Filters", "component": "plasmic-overseas-search-form",
                       "source": "Original visual frame has multiple three-column field rows", "props": {"colSpan": 8}}
        self.assertEqual(self.search_form_errors(markup, [declaration]), [])
        self.assertEqual(self.search_form_errors(self.search_form_markup(values={"colSpan": '{{ 8 }}'}), [declaration]), [])
        errors = self.search_form_errors(self.search_form_markup(values={"colSpan": '{{ $state.columns }}'}), [declaration])
        self.assertEqual({e["check"] for e in errors}, {"searchFormLayout", "searchFieldSpan"})
        self.assertEqual(self.search_form_errors(self.search_form_markup(values={"colSpan": 8}, field_values={"span": 8}), [declaration]), [])
        errors = self.search_form_errors(self.search_form_markup(values={"colSpan": 8}, field_values={"span": 6}), [declaration])
        self.assertEqual([e["check"] for e in errors], ["searchFieldSpan"])

    def test_unsupported_search_grid_requires_a_requirement_document_exception(self):
        markup = self.search_form_markup(values={"colSpan": 12})
        declaration = {"nodeName": "Filters", "component": "plasmic-overseas-search-form",
                       "source": "Visual draft has two columns", "props": {"colSpan": 12}}
        self.assertEqual({e["check"] for e in self.search_form_errors(markup, [declaration])}, {"searchFormLayout", "searchFieldSpan"})
        self.source.write_text('筛选区每行2列。', encoding="utf-8")
        declaration['overrides'] = {'colSpan': {'reason': 'Requirement specifies two columns',
                                                'evidence': self.evidence('筛选区每行2列。')}}
        self.assertEqual(self.search_form_errors(markup, [declaration]), [])

    def test_search_field_span_policy_is_scoped_to_its_own_form(self):
        markup = self.search_form_markup("FirstFilters", "FirstKeyword") + self.search_form_markup("SecondFilters", "SecondKeyword", {"colSpan": 8})
        declaration = {"nodeName": "SecondFilters", "component": "plasmic-overseas-search-form",
                       "source": "Approved second query region", "props": {"colSpan": 8}, "overrides": self.override('colSpan', 8)}
        self.assertEqual(self.search_form_errors(markup, [declaration]), [])
        widened = self.search_form_markup("FirstFilters", "FirstKeyword", field_values={"span": 8}) + self.search_form_markup("SecondFilters", "SecondKeyword", {"colSpan": 8})
        errors = self.search_form_errors(widened, [declaration])
        self.assertEqual([(e["check"], e["form"], e["node"]) for e in errors], [("searchFieldSpan", "FirstFilters", "FirstKeyword")])

    def test_reviewed_dropdown_must_occupy_the_tabs_extra_slot(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.expected["pages"][0]["components"] = [
            {"nodeName": "Scopes", "component": "plasmic-antd6-tabs", "source": "Requirement All/Mine"},
            {"nodeName": "CreateMenu", "component": "plasmic-antd6-dropdown", "source": "Source grouped create menu", "owner": {"nodeName": "Scopes", "slot": "tabBarExtraContentRight"}},
        ]
        tabs = '<plasmic-component data-plasmic-name="Scopes" data-plasmic-component="plasmic-antd6-tabs">{}</plasmic-component>'
        dropdown = '<plasmic-component data-plasmic-name="CreateMenu" data-plasmic-component="plasmic-antd6-dropdown"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-button"></plasmic-component></slot></plasmic-component>'
        page["baseVariantTplTree"] = original + tabs.format("") + dropdown
        self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + tabs.format('<slot name="tabBarExtraContentRight">' + dropdown + '</slot>')
        self.assertTrue(self.result()["passed"])
        page["baseVariantTplTree"] = page["baseVariantTplTree"].replace('data-plasmic-component="plasmic-antd6-dropdown"', 'data-plasmic-component="plasmic-antd6-space"')
        self.assertFalse(self.result()["passed"])

    def test_static_json_expressions_match_without_evaluating_dynamic_code(self):
        self.assertTrue(matches_props({"rowKey": "id", "pagination": {"pageSize": 10}},
                                      {"rowKey": '{{ "id" }}', "pagination": '{{ {"pageSize":10,"current":1} }}'}))
        self.assertTrue(matches_props([{"key": "id"}], '{{ [{"key":"id"}] }}'))
        for value in ('{{ $state.rowKey }}', '{{ (() => "id")() }}', '{{ process.exit() }}', '{{ "other" }}'):
            self.assertFalse(matches_props("id", value))
        self.assertFalse(matches_props(True, '{{ 1 }}'))
        self.assertFalse(matches_props([1], [1, 2]))

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.source = Path(directory.name) / 'requirement.md'
        self.source.write_text('colSpan=8; span=8; minRows=2; Detail is visible to authorized readers.', encoding="utf-8")
        self.menu = [{"key": "records", "label": "Records", "children": [
            {"key": "list", "label": "Record list", "href": "/records", "children": [
                {"key": "detail", "label": "Record detail", "href": "/detail", "hidden": True}
            ]}
        ]}]
        self.expected = {"pages": [{"path": path, "source": "requirement §Page"} for path in ["/records", "/detail"]],
                         "navigation": {"source": "requirement §Navigation", "items": self.menu}}
        self.pages = {"results": [self.page("list", "/records"), self.page("detail", "/detail")]}
        self.overview = {"results": [{"__type": "Project", "components": copy.deepcopy(self.pages["results"])}]}

    def override(self, key, value):
        return {key: {'reason': 'Explicit source layout constraint', 'evidence': self.evidence(f'{key}={value}')}}

    def evidence(self, quote):
        return {'path': str(self.source), 'sha256': hashlib.sha256(self.source.read_bytes()).hexdigest(), 'quote': quote}

    def page(self, uuid, path, menu=None):
        props = html.escape(json.dumps({"menuItems": self.menu if menu is None else menu}), quote=True)
        return {"__type": "Component", "type": "page", "uuid": uuid, "pageMeta": {"path": path},
                "baseVariantTplTree": '<plasmic-component data-plasmic-component="plasmicOverseasAppShell" data-props="' + props + '"></plasmic-component>'}

    def result(self):
        return check(self.expected, self.overview, self.pages)

    def test_explicit_authored_names_check_format_and_scope_including_hidden_nodes(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for markup in ('<span label="lowerCamel">Content</span>', '<span label="名字">Content</span>',
                       '<div label="Actions"></div><div hidden label="Actions"></div>'):
            page["baseVariantTplTree"] = original + markup
            self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + '<div label="SQLInput"></div><span>Unnamed literal text</span>'
        self.assertTrue(self.result()["passed"])

    def test_raw_functional_widgets_require_native_components_or_a_reviewed_gap(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for widget in ('<button>Save</button>', '<input type="text">', '<select><option>All</option></select>',
                       '<textarea>SELECT uid</textarea>', '<table><tr><td>Record</td></tr></table>',
                       '<dialog>Confirm</dialog>', '<div role="tablist"><span role="tab">All</span></div>',
                       '<span role="switch">On</span>', '<div role="combobox">All</div>'):
            page["baseVariantTplTree"] = original + widget
            result = self.result()
            self.assertFalse(result["passed"], widget)
            self.assertTrue(any(e.get("check") == "nativeWidget" for e in result["errors"]))
        for identity in ("button", "input", "select", "tabs", "modal", "pagination", "alert", "tag"):
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Widget" data-plasmic-component="plasmic-antd6-' + identity + '"></plasmic-component>'
            self.assertTrue(self.result()["passed"], identity)

    def test_passive_markup_and_actual_navigation_are_not_forced_into_components(self):
        page = self.pages["results"][0]
        page["baseVariantTplTree"] += '<section><div style="display:flex;gap:16px"><p>Help <span>0</span></p><pre><code>SELECT uid</code></pre><a id="link" href="/records">Back to list</a><svg role="img"></svg></div></section>'
        page["interactions"] = [{"elementUuid": "link", "eventName": "onClick"}]
        self.assertTrue(self.result()["passed"])

    def test_plain_click_targets_cannot_bypass_the_native_action_rule(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        page["interactions"] = [{"elementUuid": "save", "eventName": "onClick"}]
        for widget in ('<span id="save">Save</span>', '<a id="save" href="#">Save</a>',
                       '<div onclick="save()">Save</div>'):
            page["baseVariantTplTree"] = original + widget
            self.assertFalse(self.result()["passed"], widget)

    def test_fallback_is_exact_does_not_cover_children_or_override_required_identity(self):
        page = self.pages["results"][0]
        plan = self.expected["pages"][0]
        original = page["baseVariantTplTree"]
        plan["elementFallbacks"] = [{"nodeName": "CustomWidget", "reason": "Reviewed installed candidates do not support the required canvas interaction", "source": "requirement §Canvas + candidate contract review"}]
        page["baseVariantTplTree"] = original + '<div data-plasmic-name="CustomWidget" role="grid">Custom domain visualization</div>'
        self.assertTrue(self.result()["passed"])
        # A declared gap does not turn an omitted required native Table into success.
        plan["components"] = [{"nodeName": "CustomWidget", "component": "plasmic-antd6-table", "source": "requirement §Results"}]
        self.assertFalse(self.result()["passed"])
        del plan["components"]
        page["baseVariantTplTree"] = original + '<div data-plasmic-name="CustomWidget" role="grid"><button>Save</button></div>'
        self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original
        self.assertTrue(any(e.get("check") == "elementFallback" for e in self.result()["errors"]))

    def test_fallback_scope_cannot_be_malformed_duplicated_or_a_passive_container(self):
        page = self.pages["results"][0]
        page["baseVariantTplTree"] += '<div data-plasmic-name="Container"><span>Content</span></div>'
        entry = {"nodeName": "Container", "reason": "Checked contract gap", "source": "requirement §Special case"}
        for entries in (None, {}, [{}], [entry, entry]):
            self.expected["pages"][0]["elementFallbacks"] = entries
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                self.result()
        self.expected["pages"][0]["elementFallbacks"] = [entry]
        self.assertFalse(self.result()["passed"])

    def test_chinese_directory_names_are_separate_from_english_internal_nodes(self):
        for plan, page, summary in zip(self.expected["pages"], self.pages["results"], self.overview["results"][0]["components"]):
            plan["name"] = "记录列表" if plan["path"] == "/records" else "记录详情"
            page["name"] = summary["name"] = plan["name"]
            page["baseVariantTplTree"] += '<div label="Content">业务内容</div>'
        self.assertTrue(self.result()["passed"])
        for target in (self.pages["results"][0], self.overview["results"][0]["components"][0]):
            original = target["name"]
            target["name"] = "GroupList"
            result = self.result()
            self.assertFalse(result["passed"])
            self.assertTrue(any(e.get("check") == "pageName" for e in result["errors"]))
            target["name"] = original
        # An explicit user-chosen other-language name remains supported.
        self.expected["pages"][0]["name"] = "Record list"
        self.pages["results"][0]["name"] = "Record list"
        self.overview["results"][0]["components"][0]["name"] = "Record list"
        self.assertTrue(self.result()["passed"])

    def test_shared_page_and_exact_menu_pass(self):
        self.pages["results"].reverse()
        self.assertTrue(self.result()["passed"])

    def test_required_native_regions_reject_html_table_form_and_loose_summary(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for suffix, imitation in [("table", "table"), ("form", "form"), ("descriptions", "div")]:
            self.expected["pages"][0]["components"] = [{"nodeName": "Region", "component": "plasmic-antd6-" + suffix, "source": "requirement §Region"}]
            page["baseVariantTplTree"] = original + f'<{imitation} data-plasmic-name="Region">Styled replacement</{imitation}>'
            self.assertFalse(self.result()["passed"])
        self.expected["pages"][0]["components"][0]["component"] = "plasmic-antd6-descriptions"
        page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Region" data-plasmic-component="plasmicAntd6Descriptions"></plasmic-component>'
        self.assertTrue(self.result()["passed"])

    def test_source_required_scope_tabs_reject_a_native_radio_substitute(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.expected["pages"][0]["components"] = [{"nodeName": "ContentScopes", "component": "plasmic-antd6-tabs", "source": "Reviewed requirement: switch result scopes, not a field value"}]
        for control in ("radio-group", "radio-button", "segmented"):
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="ContentScopes" data-plasmic-component="plasmic-antd6-' + control + '"></plasmic-component>'
            self.assertTrue(any(e.get("check") == "nativeComponent" for e in self.result()["errors"]), control)
        page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="ContentScopes" data-plasmic-component="plasmicAntd6Tabs"></plasmic-component>'
        self.assertTrue(self.result()["passed"])
        # Actual field-value choices retain their own registered contract.
        self.expected["pages"][0]["components"][0]["component"] = "plasmic-antd6-radio-group"
        page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="ContentScopes" data-plasmic-component="plasmicAntd6RadioGroup"></plasmic-component>'
        self.assertTrue(self.result()["passed"])

    def test_page_titles_need_an_explicit_exception_but_native_region_titles_remain(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for heading in ['<span data-plasmic-name="PageTitle">Record list</span>', '<h1>Record list</h1>']:
            page["baseVariantTplTree"] = original + heading
            self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + '<div data-plasmic-name="EntityHeader"><h1>Requested entity</h1></div>'
        self.expected["pages"][0]["pageHeader"] = {"nodeName": "EntityHeader", "source": "Explicit current user request for entity heading"}
        self.assertTrue(self.result()["passed"])
        self.expected["pages"][0]["pageHeader"] = None
        page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-component="plasmic-antd6-descriptions"><slot name="title">Basic information</slot></plasmic-component>'
        self.assertTrue(self.result()["passed"])

    def test_top_level_header_using_spans_cannot_bypass_the_heading_guard(self):
        self.pages["results"][0]["baseVariantTplTree"] = '<plasmic-component data-plasmic-component="plasmic-overseas-app-shell"><slot name="children"><div><div data-plasmic-name="BuilderHeader"><span>Create record</span></div><div>Fields</div></div></slot></plasmic-component>'
        errors = self.result()["errors"]
        self.assertTrue(any(e.get("check") == "pageHeader" and e.get("node") == "BuilderHeader" for e in errors))

    def test_copy_review_blocks_declared_process_notes_and_preserves_real_field_help(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.expected["pages"][0]["copy"] = {"source": "Reviewed requirement/UI copy", "excluded": [{"text": "AI creation is outside P0", "source": "requirement §Release scope, not UI copy"}], "entries": []}
        help_text = '<span data-plasmic-name="ExpiryHelp">1–365 days</span>'
        page["baseVariantTplTree"] = original + help_text + '<span>AI creation is </span><span>outside P0</span>'
        self.assertFalse(self.result()["passed"])
        # Requirement-like words in business data or handler code do not become a keyword blacklist.
        data = html.escape(json.dumps({"onClick": "{{ console.log('AI creation is outside P0') }}", "data": {"notes": "AI creation is outside P0"}}), quote=True)
        page["baseVariantTplTree"] = original + help_text + '<plasmic-component data-plasmic-component="example-control" data-props="' + data + '"></plasmic-component>'
        self.assertTrue(self.result()["passed"])

    def test_source_required_event_and_data_bindings_cannot_be_omitted(self):
        plan = self.expected["pages"][0]
        plan["bindings"] = [{"nodeName": "Create", "source": "requirement §Create", "events": ["onClick"]}]
        page = next(p for p in self.pages["results"] if p["pageMeta"]["path"] == plan["path"])
        page["baseVariantTplTree"] += '<plasmic-component id="create" data-plasmic-name="Create" data-plasmic-component="plasmic-antd6-button"></plasmic-component>'
        self.assertFalse(self.result()["passed"])
        page["interactions"] = [{"elementUuid": "create", "eventName": "onClick", "actionName": "customFunction"}]
        self.assertTrue(self.result()["passed"])
        page["baseVariantTplTree"] += '<plasmic-component data-plasmic-name="Records" data-plasmic-component="plasmic-antd6-table"></plasmic-component>'
        self.assertFalse(self.result()["passed"])

    def test_empty_callbacks_do_not_satisfy_reviewed_search_events(self):
        plan = self.expected["pages"][0]
        plan["bindings"] = [{"nodeName": "Filters", "source": "requirement §Query", "events": ["onSearch", "onReset"]}]
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        def render(search, reset):
            values = html.escape(json.dumps({"onSearch": search, "onReset": reset}), quote=True)
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Filters" data-plasmic-component="plasmic-overseas-search-form" data-props="' + values + '"></plasmic-component>'
        render('{{ () => {} }}', '{{ (values) => { } }}')
        self.assertFalse(self.result()["passed"])
        render('{{ (values) => { $state.query = values; } }}', '{{ () => { $state.query = {}; } }}')
        self.assertTrue(self.result()["passed"])

    def test_other_businesses_use_their_own_page_counts_routes_and_labels(self):
        scenarios = [
            ("课程管理", ["/courses"]),
            ("Order operations", ["/orders", "/orders/detail", "/refunds/new"]),
            ("库存管理", ["/inventory", "/inventory/detail", "/receipts", "/issues", "/transfers", "/stocktake"]),
        ]
        for label, routes in scenarios:
            with self.subTest(business=label):
                menu = [{"key": "module", "label": label, "children": [
                    {"key": str(i), "label": label + " " + str(i), "href": path}
                    for i, path in enumerate(routes)
                ]}]
                expected = {
                    "pages": [{"path": path, "source": label + " requirement §Pages"} for path in routes],
                    "navigation": {"source": label + " requirement §Navigation", "items": menu}
                }
                pages = {"results": [self.page(str(i), path, menu) for i, path in enumerate(routes)]}
                overview = {"results": [{"__type": "Project", "components": copy.deepcopy(pages["results"])}]}
                result = check(expected, overview, pages)
                self.assertTrue(result["passed"])
                self.assertEqual(result["actualPageCount"], len(routes))

    def test_required_editable_control_cannot_be_static_code_or_a_permanently_disabled_input(self):
        self.expected["pages"][0]["controls"] = [{"nodeName": "SqlEditor", "component": "plasmic-antd6-textarea", "source": "requirement §Editable SQL"}]
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for control, passed in [
            ('<pre label="SqlEditor">SELECT 1</pre>', False),
            ('<plasmic-component data-plasmic-name="SqlEditor" data-plasmic-component="plasmic-antd6-textarea"></plasmic-component>', True),
            ('<plasmic-component data-plasmic-name="SqlEditor" data-plasmic-component="plasmic-antd6-textarea" data-props=\'{"readOnly":true}\'></plasmic-component>', False),
        ]:
            page["baseVariantTplTree"] = original + control
            self.assertEqual(self.result()["passed"], passed)

    def test_literal_data_cannot_replace_required_filter_state_dependency(self):
        self.expected["pages"][0]["bindings"] = [{"nodeName": "Results", "source": "requirement §Filter", "dynamicProps": ["data"], "propStateDependencies": {"data": ["applied"]}}]
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        for data, passed in [({"data": []}, False), ("{{ ({data:$state.rows}) }}", False), ("{{ ({data:$state.rows.filter(row => row.type === $state.applied.type)}) }}", True), ("{{ ({data:$state.appliedOther}) }}", False)]:
            encoded = html.escape(json.dumps({"data": data}), quote=True)
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Results" data-plasmic-component="example-results" data-props="' + encoded + '"></plasmic-component>'
            self.assertEqual(self.result()["passed"], passed, self.result())

    def test_row_action_requires_live_render_control_and_registered_handler(self):
        self.expected["pages"][0]["rowActions"] = [{"column": "Actions", "control": "ViewRecord", "event": "onAction", "source": "requirement §Record details"}]
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        column = '<plasmic-component data-plasmic-name="Actions" data-plasmic-component="plasmic-antd6-table-column" data-props=\'{"displayType":"custom"}\'><slot name="render"><plasmic-component id="view" data-plasmic-name="ViewRecord" data-plasmic-component="plasmic-react-ui-action-group"></plasmic-component></slot></plasmic-component>'
        page["baseVariantTplTree"] = original + column
        self.assertFalse(self.result()["passed"])
        page["interactions"] = [{"elementUuid": "view", "eventName": "onAction"}]
        self.assertTrue(self.result()["passed"])
        page["baseVariantTplTree"] = original + column.replace('"custom"', '"link"')
        self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + column.replace('name="render"', 'name="children"')
        self.assertFalse(self.result()["passed"])

    def test_category_text_is_valid_but_text_tag_substitution_fails(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        declaration = {"nodeName": "Type", "component": "plasmic-antd6-table-column", "role": "category",
                       "purpose": "Single-value type shown as text in the visual draft", "source": "draft §Type cells",
                       "props": {"dataIndex": "type", "displayType": "text"}}
        self.expected["pages"][0]["components"] = [declaration]
        for expected in ("text", "tag"):
            declaration["props"]["displayType"] = expected
            for actual in ("text", "tag"):
                with self.subTest(expected=expected, actual=actual):
                    encoded = html.escape(json.dumps({"dataIndex": "type", "displayType": actual}), quote=True)
                    page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Type" data-plasmic-component="plasmic-antd6-table-column" data-props="' + encoded + '"></plasmic-component>'
                    result = self.result()
                    self.assertEqual(result["passed"], actual == expected, result)
                    if actual != expected:
                        self.assertTrue(any(e["check"] == "categoryPresentation" for e in result["errors"]))

    def test_reviewed_component_roles_cover_categories_actions_and_native_totals(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.source.write_text(self.source.read_text(encoding="utf-8") + ' The list supports viewing different records on the next page.', encoding="utf-8")
        def component(name, key, values=None, children=""):
            encoded = html.escape(json.dumps(values or {}), quote=True)
            return f'<plasmic-component data-plasmic-name="{name}" data-plasmic-component="{key}" data-props="{encoded}">{children}</plasmic-component>'
        def use(name, key, role="widget", **extra):
            return {"nodeName": name, "component": key, "role": role, "purpose": "Reviewed native presentation/interaction", "source": "requirement §Result fields and actions", **extra}
        uses = [
            use("Results", "plasmic-antd6-table", "pagination", props={"pagination": {"defaultPageSize": 20}}, dynamicProps=["pagination.showTotal"]),
            use("Category", "plasmic-antd6-table-column", "category", props={"dataIndex": "category", "displayType": "tag"}, owner={"nodeName": "Results", "slot": "children"}),
            use("Operations", "plasmic-antd6-table-column", props={"fixed": "right", "width": 200}),
            use("Actions", "plasmic-react-ui-action-group", "row-actions", props={"max": 3}, dynamicProps=["items"], owner={"nodeName": "Operations", "slot": "render"}),
        ]
        category = component("Category", "plasmic-antd6-table-column", {"dataIndex": "category", "displayType": "tag"})
        group = component("Actions", "plasmic-react-ui-action-group", {"max": 3, "items": [{"key": "detail", "label": "详情", "href": "{{ row.url }}"}]})
        operations = component("Operations", "plasmic-antd6-table-column", {"fixed": "right", "width": 200}, '<slot name="render"><div>' + group + '</div></slot>')
        valid = component("Results", "plasmic-antd6-table", {"data": {"data": []}, "pagination": {"defaultPageSize": 20, "showTotal": "{{ (total, range) => `共 ${total} 条` }}"}}, '<slot name="children">' + category + operations + '</slot>')
        self.expected["pages"][0]["components"] = uses
        self.expected["pages"][0]["actionContracts"] = [{'nodeName': 'Actions', 'key': 'detail', 'confirm': False, 'transitions': [], 'evidence': self.evidence('Detail is visible to authorized readers. The list supports viewing different records on the next page.'),
            'cases': [{'id': 'detail-allowed', 'kind': 'permission-allowed', 'nodeName': 'Actions', 'given': {'role': 'reader'}, 'checks': [{'kind': 'text', 'text': '详情', 'present': True}]},
                      {'id': 'detail-denied', 'kind': 'permission-denied', 'nodeName': 'Actions', 'given': {'role': 'no-access'}, 'checks': [{'kind': 'text', 'text': '详情', 'present': False}]}]}]
        self.expected["pages"][0]["runtimeCases"] = [{'id': 'results-next-page', 'kind': 'page-change', 'nodeName': 'Results',
            'evidence': self.expected["pages"][0]["actionContracts"][0]['evidence'], 'given': {'current': 2},
            'checks': [{'kind': 'text', 'text': 'record-next-page', 'present': True}]}]
        page["baseVariantTplTree"] = original + valid
        self.assertTrue(self.result()["passed"], self.result())
        layout = component("ActionsLayout", "plasmic-antd6-flex", children='<slot name="children">' + group + '</slot>')
        uses.append(use("ActionsLayout", "plasmic-antd6-flex", owner={"nodeName": "Operations", "slot": "render"}))
        uses[3]["owner"] = {"nodeName": "ActionsLayout", "slot": "children"}
        page["baseVariantTplTree"] = original + valid.replace(group, layout)
        self.assertTrue(self.result()["passed"], self.result())
        uses.pop()
        uses[3]["owner"] = {"nodeName": "Operations", "slot": "render"}
        for broken in [
            valid.replace('&quot;displayType&quot;: &quot;tag&quot;', '&quot;displayType&quot;: &quot;text&quot;'),
            valid.replace('plasmic-react-ui-action-group', 'plasmic-antd6-button'),
            valid.replace('&quot;fixed&quot;: &quot;right&quot;', '&quot;fixed&quot;: &quot;left&quot;'),
            valid.replace('&quot;max&quot;: 3', '&quot;max&quot;: 4'),
            valid.replace(category + operations, operations + category),
            valid.replace('showTotal', 'unrelated') + '<span>共 6 条</span>',
            valid.replace(group, '') + group,
        ]:
            page["baseVariantTplTree"] = original + broken
            self.assertFalse(self.result()["passed"], broken)
        page["baseVariantTplTree"] = original + valid
        uses.pop(1)
        self.assertTrue(any("Every Column" in e.get("message", "") for e in self.result()["errors"]))

    def test_native_bindings_can_target_nested_properties_without_sibling_evidence(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.expected["pages"][0]["bindings"] = [{"nodeName": "Results", "source": "requirement §Query total", "props": ["pagination.total"], "dynamicProps": ["pagination.total"], "propStateDependencies": {"pagination.total": ["matching"]}}]
        for pagination, passed in [({"total": 6}, False), ({"total": "{{ $state.matching.length }}"}, True)]:
            encoded = html.escape(json.dumps({"pagination": pagination}), quote=True)
            page["baseVariantTplTree"] = original + '<plasmic-component data-plasmic-name="Results" data-plasmic-component="custom-results" data-props="' + encoded + '"></plasmic-component>'
            self.assertEqual(self.result()["passed"], passed, self.result())

    def test_external_pager_has_one_data_owner_and_no_duplicate_table_pager(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        self.source.write_text(self.source.read_text(encoding="utf-8") + ' The external pager shows different result records on the next page.', encoding="utf-8")
        self.expected["pages"][0]["components"] = [
            {"nodeName": "Results", "component": "plasmic-antd6-table", "role": "widget", "purpose": "Paged data", "source": "requirement §External pager", "props": {"pagination": False}},
            {"nodeName": "Field", "component": "plasmic-antd6-table-column", "role": "widget", "purpose": "Record identity", "source": "requirement §Field"},
            {"nodeName": "Pager", "component": "plasmic-antd6-pagination", "role": "pagination", "purpose": "Source-required external pager", "source": "requirement §External pager", "dataOwner": "Results", "dynamicProps": ["showTotal"]},
        ]
        self.expected["pages"][0]["runtimeCases"] = [{'id': 'pager-next-page', 'kind': 'page-change', 'nodeName': 'Pager',
            'evidence': self.evidence('The external pager shows different result records on the next page.'), 'given': {'current': 2},
            'checks': [{'kind': 'text', 'text': 'record-next-page', 'present': True}]}]
        table = '<plasmic-component data-plasmic-name="Results" data-plasmic-component="plasmic-antd6-table" data-props=\'{"data":{"data":[]},"pagination":false}\'><slot name="children"><plasmic-component data-plasmic-name="Field" data-plasmic-component="plasmic-antd6-table-column" data-props=\'{"dataIndex":"id"}\'></plasmic-component></slot></plasmic-component>'
        pager = '<plasmic-component data-plasmic-name="Pager" data-plasmic-component="plasmic-antd6-pagination" data-props=\'{"showTotal":"{{ total => total }}"}\'></plasmic-component>'
        page["baseVariantTplTree"] = original + table + pager
        self.assertTrue(self.result()["passed"], self.result())
        for actual in [table.replace('"pagination":false', '"pagination":{}') + pager, table + pager + pager.replace('"Pager"', '"DuplicatePager"')]:
            page["baseVariantTplTree"] = original + actual
            self.assertFalse(self.result()["passed"])
        self.expected["pages"][0]["components"][-1]["dataOwner"] = "MissingRegion"
        page["baseVariantTplTree"] = original + table + pager
        self.assertFalse(self.result()["passed"])

    def test_steps_only_card_is_a_layout_wrapper(self):
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        card = '<plasmic-component data-plasmic-component="plasmic-antd6-card"><slot name="children"><div><plasmic-component data-plasmic-component="plasmic-antd6-steps"></plasmic-component></div>{}</slot></plasmic-component>'
        page["baseVariantTplTree"] = original + card.format("")
        self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + card.format('<div>Additional business content</div>')
        self.assertTrue(self.result()["passed"])

    def test_table_requires_native_columns_and_field_or_render_content(self):
        table = '<plasmic-component data-plasmic-name="Records" data-plasmic-component="plasmic-antd6-table" data-props=\'{"data":{"data":[{"id":0}]}}\'>{}</plasmic-component>'
        original = self.pages["results"][0]["baseVariantTplTree"]
        for columns, passed in [
            ("", False),
            ('<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-table-column"></plasmic-component></slot>', False),
            ('<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-table-column" data-props=\'{"dataIndex":"id"}\'></plasmic-component></slot>', True),
            ('<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-table-column-group"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-table-column"><slot name="render"><plasmic-component data-plasmic-component="plasmic-antd6-button"></plasmic-component></slot></plasmic-component></slot></plasmic-component></slot>', True),
        ]:
            self.pages["results"][0]["baseVariantTplTree"] = original + table.replace("{}", columns)
            self.assertEqual(self.result()["passed"], passed, self.result())

    def test_search_form_has_no_redundant_card_but_other_surfaces_remain_valid(self):
        original = self.pages["results"][0]["baseVariantTplTree"]
        search = '<plasmic-component data-plasmic-component="plasmic-overseas-search-form"></plasmic-component>'
        card = '<plasmic-component data-plasmic-component="plasmic-antd6-card"><slot name="children">{}</slot></plasmic-component>'
        self.pages["results"][0]["baseVariantTplTree"] = original + card.format('<div>' + search + '</div>')
        self.assertFalse(self.result()["passed"])
        self.pages["results"][0]["baseVariantTplTree"] = original + search + card.format('<div>Business panel</div>')
        self.assertTrue(self.result()["passed"])

    def test_same_count_with_wrong_routes_fails(self):
        for collection in [self.pages["results"], self.overview["results"][0]["components"]]:
            collection[1]["pageMeta"]["path"] = "/type-a-detail"
        self.assertFalse(self.result()["passed"])

    def test_type_split_rejected_even_when_all_pages_use_same_menu(self):
        for collection in [self.pages["results"], self.overview["results"][0]["components"]]:
            collection.append(self.page("other-detail", "/other-detail"))
        self.assertTrue(any(e.get("extra") == ["/other-detail"] for e in self.result()["errors"]))

    def test_duplicate_routes_fail(self):
        for collection in [self.pages["results"], self.overview["results"][0]["components"]]:
            collection.append(self.page("copy", "/detail"))
        self.assertFalse(self.result()["passed"])

    def test_partial_read_cannot_hide_extra_page(self):
        self.overview["results"][0]["components"].append(self.page("extra", "/extra"))
        self.assertFalse(self.result()["passed"])

    def test_missing_source_cannot_pass(self):
        del self.expected["pages"][0]["source"]
        self.assertFalse(self.result()["passed"])

    def test_hierarchy_label_visibility_order_and_target_are_checked(self):
        for case in ["hierarchy", "label", "visibility", "order", "target"]:
            with self.subTest(case=case):
                menu = copy.deepcopy(self.menu)
                expected = copy.deepcopy(self.expected)
                item = menu[0]["children"][0]
                if case == "hierarchy":
                    menu = menu[0]["children"]
                elif case == "label":
                    item["label"] = "SQL editor"
                elif case == "visibility":
                    item["children"][0]["hidden"] = False
                elif case == "order":
                    sibling = {"key": "another", "label": "Another", "href": "/detail"}
                    expected["navigation"]["items"][0]["children"].append(sibling)
                    menu[0]["children"].insert(0, sibling)
                else:
                    item["href"] = "/detail"
                self.pages["results"][1] = self.page("detail", "/detail", menu)
                self.assertFalse(check(expected, self.overview, self.pages)["passed"])

    def test_missing_and_duplicate_shells_fail(self):
        original = self.pages["results"][0]["baseVariantTplTree"]
        for markup in ["<div></div>", original + original]:
            self.pages["results"][0]["baseVariantTplTree"] = markup
            self.assertFalse(self.result()["passed"])

    def test_role_query_transform_checks_every_page_against_literal_inventory(self):
        self.expected["navigation"]["roleQuery"] = {"state": "role", "query": "role", "default": "Reader"}
        expression = "{{ (()=>{const map=items=>items.map(item=>({...item,...(item.href?{href:item.href+'?role='+encodeURIComponent(($state.role || $ctx.query?.role || 'Reader'))}:{}),...(item.children?{children:map(item.children)}:{})}));return map(" + json.dumps(self.menu) + ");})() }}"
        for page in self.pages["results"]:
            page.update(self.page(page["uuid"], page["pageMeta"]["path"], expression))
        self.assertTrue(self.result()["passed"])
        self.pages["results"][1].update(self.page("detail", "/detail", expression.replace("/records", "/wrong")))
        self.assertFalse(self.result()["passed"])

    def test_dynamic_navigation_requires_other_evidence(self):
        self.pages["results"][0] = self.page("list", "/records", "{{ $state.menu }}")
        self.assertFalse(self.result()["passed"])

    def test_static_menu_disabled_type_and_icon_changes_are_not_projected_away(self):
        self.assertTrue(self.result()['passed'])
        for key, value in [('disabled', True), ('type', 'divider'), ('icon', 'Changed'),
                           ('disabled', '{{ $state.disabled }}'), ('type', '{{ $state.type }}')]:
            menu = copy.deepcopy(self.menu)
            menu[0]['children'][0][key] = value
            pages = copy.deepcopy(self.pages)
            pages['results'][0] = self.page('list', '/records', menu)
            with self.subTest(property=key, value=value):
                result = check(self.expected, self.overview, pages)
                self.assertFalse(result['passed'])
                self.assertTrue(all(e['check'] == 'navigation' for e in result['errors']))

    def test_reviewed_static_menu_flags_pass_but_invalid_flags_do_not(self):
        menu = copy.deepcopy(self.menu)
        menu[0]['children'][0].update(disabled=True, type='item', icon='R')
        expected = copy.deepcopy(self.expected)
        expected['navigation']['items'] = menu
        pages = {'results': [self.page('list', '/records', menu), self.page('detail', '/detail', menu)]}
        self.assertTrue(check(expected, self.overview, pages)['passed'])
        for key, value in [('disabled', 1), ('type', 'unknown'), ('onClick', 'unexpected')]:
            invalid = copy.deepcopy(menu)
            invalid[0]['children'][0][key] = value
            expected['navigation']['items'] = invalid
            pages['results'] = [self.page('list', '/records', invalid), self.page('detail', '/detail', invalid)]
            with self.subTest(property=key, value=value):
                self.assertFalse(check(expected, self.overview, pages)['passed'])


if __name__ == "__main__":
    unittest.main()
