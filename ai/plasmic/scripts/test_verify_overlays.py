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

    def test_conditional_wrapper_cannot_hide_second_action_from_check(self):
        actual = model(button("Cancel") + '<div data-visible-if="{{ $state.canSave }}">' + button("Save") + '</div>')
        self.assertFalse(check(inventory([action("Cancel"), action("Save", "business")]), actual)["passed"])
        actual = model(button("Cancel") + '<div data-visible-if="false">' + button("Save") + '</div>')
        self.assertFalse(check(inventory([action("Cancel")]), actual)["passed"])

    def test_close_object_default_and_disabled(self):
        for value, close in (({}, True), ({"disabled": True}, False), ({"closeIcon": False}, False)):
            self.assertTrue(check(inventory(footer="none", close=close), model(values={"hideFooter": True, "closable": value}))["passed"])

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
