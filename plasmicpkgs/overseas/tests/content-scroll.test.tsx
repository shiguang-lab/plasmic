import { act, fireEvent, render, screen } from "@testing-library/react";

import { afterEach, expect, test, vi } from "vitest";
import { AppShell } from "../src/registerAppShell";

afterEach(() => vi.useRealTimers());

test("AppShell restores the content scroll position and reports user scrolling", () => {
  vi.useFakeTimers();
  const onContentScroll = vi.fn();
  const view = render(<AppShell initialContentScrollTop={120} onContentScroll={onContentScroll}><article>List body</article></AppShell>);
  const content = screen.getByText("List body").closest("main");
  expect(content).not.toBeNull();
  if (!content) throw new Error("Expected the shell content region");
  expect(content.scrollTop).toBe(120);
  fireEvent.scroll(content, { target: { scrollTop: 240 } });
  expect(onContentScroll).toHaveBeenCalledWith(240);
  view.rerender(<AppShell initialContentScrollTop={0} onContentScroll={onContentScroll}><article>List body</article></AppShell>);
  expect(content.scrollTop).toBe(0);
  fireEvent.scroll(content, { target: { scrollTop: 180 } });
  act(() => vi.advanceTimersByTime(1000));
  expect(content.scrollTop).toBe(180);
});
