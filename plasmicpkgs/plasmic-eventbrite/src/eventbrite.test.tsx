// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Eventbrite } from "./eventbrite";
import useEventbrite from "./hooks/useEventBrite";

afterEach(() => { cleanup(); delete window.EBWidgets; vi.restoreAllMocks(); });

it("keeps the checkout binding on rerender and replaces it when the event changes", () => {
  const orders: string[] = [];
  const createWidget = vi.fn((config) => {
    document.getElementById(config.modalTriggerElementId)?.addEventListener("click", () => orders.push(config.eventId));
  });
  window.EBWidgets = { createWidget };
  const view = render(<React.StrictMode><Eventbrite eventId="a" text="Buy" /></React.StrictMode>);
  const first = view.getByRole("button");
  expect(first.id).toBe(createWidget.mock.calls.at(-1)?.[0].modalTriggerElementId);
  view.rerender(<React.StrictMode><Eventbrite eventId="a" text="Tickets" /></React.StrictMode>);
  expect(view.getByRole("button")).toBe(first);
  fireEvent.click(first);
  expect(orders).toEqual(["a"]);
  view.rerender(<React.StrictMode><Eventbrite eventId="b" text="Tickets" /></React.StrictMode>);
  expect(view.getByRole("button")).not.toBe(first);
  fireEvent.click(view.getByRole("button"));
  expect(orders).toEqual(["a", "b"]);
  view.rerender(<React.StrictMode><Eventbrite /></React.StrictMode>);
  expect(view.queryByRole("button")).toBeNull();
  view.rerender(<React.StrictMode><Eventbrite eventId="c" /></React.StrictMode>);
  expect(createWidget.mock.calls.at(-1)?.[0].eventId).toBe("c");
});

it("uses the latest completion callback without rebuilding and ignores it after unmount", () => {
  const createWidget = vi.fn();
  window.EBWidgets = { createWidget };
  const first = vi.fn(), second = vi.fn();
  const view = renderHook(({ complete }) => useEventbrite({ eventId: "a", modal: true, onOrderComplete: complete }), { initialProps: { complete: first } });
  const complete = createWidget.mock.calls[0][0].onOrderComplete;
  view.rerender({ complete: second });
  act(() => complete());
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
  expect(createWidget).toHaveBeenCalledOnce();
  view.unmount();
  act(() => complete());
  expect(second).toHaveBeenCalledOnce();
});

it("keeps concurrent script owners independent and cleans up a pending load", () => {
  const first = render(<Eventbrite eventId="a" />);
  const second = render(<Eventbrite eventId="b" />);
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="eb_widgets.js"]'));
  expect(scripts).toHaveLength(2);
  first.unmount();
  expect(scripts[0].isConnected).toBe(false);
  expect(scripts[1].isConnected).toBe(true);
  const createWidget = vi.fn();
  window.EBWidgets = { createWidget };
  fireEvent.load(scripts[0]);
  expect(createWidget).not.toHaveBeenCalled();
  fireEvent.load(scripts[1]);
  expect(createWidget.mock.calls[0][0].eventId).toBe("b");
  second.unmount();
  expect(scripts[1].isConnected).toBe(false);
});
