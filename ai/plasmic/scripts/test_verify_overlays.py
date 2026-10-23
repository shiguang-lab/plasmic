import html
import json
import unittest
from verify_overlays import check


def component(name, kind, values=None, children=""):
    return '<plasmic-component data-plasmic-name="{}" data-plasmic-component="{}" data-props="{}">{}</plasmic-component>'.format(
        name, kind, html.escape(json.dumps(values or {}), quote=True), children)


def button(name, values=None):
    return component(name, "plasmic-antd6-button", values, '<slot name="children">返回 SQL 编辑</slot>')


def action(name, effect="dismiss", **extra):
    return {"name": name, "effect": effect, **({"reason": "Save reviewed SQL"} if effect == "business" else {}), **extra}


def inventory(actions=(), footer="custom", close=True, kind="plasmic-antd6-modal"):
    return {"pages": [{"componentUuid": "page", "overlays": [{
        "name": "SQLPreview", "component": kind, "closeIcon": close,
        "footer": footer, "footerActions": list(actions)}]}]}


def model(footer=None, values=None, body="", kind="plasmic-antd6-modal"):
    children = '<slot name="children">' + body + '</slot>'
    if footer is not None:
        children += '<slot name="footer">' + footer + '</slot>'
    return {"results": [{"uuid": "page", "baseVariantTplTree": component("SQLPreview", kind, values, children)}]}


class OverlayFooterTests(unittest.TestCase):
    def test_drawer_size_and_modal_width_are_recorded(self):
        expected = inventory(actions=[action("Back", "dismiss"), action("Save", "business")], footer="custom")
        expected["pages"][0]["overlays"][0]["width"] = "720px"
        actual = model(footer=button("Back") + button("Save"), values={"open": "{{ $state.open }}", "width": "720px"})
        self.assertTrue(check(expected, actual)["passed"])
        expected["pages"][0]["overlays"][0]["width"] = "520px"
        self.assertIn("Modal width mismatch", str(check(expected, actual)["errors"]))
        drawer_expected = inventory(actions=[], footer="none", kind="plasmic-antd6-drawer")
        drawer_expected["pages"][0]["overlays"][0]["width"] = 720
        drawer_actual = model(body="<span>SQL</span>", kind="plasmic-antd6-drawer", values={"open": "{{ $state.open }}", "width": 720})
        self.assertTrue(check(drawer_expected, drawer_actual)["passed"])
        drawer_expected["pages"][0]["overlays"][0]["width"] = 480
        self.assertIn("Drawer width mismatch", str(check(drawer_expected, drawer_actual)["errors"]))
        drawer_expected["pages"][0]["overlays"][0].pop("width")
        drawer_expected["pages"][0]["overlays"][0]["size"] = "large"
        drawer_actual = model(body="<span>SQL</span>", kind="plasmic-antd6-drawer", values={"open": "{{ $state.open }}", "size": "large"})
        self.assertTrue(check(drawer_expected, drawer_actual)["passed"])


    def test_external_controlled_modal_rejects_leftover_default_trigger(self):
        expected = inventory(footer="none")
        actual = model(values={"hideFooter": True, "open": "{{ $state.open }}"})
        original = actual["results"][0]["baseVariantTplTree"]
        actual["results"][0]["baseVariantTplTree"] = original.replace(
            '<slot name="children">', '<slot name="trigger">' + button("ShowModal") + '</slot><slot name="children">', 1)
        result = check(expected, actual)
        self.assertFalse(result["passed"])
        self.assertIn("Inline trigger", result["errors"][0]["error"])
        expected["pages"][0]["overlays"][0]["trigger"] = ["ShowModal"]
        self.assertTrue(check(expected, actual)["passed"])
        expected["pages"][0]["overlays"][0]["trigger"] = []
        actual["results"][0]["baseVariantTplTree"] = original.replace('<slot name="children">', '<slot name="trigger"></slot><slot name="children">', 1)
        self.assertTrue(check(expected, actual)["passed"])

    def test_css_escapes_cannot_prove_footer_visibility(self):
        expected = inventory([action("Cancel"), action("Save", "business")])
        self.assertTrue(check(expected, model(button("Cancel") + button("Save")))["passed"])
        for style in [r'display:n\6f ne', r'\64 isplay:none', r'visibility:h\69 dden']:
            with self.subTest(style=style):
                actual = model(button("Cancel") + '<div style="' + style + '">' + button("Save") + '</div>')
                result = check(expected, actual)
                self.assertFalse(result['passed'])
                self.assertEqual([e['error'] for e in result['errors']], ['Escaped CSS requires rendered visibility evidence'])
        expected = inventory([action("nativeCancel"), action("nativeOk", "business")], 'native')
        result = check(expected, model(values={'okButtonProps': {'style': {'display': r'n\6f ne'}}}))
        self.assertFalse(result['passed'])
        self.assertEqual([e['error'] for e in result['errors']], ['Escaped CSS requires rendered visibility evidence'])
        self.assertTrue(check(expected, model(values={'okButtonProps': {'style': {'backgroundImage': r'url("image\20 name.png")'}}}))['passed'])

    def test_css_comments_cannot_obscure_a_visibility_property(self):
        expected = inventory([action("Cancel"), action("Save", "business")])
        for style in ['/* ; */ display:none', '/**/visibility:hidden']:
            with self.subTest(style=style):
                result = check(expected, model(button("Cancel") + '<div style="' + style + '">' + button("Save") + '</div>'))
                self.assertFalse(result['passed'])
                self.assertEqual([e['error'] for e in result['errors']], ['CSS comments require rendered visibility evidence'])

    def test_important_declarations_cannot_be_overwritten_by_later_normal_css(self):
        expected = inventory([action("Cancel"), action("Save", "business")])
        for style in ['display:none!important;display:flex', 'display:none !important;DISPLAY:flex',
                      'visibility:hidden!important;visibility:visible', 'opacity:0!important;opacity:1']:
            with self.subTest(style=style):
                result = check(expected, model(button("Cancel") + '<div style="' + style + '">' + button("Save") + '</div>'))
                self.assertFalse(result['passed'])
                self.assertEqual([e['error'] for e in result['errors']], ['Visible footer action inventory mismatch'])
                self.assertEqual(result['errors'][0]['actual'], ['Cancel'])
        for style in ['display:none;display:flex', 'display:none!important;display:flex!important',
                      'display:flex!important;display:none']:
            with self.subTest(visible=style):
                self.assertTrue(check(expected, model(button("Cancel") + '<div style="' + style + '">' + button("Save") + '</div>'))['passed'])
        for key, hidden, visible in [('display', 'none', 'flex'), ('opacity', '0', '1')]:
            for declaration, prop, passes in [(hidden, visible, False), (visible, hidden, True)]:
                with self.subTest(property=key, declaration=declaration, prop=prop):
                    save = button('Save', {'style': {key: prop}}).replace('<plasmic-component ', f'<plasmic-component style="{key}:{declaration}!important" ', 1)
                    result = check(expected, model(button('Cancel') + save))
                    self.assertEqual(result['passed'], passes)
                    if not passes:
                        self.assertEqual([e['error'] for e in result['errors']], ['Visible footer action inventory mismatch'])
                        self.assertEqual(result['errors'][0]['actual'], ['Cancel'])

    def test_sole_return_that_only_exits_fails(self):
        result = check(inventory([action("ReturnToEditor")]), model(button("ReturnToEditor")))
        self.assertFalse(result["passed"])
        self.assertIn("Sole exit-only", result["errors"][0]["error"])

    def test_multi_button_footer_keeps_cancel(self):
        self.assertTrue(check(inventory([action("Cancel"), action("Save", "business")]),
                              model(button("Cancel") + button("Save")))["passed"])

    def test_native_confirm_cancel_with_close_passes(self):
        self.assertTrue(check(inventory([action("nativeCancel"), action("nativeOk", "business")], "native"), model())["passed"])

    def test_no_footer_readonly_passes(self):
        self.assertTrue(check(inventory(footer="none"), model(values={"hideFooter": True}))["passed"])

    def test_empty_code_slots_preserve_studio_native_defaults(self):
        actual = model(footer="")
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '</plasmic-component>', '<slot name="closeIcon"></slot></plasmic-component>')
        self.assertTrue(check(inventory([action("nativeCancel"), action("nativeOk", "business")], "native"), actual)["passed"])
        for values in ({"footer": None, "closeIcon": None}, {"hideFooter": True, "closable": False}):
            self.assertTrue(check(inventory(footer="none", close=False), model(footer="", values=values))["passed"])
        self.assertTrue(check(inventory(footer="none", kind="plasmic-antd6-drawer"),
                              model(footer="", kind="plasmic-antd6-drawer"))["passed"])

    def test_single_business_return_passes(self):
        self.assertTrue(check(inventory([action("PreviousStep", "business", reason="Return to the previous workflow step")]),
                              model(button("PreviousStep")))["passed"])

    def test_no_header_close_preserves_single_exit(self):
        self.assertTrue(check(inventory([action("Cancel")], close=False),
                              model(button("Cancel"), {"closable": False}))["passed"])

    def test_disabled_second_button_still_counts(self):
        self.assertTrue(check(inventory([action("Cancel"), action("Save", "business")]),
                              model(button("Cancel") + button("Save", {"disabled": True})))["passed"])

    def test_hidden_second_button_does_not_count(self):
        actual = model(button("Cancel") + button("Save", {"style": {"display": "none"}}))
        self.assertFalse(check(inventory([action("Cancel")]), actual)["passed"])

    def test_body_pagination_does_not_turn_footer_into_multiple_actions(self):
        self.assertFalse(check(inventory([action("Cancel")]),
                               model(button("Cancel"), body=button("NextPage")))["passed"])

    def test_nested_overlay_and_trigger_are_separate_scopes(self):
        nested = component("Confirm", "plasmic-antd6-modal")
        actual = model(button("Cancel") + '<slot name="trigger">' + button("Trigger") + '</slot>' + nested)
        expected = inventory([action("Cancel")])
        expected["pages"][0]["overlays"].append({"name": "Confirm", "component": "plasmic-antd6-modal", "closeIcon": True,
                                                "footer": "native", "footerActions": [action("nativeCancel"), action("nativeOk", "business")]})
        result = check(expected, actual)
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("Sole exit-only", result["errors"][0]["error"])

    def test_native_only_cancel_fails_but_only_save_passes(self):
        self.assertFalse(check(inventory([action("nativeCancel")], "native"),
                               model(values={"okButtonProps": {"style": {"display": "none"}}}))["passed"])
        self.assertTrue(check(inventory([action("nativeOk", "business")], "native"),
                              model(values={"cancelButtonProps": {"style": {"display": "none"}}}))["passed"])

    def test_drawer_single_exit_and_no_footer(self):
        kind = "plasmic-antd6-drawer"
        self.assertFalse(check(inventory([action("Cancel")], kind=kind), model(button("Cancel"), kind=kind))["passed"])
        self.assertTrue(check(inventory(footer="none", kind=kind), model(kind=kind))["passed"])

    def test_wrong_footer_and_uninventoried_actions_fail(self):
        self.assertFalse(check(inventory(footer="none"), model())["passed"])
        self.assertFalse(check(inventory([action("Save", "business")]), model(button("Save") + button("Cancel")))["passed"])

    def test_missing_extra_duplicate_and_wrong_identity_fail(self):
        self.assertFalse(check(inventory(), {"results": []})["passed"])
        actual = model()
        actual["results"][0]["baseVariantTplTree"] *= 2
        self.assertFalse(check(inventory(), actual)["passed"])
        self.assertFalse(check(inventory(footer="none"), model(kind="plasmic-antd6-drawer"))["passed"])
        expected = {"pages": [{"componentUuid": "page", "overlays": []}]}
        self.assertFalse(check(expected, model())["passed"])

    def test_dynamic_configuration_requires_evidence(self):
        for values in ({"closable": "{{ $state.canClose }}"}, {"hideFooter": "{{ $state.hide }}"},
                       {"cancelButtonProps": "{{ $state.cancelProps }}"}):
            self.assertFalse(check(inventory(footer="native"), model(values=values))["passed"])
        self.assertFalse(check(inventory([action("Cancel")]), model(button("Cancel", {"hidden": "{{ $state.hidden }}"})))["passed"])

    def test_non_boolean_hidden_and_prototype_binding_cannot_prove_visibility(self):
        expected = inventory([action("nativeCancel"), action("nativeOk", "business")], "native")
        for value in ['{{ ({ hidden: 1 }) }}', '{{ ({ hidden: "false" }) }}',
                      '{{ ({ __proto__: $state.props }) }}', {"hidden": 1}]:
            with self.subTest(value=value):
                self.assertFalse(check(expected, model(values={"okButtonProps": value}))["passed"])

    def test_dynamic_disabled_is_not_visibility_and_must_match_reviewed_prop(self):
        expected = inventory([action("nativeCancel", props={"disabled": "{{ $state.busy }}"}),
                              action("nativeOk", "business", props={"disabled": "{{ $state.busy }}"})], "native")
        values = {key: "{{ ({ disabled: $state.busy }) }}" for key in ("cancelButtonProps", "okButtonProps")}
        self.assertTrue(check(expected, model(values=values))["passed"])
        for prop in ["disabled: false", "disabled: $state.other", "hidden: $state.busy",
                     "style: $state.style", "...$state.props"]:
            self.assertFalse(check(expected, model(values={**values, "okButtonProps": "{{ ({ " + prop + " }) }}"}))["passed"])

    def test_conditional_wrapper_cannot_hide_second_action_from_check(self):
        actual = model(button("Cancel") + '<div data-visible-if="{{ $state.canSave }}">' + button("Save") + '</div>')
        self.assertFalse(check(inventory([action("Cancel"), action("Save", "business")]), actual)["passed"])
        actual = model(button("Cancel") + '<div data-visible-if="false">' + button("Save") + '</div>')
        self.assertFalse(check(inventory([action("Cancel")]), actual)["passed"])

    def test_native_footer_literal_spoof_and_invalid_footer_flags_fail(self):
        expected = inventory([action("nativeCancel", props={"disabled": "{{ $state.busy }}"}),
                              action("nativeOk", "business", props={"disabled": "{{ $state.busy }}"})], "native")
        spoof = '{{ ({ disabled: "{{ $state.busy }}" }) }}'
        self.assertFalse(check(expected, model(values={"cancelButtonProps": spoof, "okButtonProps": spoof}))["passed"])
        expected = inventory([action("nativeCancel"), action("nativeOk", "business")], "native")
        for value in [1, "true", None]:
            self.assertFalse(check(expected, model(values={"hideFooter": value}))["passed"])
        for disabled in [1, "false"]:
            self.assertFalse(check(inventory(footer="none"), model(values={"hideFooter": True, "closable": {"disabled": disabled}}))["passed"])

    def test_css_visibility_cannot_hide_a_required_native_action(self):
        expected = inventory([action("nativeCancel"), action("nativeOk", "business")], "native")
        for style in [{"display": "NONE"}, {"visibility": "HIDDEN"}, {"opacity": 0},
                      {"opacity": -0.1}, {"opacity": "0%"}, {"opacity": "NaN"},
                      {"opacity": float('inf')}, {"opacity": "var(--alpha, 0)"}]:
            self.assertFalse(check(expected, model(values={"okButtonProps": {"style": style}}))["passed"])
        self.assertTrue(check(expected, model(values={"okButtonProps": {"style": {"opacity": 0.5}}}))["passed"])

    def test_inline_css_hidden_and_unresolved_values_cannot_prove_a_footer_action(self):
        expected = inventory([action("Cancel"), action("Save", "business")])
        for style in ['display: none !important', 'display : none', 'VISIBILITY: HIDDEN',
                      'visibility: var(--hidden, hidden)', 'opacity: var(--alpha, 0)',
                      'visibility: hidden /* hidden */']:
            with self.subTest(style=style):
                actual = model(button("Cancel") + '<div style="' + style + '">' + button("Save") + '</div>')
                self.assertFalse(check(expected, actual)["passed"])
        self.assertTrue(check(expected, model(button("Cancel") + '<div style="DISPLAY: flex !important">' + button("Save") + '</div>'))["passed"])

    def test_custom_close_icon_slot_cannot_be_assumed_to_be_the_native_icon(self):
        actual = model(values={"hideFooter": True})
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '</plasmic-component>', '<slot name="closeIcon"><span style="display:none">X</span></slot></plasmic-component>')
        self.assertFalse(check(inventory(footer="none"), actual)["passed"])

    def test_literal_close_icon_obeys_react_node_rendering(self):
        for value, close in [(0, True), (0.0, True), (False, False), (True, False),
                             (None, False), ("", False), (" ", False), ("X", True)]:
            with self.subTest(icon=value):
                values = {"hideFooter": True, "closable": {"closeIcon": value}}
                self.assertTrue(check(inventory(footer="none", close=close), model(values=values))["passed"])
                self.assertFalse(check(inventory(footer="none", close=not close), model(values=values))["passed"])
        for value in ["", " "]:
            self.assertFalse(check(inventory(footer="none"), model(values={"hideFooter": True, "closeIcon": value}))["passed"])

    def test_close_object_default_and_disabled(self):
        for value, close in (({}, True), ({"disabled": True}, False), ({"closeIcon": False}, False)):
            self.assertTrue(check(inventory(footer="none", close=close), model(values={"hideFooter": True, "closable": value}))["passed"])

    def test_explicit_closable_retains_native_close_with_false_or_null_top_icon(self):
        # Antd6 computeClosable ignores top-level false/null icons when an
        # explicit true/object closable configuration preserves its fallback.
        for closable in [True, {}]:
            for icon in [False, None]:
                values = {"closable": closable, "closeIcon": icon, "hideFooter": True}
                with self.subTest(values=values):
                    self.assertTrue(check(inventory(footer="none"), model(values=values))["passed"])
                    self.assertFalse(check(inventory(footer="none", close=False), model(values=values))["passed"])
                    values.pop("hideFooter")
                    self.assertFalse(check(inventory([action("Cancel")], close=False), model(button("Cancel"), values))["passed"])

    def test_action_handler_matches_without_execution(self):
        expected = inventory([action("Save", "business", props={"onClick": "{{ saveSQL() }}"})])
        self.assertTrue(check(expected, model(button("Save", {"onClick": "{{ saveSQL() }}"})))["passed"])
        self.assertFalse(check(expected, model(button("Save", {"onClick": "{{ close() }}"})))["passed"])

    def test_invalid_or_unreviewed_inventory_rejected(self):
        with self.assertRaises(ValueError):
            check(inventory([{"name": "Save", "effect": "business"}]), model(button("Save")))
        with self.assertRaises(ValueError):
            check(inventory([action("Cancel"), action("Cancel")]), model(button("Cancel")))


if __name__ == "__main__":
    unittest.main()
