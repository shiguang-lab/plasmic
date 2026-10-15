import {
  LEFT_PANEL_TRANSITION_MS,
  LeftPanelShell,
} from "@/wab/client/components/studio/LeftPanelShell";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("keeps one shell across switches and retains only the outgoing content until close finishes", async () => {
  vi.useFakeTimers();
  const renderShell = (open: boolean, content: string) => (
    <LeftPanelShell open={open} width={303} left="56px">
      <div>{content}</div>
    </LeftPanelShell>
  );
  const mounted = render(renderShell(false, "Structure"));
  const shell = mounted.container.querySelector(
    '[data-test-id="left-panel-shell"]',
  );
  expect(shell).toHaveAttribute("data-open", "false");
  expect(shell).toHaveAttribute("inert");
  mounted.rerender(renderShell(true, "Structure"));
  expect(screen.getByText("Structure")).toBeVisible();
  expect(shell).toHaveAttribute("data-open", "true");
  mounted.rerender(renderShell(true, "AI"));
  expect(
    mounted.container.querySelector('[data-test-id="left-panel-shell"]'),
  ).toBe(shell);
  expect(shell).toHaveAttribute("data-open", "true");
  expect(screen.queryByText("Structure")).toBeNull();
  mounted.rerender(renderShell(false, ""));
  expect(shell).toHaveAttribute("data-open", "false");
  expect(screen.getByText("AI")).toBeInTheDocument();
  await act(() => vi.advanceTimersByTime(LEFT_PANEL_TRANSITION_MS));
  expect(screen.queryByText("AI")).toBeNull();
  expect(
    mounted.container.querySelectorAll('[data-test-id="left-panel-shell"]'),
  ).toHaveLength(1);
});
it("cancels a pending close when another panel opens", async () => {
  vi.useFakeTimers();
  const mounted = render(
    <LeftPanelShell open width={303} left="56px">
      Insert
    </LeftPanelShell>,
  );
  mounted.rerender(<LeftPanelShell open={false} width={303} left="56px" />);
  mounted.rerender(
    <LeftPanelShell open width={303} left="56px">
      Images
    </LeftPanelShell>,
  );
  await act(() => vi.advanceTimersByTime(LEFT_PANEL_TRANSITION_MS));
  expect(screen.getByText("Images")).toBeInTheDocument();
  expect(screen.queryByText("Insert")).toBeNull();
});
