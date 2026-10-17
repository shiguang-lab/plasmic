import unittest
from read_reference import sections, select


class ReferenceTests(unittest.TestCase):
    def test_complete_sections_preserve_nested_acceptance_and_fences(self):
        source = "# Form\n\nMetadata\n\n## Rules\nContract\n### Acceptance\nCheck\n```md\n## Not a heading\n```\n## Other\nUnrelated\n"
        result = select(source, ["rules", "acceptance"])
        self.assertEqual(result, source[:source.index("## Other")])
        self.assertEqual([h["anchor"] for h in sections(source)[1]], ["form", "rules", "acceptance", "other"])

    def test_unknown_section_fails_instead_of_silent_incomplete_read(self):
        with self.assertRaisesRegex(ValueError, "Unknown sections"):
            select("# Form\n## Required\nDo it\n", ["optional"])

    def test_nested_selection_retains_parent_contract_but_not_siblings(self):
        source = "# Form\nMetadata\n## Field\nOwnership contract\n### Help\nTooltip\n### Layout\nGrid\n## Other\nSkip\n"
        self.assertEqual(select(source, ["layout"]),
                         "# Form\nMetadata\n## Field\nOwnership contract\n### Layout\nGrid\n")

    def test_duplicate_headings_and_requested_order_do_not_duplicate_content(self):
        source = "# Form\n## Rule\nFirst\n## Rule\nSecond\n"
        self.assertEqual(select(source, ["rule-1"]), "# Form\n## Rule\nSecond\n")
        self.assertEqual(select(source, ["rule-1", "rule", "rule"]), source)


if __name__ == "__main__":
    unittest.main()
