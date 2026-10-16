import {
  SIDE_PANEL_TRANSITION_MS,
  SidePanelShell,
} from "@/wab/client/components/studio/SidePanelShell";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it.each(["left", "right"] as const)(
  "keeps one %s shell across switches and retains only outgoing content until close finishes",
  async (side) => {
    vi.useFakeTimers();
    const renderShell = (open: boolean, content: string) => (
      <SidePanelShell open={open} side={side} style={{ width: 303 }}>
        <div>{content}</div>
      </SidePanelShell>
    );
    const mounted = render(renderShell(false, "Structure"));
    const shell = mounted.container.querySelector(
      `[data-test-id="${side}-panel-shell"]`,
    );
    expect(shell).toHaveAttribute("data-open", "false");
    expect(shell).toHaveAttribute("inert");
    mounted.rerender(renderShell(true, "Structure"));
    expect(screen.getByText("Structure")).toBeVisible();
    expect(shell).toHaveAttribute("data-open", "true");
    mounted.rerender(renderShell(true, "AI"));
    expect(
      mounted.container.querySelector(`[data-test-id="${side}-panel-shell"]`),
    ).toBe(shell);
    expect(shell).toHaveAttribute("data-open", "true");
    expect(screen.queryByText("Structure")).toBeNull();
    mounted.rerender(renderShell(false, ""));
    expect(shell).toHaveAttribute("data-open", "false");
    expect(screen.getByText("AI")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTime(SIDE_PANEL_TRANSITION_MS));
    expect(screen.queryByText("AI")).toBeNull();
    expect(
      mounted.container.querySelectorAll(
        `[data-test-id="${side}-panel-shell"]`,
      ),
    ).toHaveLength(1);
  },
);
it("cancels a pending close when another panel opens", async () => {
  vi.useFakeTimers();
  const mounted = render(
    <SidePanelShell open side="left" style={{ width: 303, left: "56px" }}>
      Insert
    </SidePanelShell>,
  );
  mounted.rerender(
    <SidePanelShell
      open={false}
      side="left"
      style={{ width: 303, left: "56px" }}
    />,
  );
  mounted.rerender(
    <SidePanelShell open side="left" style={{ width: 303, left: "56px" }}>
      Images
    </SidePanelShell>,
  );
  await act(() => vi.advanceTimersByTime(SIDE_PANEL_TRANSITION_MS));
  expect(screen.getByText("Images")).toBeInTheDocument();
  expect(screen.queryByText("Insert")).toBeNull();
});
