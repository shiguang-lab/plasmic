// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SideEffect } from "./SideEffect";

afterEach(cleanup);
it("preserves setup cleanup ownership and reruns only when business dependency values change", () => {
  const mount = vi.fn(async () => {}), oldUnload = vi.fn(async () => {}), unload = vi.fn(async () => {});
  const view = render(<SideEffect deps={["a"]} onMount={mount} onUnmount={oldUnload} />);
  expect(mount).toHaveBeenCalledOnce();
  view.rerender(<SideEffect deps={["a"]} onMount={mount} onUnmount={unload} />);
  expect(mount).toHaveBeenCalledOnce();
  view.rerender(<SideEffect deps={["a", "b"]} onMount={mount} onUnmount={unload} />);
  expect(oldUnload).toHaveBeenCalledOnce();
  expect(unload).not.toHaveBeenCalled();
  expect(mount).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(unload).toHaveBeenCalledOnce();
});

it("balances StrictMode setup and cleanup", () => {
  const mount = vi.fn(async () => {}), unmount = vi.fn(async () => {});
  const view = render(<React.StrictMode><SideEffect onMount={mount} onUnmount={unmount} /></React.StrictMode>);
  expect(mount).toHaveBeenCalledTimes(2);
  expect(unmount).toHaveBeenCalledOnce();
  view.unmount();
  expect(unmount).toHaveBeenCalledTimes(2);
});
