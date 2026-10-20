import copy
import html
import json
import unittest

from verify_structure import check


class StructureTests(unittest.TestCase):
    def setUp(self):
        self.menu = [{"key": "records", "label": "Records", "children": [
            {"key": "list", "label": "Record list", "href": "/records", "children": [
                {"key": "detail", "label": "Record detail", "href": "/detail", "hidden": True}
            ]}
        ]}]
        self.expected = {"pages": [{"path": path, "source": "requirement §Page"} for path in ["/records", "/detail"]],
                         "navigation": {"source": "requirement §Navigation", "items": self.menu}}
        self.pages = {"results": [self.page("list", "/records"), self.page("detail", "/detail")]}
        self.overview = {"results": [{"__type": "Project", "components": copy.deepcopy(self.pages["results"])}]}

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
        self.expected["pages"][0]["copy"] = {"source": "Reviewed requirement/UI copy", "excluded": [{"text": "AI creation is outside P0", "source": "requirement §Release scope, not UI copy"}], "help": [{"nodeName": "ExpiryHelp", "text": "1–365 days", "source": "requirement §Validity"}]}
        help_text = '<span data-plasmic-name="ExpiryHelp">1–365 days</span>'
        page["baseVariantTplTree"] = original + help_text + '<span>AI creation is </span><span>outside P0</span>'
        self.assertFalse(self.result()["passed"])
        # Requirement-like words in business data or handler code do not become a keyword blacklist.
        data = html.escape(json.dumps({"onClick": "{{ console.log('AI creation is outside P0') }}", "data": {"notes": "AI creation is outside P0"}}), quote=True)
        page["baseVariantTplTree"] = original + help_text + '<plasmic-component data-plasmic-component="example-control" data-props="' + data + '"></plasmic-component>'
        self.assertTrue(self.result()["passed"])
        page["baseVariantTplTree"] = original + help_text.replace("1–365", "1–100")
        self.assertFalse(self.result()["passed"])

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
        self.expected["pages"][0]["rowActions"] = [{"column": "Actions", "control": "ViewRecord", "event": "onClick", "source": "requirement §Record details"}]
        page = self.pages["results"][0]
        original = page["baseVariantTplTree"]
        column = '<plasmic-component data-plasmic-name="Actions" data-plasmic-component="plasmic-antd6-table-column" data-props=\'{"displayType":"custom"}\'><slot name="render"><plasmic-component id="view" data-plasmic-name="ViewRecord" data-plasmic-component="plasmic-antd6-button"></plasmic-component></slot></plasmic-component>'
        page["baseVariantTplTree"] = original + column
        self.assertFalse(self.result()["passed"])
        page["interactions"] = [{"elementUuid": "view", "eventName": "onClick"}]
        self.assertTrue(self.result()["passed"])
        page["baseVariantTplTree"] = original + column.replace('"custom"', '"link"')
        self.assertFalse(self.result()["passed"])
        page["baseVariantTplTree"] = original + column.replace('name="render"', 'name="children"')
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
