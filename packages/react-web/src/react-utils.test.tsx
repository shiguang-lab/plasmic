// @vitest-environment jsdom
import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { NONE, mergeProps, mergeRefs } from "./react-utils";

describe("mergeProps", () => {
  it("works for refs", () => {
    const fn1 = vi.fn();
    const ref2: React.MutableRefObject<any> = { current: undefined };
    const merged = mergeProps(
      {
        ref: fn1,
      },
      {},
      {
        ref: ref2,
      }
    );

    merged.ref("OHHAI");
    expect(fn1).toHaveBeenCalledWith("OHHAI");
    expect(ref2.current).toEqual("OHHAI");
  });

  it("works for styles", () => {
    expect(
      mergeProps(
        {
          className: "hi",
          style: {
            display: "block",
            fontWeight: "bold",
          },
        },
        {},
        {},
        {
          className: "no",
          style: {
            display: "flex",
            color: "black",
          },
        }
      )
    ).toEqual({
      className: "hi no",
      style: {
        display: "flex",
        fontWeight: "bold",
        color: "black",
      },
    });
  });

  it("works for event listeners", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();
    const merged = mergeProps(
      {
        onClick: fn1,
      },
      {},
      {
        onClick: fn2,
        onMouseEnter: fn3,
      }
    );

    merged.onClick("HELLO");
    expect(fn1).toHaveBeenCalledWith("HELLO");
    expect(fn2).toHaveBeenCalledWith("HELLO");
    expect(fn3).toHaveBeenCalledTimes(0);

    merged.onMouseEnter("YUP");
    expect(fn3).toHaveBeenCalledWith("YUP");
  });

  it("works with setting NONE to null", () => {
    expect(
      mergeProps(
        {
          className: "blah",
          onClick: vi.fn(),
          style: NONE,
        },
        {
          style: {
            display: "block",
          },
          className: NONE,
          onClick: NONE,
        }
      )
    ).toEqual({
      className: null,
      onClick: null,
      style: null,
    });
  });
});

describe("React 19 merged ref lifecycles", () => {
  it("preserves cleanup functions alongside callback and object refs", () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const legacy = vi.fn();
    const object = React.createRef<HTMLButtonElement>();
    const props = mergeProps({ ref: callback }, { ref: legacy }, { ref: object });
    const view = render(<button {...props} />);
    const node = view.getByRole("button");
    expect(callback).toHaveBeenCalledWith(node);
    expect(object.current).toBe(node);
    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(legacy.mock.calls).toEqual([[node], [null]]);
    expect(object.current).toBeNull();
  });

  it("cleans the previous refs before attaching replacement refs", () => {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    const first = vi.fn(() => firstCleanup);
    const second = vi.fn(() => secondCleanup);
    const object = React.createRef<HTMLButtonElement>();
    const firstMerged = mergeRefs(first, object);
    const secondMerged = mergeRefs(second, object);
    const view = render(<button ref={firstMerged} />);
    const node = object.current;
    expect(mergeRefs(first, object)).toBe(firstMerged);
    view.rerender(<button ref={mergeRefs(first, object)} title="unchanged ref" />);
    expect(first).toHaveBeenCalledTimes(1);
    expect(firstCleanup).not.toHaveBeenCalled();
    view.rerender(<button ref={secondMerged} />);
    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(node);
    expect(object.current).toBe(node);
    view.unmount();
    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(object.current).toBeNull();
  });

  it("leaves no subscriptions after StrictMode ref replay and unmount", () => {
    const subscriptions = new Set<HTMLElement>();
    const cleanup = vi.fn((node: HTMLElement) => subscriptions.delete(node));
    const callback = vi.fn((node: HTMLElement | null) => {
      if (node) {
        subscriptions.add(node);
        return () => { cleanup(node); };
      }
      return undefined;
    });
    const object = React.createRef<HTMLButtonElement>();
    const view = render(<React.StrictMode><button ref={mergeRefs(callback, object)} /></React.StrictMode>);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(subscriptions.size).toBe(1);
    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(subscriptions.size).toBe(0);
    expect(object.current).toBeNull();
  });
});
