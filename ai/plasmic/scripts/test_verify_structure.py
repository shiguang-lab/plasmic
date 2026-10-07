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

    def test_shared_page_and_exact_menu_pass(self):
        self.pages["results"].reverse()
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

    def test_dynamic_navigation_requires_other_evidence(self):
        self.pages["results"][0] = self.page("list", "/records", "{{ $state.menu }}")
        self.assertFalse(self.result()["passed"])


if __name__ == "__main__":
    unittest.main()
