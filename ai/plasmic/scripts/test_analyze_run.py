import unittest
from analyze_run import analyze


class UsageTests(unittest.TestCase):
    def test_peak_is_distinct_from_cumulative_and_cached_input_is_counted(self):
        trace = [{'type': 'status', 'phase': 'step_end', 'usage': {'inputTokens': 100, 'cacheReadTokens': 900, 'outputTokens': 12}},
                 {'type': 'status', 'phase': 'step_end', 'usage': {'inputTokens': 80, 'cacheReadTokens': 1200, 'outputTokens': 20}}]
        result = analyze(trace, [{'method': 'tools/call', 'name': 'preview', 'isError': True, 'textBytes': 80}], 1200)
        self.assertEqual(result['peakInputTokens'], 1280)
        self.assertEqual(result['cumulativeInputTokens'], 2280)
        self.assertEqual(result['outputTokens'], 32)
        self.assertEqual(result['failedCallsByTool'], {'preview': 1})
        self.assertTrue(result['contextBudgetExceeded'])

    def test_missing_usage_is_unavailable_rather_than_a_zero_token_success(self):
        self.assertFalse(analyze([], [])['usageAvailable'])
        self.assertIsNone(analyze([], [])['peakInputTokens'])
        self.assertIsNone(analyze([], [])['contextBudgetExceeded'])

    def test_session_usage_counts_auxiliary_summaries_without_double_counting_cli_events(self):
        trace = [{'type': 'status', 'phase': 'step_end', 'usage': {'inputTokens': 100, 'outputTokens': 20}},
                 {'type': 'assistant/message', 'data': {'usage': {'inputTokens': 100, 'outputTokens': 20}}},
                 {'type': 'compaction/summary', 'data': {'usage': {'inputTokens': 120, 'outputTokens': 15}}}]
        result = analyze(trace, [])
        self.assertEqual(result['requests'], 2)
        self.assertEqual(result['cumulativeInputTokens'], 220)
        self.assertEqual(result['outputTokens'], 35)
        self.assertEqual(result['summaryRequests'], 1)
        self.assertEqual(result['recordedCompactions'], 1)


if __name__ == "__main__":
    unittest.main()
