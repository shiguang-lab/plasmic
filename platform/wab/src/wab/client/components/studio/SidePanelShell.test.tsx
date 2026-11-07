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
  "keeps one %s shell across switches and animates its current content until close finishes",
  async (side) => {
    vi.useFakeTimers();
    const renderShell = (open: boolean, content: string) => (
      <SidePanelShell open={open} side={side} style={{ width: 303 }}>
        <div>{content}</div>
      </SidePanelShell>
    );
    const mounted = render(renderShell(false, "Navigation"));
    const shell = mounted.container.querySelector(
      `[data-test-id="${side}-panel-shell"]`,
    );
    expect(shell).toHaveAttribute("data-open", "false");
    expect(shell).toHaveAttribute("inert");
    mounted.rerender(renderShell(true, "Navigation"));
    expect(screen.getByText("Navigation")).toBeVisible();
    expect(shell).toHaveAttribute("data-open", "true");
    mounted.rerender(renderShell(true, "AI"));
    expect(
      mounted.container.querySelector(`[data-test-id="${side}-panel-shell"]`),
    ).toBe(shell);
    expect(shell).toHaveAttribute("data-open", "true");
    expect(screen.queryByText("Navigation")).toBeNull();
    mounted.rerender(renderShell(false, "AI"));
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

it("reconciles current owners during exit while retaining the inert shell and its geometry", async () => {
  vi.useFakeTimers();
  const released = vi.fn();
  function Content({ owner }: { owner: string }) {
    React.useEffect(() => () => { released(owner); }, [owner]);
    return <span>{owner}</span>;
  }
  const contents = (open: boolean, owner: string | undefined) => (
    <SidePanelShell open={open} side="right" style={{ width: 303 }}>
      {owner && <Content key={owner} owner={owner} />}
    </SidePanelShell>
  );
  const mounted = render(contents(true, "First owner"));
  const shell = screen.getByText("First owner").closest('[data-test-id="right-panel-shell"]');
  const viewport = shell?.parentElement;
  mounted.rerender(contents(false, "Second owner"));
  expect(released).toHaveBeenCalledWith("First owner");
  expect(screen.queryByText("First owner")).toBeNull();
  expect(screen.getByText("Second owner")).toBeInTheDocument();
  expect(shell).toHaveAttribute("inert");
  expect(shell).toHaveAttribute("aria-hidden", "true");
  expect(viewport).toHaveStyle({ width: "303px" });
  await act(async () => { vi.advanceTimersByTime(SIDE_PANEL_TRANSITION_MS - 1); });
  expect(screen.getByText("Second owner")).toBeInTheDocument();
  mounted.rerender(contents(false, undefined));
  expect(released).toHaveBeenCalledWith("Second owner");
  expect(screen.queryByText("Second owner")).toBeNull();
  expect(mounted.container.querySelector('[data-test-id="right-panel-shell"]')).toBe(shell);
  expect(viewport).toHaveStyle({ width: "303px" });
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(mounted.container.querySelector('[data-test-id="right-panel-shell"]')).toBe(shell);
  expect(released).toHaveBeenCalledTimes(2);
});
