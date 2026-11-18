import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { mock } from "vitest-mock-extended";

// Opt-in timing run. Both backends receive identical design operations and library contracts.
it.runIf(process.env.COMPONENT_REPLAY_BRIDGE).each(["cold", "cached"])(
  "replays page creation, edits and registered-component advice (%s)",
  async (round) => {
    const bridge = process.env.COMPONENT_REPLAY_BRIDGE;
    const started = performance.now();
    const { studioCtx } = fakeStudioCtx({
      devFlagOverrides: { enableComponentReuseAdvisory: true },
    });
    const observations: {
      operation: string;
      status: string;
      candidates: string[];
      ms: number;
    }[] = [];
    let prepared = () => {};
    const projectReady = new Promise<void>(resolve => { prepared = resolve; });
    studioCtx.appCtx.topFrameApi = mock<TopFrameApi>({
      componentReuse: async (request) => {
        if (request.command === "status") return { available: true };
        const response = await fetch(bridge + "/command", {
          method: "POST",
          body: JSON.stringify(request),
        });
        if (!response.ok) throw new Error(await response.text());
        const value = await response.json();
        if (request.command === "sync" && !request.defer) prepared();
        return value;
      },
    });
    const purposes = [
      "Switch customer information panels and keep the selected tab and content in sync on the same page",
      "Display customer records in a sortable paginated table",
      "Edit customer details in a slide-out panel from the right",
    ];
    const record = (op: string, output: string, before: number) => {
      const result = JSON.parse(output);
      const review = result.componentReview;
      expect(["completed", "skipped"]).toContain(review.status);
      observations.push({
        operation: op,
        status: review.status,
        candidates: review.suggestions.flatMap(
          (s: { candidates: { name: string }[] }) =>
            s.candidates.map((c) => c.name),
        ),
        ms: performance.now() - before,
      });
      return result;
    };
    // Observe the normal editor-open sync completing. Never prime any search intent.
    if (process.env.COMPONENT_REPLAY_PREPARED) await projectReady;
    const beforeEdits = await (await fetch(bridge + "/stats")).json();
    if (process.env.COMPONENT_REPLAY_PREPARED) {
      expect(beforeEdits.coverage).toEqual({
        indexed: beforeEdits.catalogueSize,
        total: beforeEdits.catalogueSize,
      });
    }
    const editStart = performance.now();
    for (const [i, name] of ["CustomerList", "CustomerDetails"].entries()) {
      let before = performance.now();
      const page = record(
        "createComponent",
        await COPILOT_TOOLS.createComponent.execute(studioCtx, {
          name,
          path: "/customer-" + i,
          type: "page",
          reviewContext: { purpose: "Create a customer page" },
        }),
        before,
      );
      const componentUuid = page.created[0].uuid;
      for (const [j, purpose] of [...purposes, purposes[0]].entries()) {
        before = performance.now();
        record(
          "insertHtml",
          await COPILOT_TOOLS.insertHtml.execute(studioCtx, {
            componentUuid,
            html: "<button>Action " + j + "</button>",
            reviewContext: { purpose },
          }),
          before,
        );
      }
      before = performance.now();
      record(
        "insertHtml",
        await COPILOT_TOOLS.insertHtml.execute(studioCtx, {
          componentUuid,
          html: "<p>Customer information</p>",
          reviewContext: { purpose: "Add explanatory copy" },
        }),
        before,
      );
    }
    const editMs = performance.now() - editStart;
    expect(
      observations.filter((row) => row.status === "completed"),
    ).toHaveLength(8);
    const stats = await (await fetch(bridge + "/stats")).json();
    const report = {
      editMs,
      beforeEdits,
      totalMs: performance.now() - started,
      observations,
      stats,
    };
    if (process.env.COMPONENT_REPLAY_REPORT)
      writeFileSync(
        process.env.COMPONENT_REPLAY_REPORT + "." + round + ".json",
        JSON.stringify(report, null, 2),
      );
  },
  60000,
);
