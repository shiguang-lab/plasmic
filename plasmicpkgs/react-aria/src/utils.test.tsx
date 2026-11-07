// @vitest-environment jsdom

import { PlasmicCanvasContext, PlasmicCanvasProps } from "@plasmicapp/host";
import { cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flattenChildren, useAutoOpen, useIsOpen } from "./utils";

afterEach(cleanup);

function Canvas({ children }: { children: React.ReactNode }) {
  return <PlasmicCanvasContext.Provider value={{ componentName: "Test", globalVariants: {}, interactive: false }}>{children}</PlasmicCanvasContext.Provider>;
}

it("reveals overlay content through __canvas and keeps its trigger and standalone runtime closed", () => {
  const onReveal = vi.fn();
  const props: PlasmicCanvasProps = { __canvas: { selected: true, slot: "content", onReveal } };
  const { result, rerender, unmount } = renderHook((input: PlasmicCanvasProps) => useIsOpen({ props: input, isOpen: false, triggerSlotName: "trigger" }), { initialProps: props, wrapper: Canvas });
  expect(result.current).toBe(true);
  expect(onReveal).toHaveBeenCalledOnce();
  rerender({ __canvas: { ...props.__canvas, slot: "trigger" } });
  expect(result.current).toBe(false);
  expect(onReveal).toHaveBeenCalledOnce();
  unmount();
  const runtime = renderHook(() => useIsOpen({ props, isOpen: false }));
  expect(runtime.result.current).toBe(false);
  expect(onReveal).toHaveBeenCalledOnce();
});

it("forwards nested reveal notifications while opening and closing native overlay state", () => {
  const open = vi.fn(), close = vi.fn(), onReveal = vi.fn();
  const { rerender } = renderHook((props: PlasmicCanvasProps) => useAutoOpen({ props, open, close }), {
    initialProps: { __canvas: { selected: true, onReveal } }, wrapper: Canvas,
  });
  expect(open).toHaveBeenCalledOnce();
  expect(onReveal).toHaveBeenCalledOnce();
  rerender({ __canvas: { selected: false, onReveal } });
  expect(close).toHaveBeenCalledOnce();
  expect(onReveal).toHaveBeenCalledOnce();
});

function getKeys(nodes: React.ReactNode[]): (string | null)[] {
  return nodes.map((node) =>
    React.isValidElement(node) ? (node.key as string | null) : null
  );
}

describe("flattenChildren", () => {
  it("returns an empty array for null/undefined", () => {
    expect(flattenChildren(null)).toEqual([]);
    expect(flattenChildren(undefined)).toEqual([]);
  });

  it("returns a list of elements when there are no fragments", () => {
    const children = [
      <div key="a">a</div>,
      <div key="b">b</div>,
      <div key="c">c</div>,
    ];
    const result = flattenChildren(children);
    expect(result).toHaveLength(3);
    const keys = getKeys(result);
    expect(new Set(keys).size).toBe(3);
    keys.forEach((k) => expect(typeof k).toBe("string"));
  });

  it("preserves strings and numbers", () => {
    const result = flattenChildren(["hello", 42, <div key="x">x</div>]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("hello");
    expect(result[1]).toBe(42);
    expect(React.isValidElement(result[2])).toBe(true);
  });

  it("skips null, undefined and boolean children", () => {
    const result = flattenChildren([
      null,
      undefined,
      true,
      false,
      <div key="x">x</div>,
    ]);
    expect(result).toHaveLength(1);
    expect(React.isValidElement(result[0])).toBe(true);
  });

  it("flattens a fragment, unwrapping its children", () => {
    const result = flattenChildren(
      <>
        <div key="a">a</div>
        <div key="b">b</div>
      </>
    );
    expect(result).toHaveLength(2);
    const keys = getKeys(result);
    expect(new Set(keys).size).toBe(2);
  });

  it("flattens nested fragments", () => {
    const result = flattenChildren(
      <>
        <div key="a">a</div>
        <>
          <div key="b">b</div>
          <>
            <div key="c">c</div>
          </>
        </>
        <div key="d">d</div>
      </>
    );
    expect(result).toHaveLength(4);
    const keys = getKeys(result);
    expect(new Set(keys).size).toBe(4);
  });

  it("produces unique keys for duplicate keys in different fragments", () => {
    const result = flattenChildren(
      <>
        <>
          <div key="dup">a</div>
        </>
        <>
          <div key="dup">b</div>
        </>
      </>
    );
    expect(result).toHaveLength(2);
    const keys = getKeys(result);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it("preserves explicit keys on elements", () => {
    const result = flattenChildren([
      <div key="foo">foo</div>,
      <div key="bar">bar</div>,
    ]);
    expect(result).toHaveLength(2);
    const keys = getKeys(result);
    expect(keys[0]).toContain("foo");
    expect(keys[1]).toContain("bar");
  });

  it("includes parent fragment key in flattened child keys", () => {
    const result = flattenChildren(
      <React.Fragment key="outer">
        <div key="inner">x</div>
      </React.Fragment>
    );
    expect(result).toHaveLength(1);
    const key = getKeys(result)[0];
    expect(key).toContain("outer");
    expect(key).toContain("inner");
  });

  it("flattens JSX array expressions inside a fragment", () => {
    const result = flattenChildren(
      <>
        {[<div key="a">a</div>, <div key="b">b</div>]}
        <div key="c">c</div>
      </>
    );
    expect(result).toHaveLength(3);
    const keys = getKeys(result);
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toContain("a");
    expect(keys[1]).toContain("b");
    expect(keys[2]).toContain("c");
  });
});
