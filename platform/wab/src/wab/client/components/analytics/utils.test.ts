import type { useChartData } from "@/wab/client/components/analytics/useChartData";
import { getChartHeaders } from "@/wab/client/components/analytics/utils";
import { mock } from "vitest-mock-extended";

it("returns no chart headers when the query result is absent", () => {
  const data = mock<ReturnType<typeof useChartData>>({
    isLoading: false,
    isEmpty: false,
    analyticsQuery: undefined,
  });
  expect(getChartHeaders(data)).toEqual([]);
});
