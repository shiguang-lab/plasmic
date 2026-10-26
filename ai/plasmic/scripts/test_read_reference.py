import unittest
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from read_reference import sections, select, selected_lines


class ReferenceTests(unittest.TestCase):
    def test_broken_output_does_not_record_a_successful_read(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'rules.md'
            ledger = Path(directory) / 'reads.jsonl'
            source.write_text('# Rules\nRequired contract.\n', encoding='utf-8')
            ledger.write_text('', encoding='utf-8')
            receiver, sender = os.pipe()
            os.close(receiver)
            try:
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).with_name('read_reference.py')),
                     str(source), '--log', str(ledger)], stdout=sender, stderr=subprocess.PIPE)
            finally:
                os.close(sender)
            self.assertNotEqual(result.returncode, 0)
            self.assertRegex(result.stderr, rb'BrokenPipeError|OSError: \[Errno 22\]')
            self.assertEqual(ledger.read_text(encoding='utf-8'), '')

    def test_command_emits_utf8_and_canonical_paths_with_non_utf8_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "中文.md"
            ledger = Path(directory) / "读取.jsonl"
            content = "# 表格\n## 宽度\n保留一列自适应。\n"
            source.write_text(content, encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("read_reference.py")),
                 str(source), "--log", str(ledger)],
                env={**os.environ, "PYTHONUTF8": "0", "PYTHONIOENCODING": "cp1252"},
                capture_output=True, check=True,
            )
            record, output = result.stdout.decode("utf-8").split("\n", 1)
            self.assertEqual(json.loads(record)["path"], source.resolve().as_posix())
            self.assertEqual(json.loads(ledger.read_text(encoding="utf-8")), json.loads(record))
            self.assertEqual(output, content + "\n")

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

    def test_line_coverage_matches_emitted_preamble_and_parent_introductions(self):
        source = "# Form\nMetadata\n## Field\nContract\n### Help\nTooltip\n### Layout\nGrid\n## Other\nSkip\n"
        emitted = selected_lines(source, ['layout'])
        self.assertEqual(emitted, {0, 1, 2, 3, 6, 7})
        self.assertEqual(''.join(line for i, line in enumerate(source.splitlines(keepends=True)) if i in emitted),
                         select(source, ['layout']))
        self.assertEqual(selected_lines(source, ['help']) | emitted | selected_lines(source, ['other']),
                         selected_lines(source))


if __name__ == "__main__":
    unittest.main()
