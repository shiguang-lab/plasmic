import { mkTplTagElement } from "@/wab/client/components/canvas/slate";
import { mkSlateString, mkTextString } from "@/wab/client/components/canvas/RichText/SlateString";
import { assert, ensure } from "@/wab/shared/common";
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { createEditor, Element, Node } from "slate";
import * as SlateDom from "slate-dom";
import * as SlateReact from "slate-react";

afterEach(() => cleanup());

it("retains component and native text identities for the same actual React module", () => {
  const TextString = mkTextString(React);
  expect(mkTextString(React)).toBe(TextString);
  const mounted = render(<React.StrictMode><TextString text="Initial" /></React.StrictMode>);
  const span = ensure(mounted.container.querySelector("[data-slate-string]"), "Text string");
  const initialText = span.firstChild;
  mounted.rerender(<React.StrictMode><TextString text="Initial" /></React.StrictMode>);
  expect(span.firstChild).toBe(initialText);
  span.textContent = "Native edit";
  const nativeText = span.firstChild;
  mounted.rerender(<React.StrictMode><TextString text="Native edit" /></React.StrictMode>);
  expect(mounted.container.querySelector("[data-slate-string]")).toBe(span);
  expect(span.firstChild).toBe(nativeText);
  mounted.rerender(<React.StrictMode><TextString text="Updated" isTrailing /></React.StrictMode>);
  expect(mounted.container.querySelector("[data-slate-string]")).toBe(span);
  expect(span.textContent).toBe("Updated\n");
});

it("keys Slate component types by both Slate module handles as well as React", () => {
  const component = mkSlateString(React, SlateDom, SlateReact);
  expect(mkSlateString(React, SlateDom, SlateReact)).toBe(component);
  // These namespace handles retain every real Slate implementation export.
  // React and its hooks are never substituted with a test implementation.
  const otherDom = { ...SlateDom }, otherSlate = { ...SlateReact };
  const byDom = mkSlateString(React, otherDom, SlateReact);
  const bySlate = mkSlateString(React, SlateDom, otherSlate);
  expect(byDom).not.toBe(component);
  expect(bySlate).not.toBe(component);
  expect(bySlate).not.toBe(byDom);
  expect(mkSlateString(React, otherDom, SlateReact)).toBe(byDom);
  expect(mkSlateString(React, SlateDom, otherSlate)).toBe(bySlate);
});

function actualSlate(text: string, voidNode = false) {
  const editor = SlateReact.withReact(createEditor());
  if (voidNode) { editor.isVoid = () => true; }
  const value: Element[] = [mkTplTagElement("actual-leaf", "span", {}, [{ text }])];
  const StringComponent = mkSlateString(React, SlateDom, SlateReact);
  const mounted = render(
    <SlateReact.Slate editor={editor} initialValue={value}>
      <SlateReact.Editable renderLeaf={({ attributes, leaf, text: textNode }) => {
        const path = SlateReact.ReactEditor.findPath(editor, textNode);
        const parent = Node.parent(editor, path);
        assert(Element.isElement(parent), "Slate text parent is an element");
        return <span {...attributes}><StringComponent isLast leaf={leaf} text={textNode} parent={parent} /></span>;
      }} />
    </SlateReact.Slate>,
  );
  return mounted;
}

it("renders ordinary and trailing text through the actual Slate editor leaf boundary", () => {
  const ordinary = actualSlate("Hello");
  expect(ensure(ordinary.container.querySelector("[data-slate-string]"), "Ordinary text").textContent).toBe("Hello");
  ordinary.unmount();
  const trailing = actualSlate("Hello\n");
  expect(ensure(trailing.container.querySelector("[data-slate-string]"), "Trailing text").textContent).toBe("Hello\n\n");
});

it("retains empty-line and void-node zero-width attributes in the actual Slate editor", () => {
  const empty = actualSlate("");
  const emptyString = ensure(empty.container.querySelector("[data-slate-zero-width]"), "Empty line");
  expect(emptyString.getAttribute("data-slate-zero-width")).toBe("n");
  expect(emptyString.getAttribute("data-slate-length")).toBe("0");
  expect(emptyString.querySelector("br")).toBeTruthy();
  empty.unmount();
  const voidEditor = actualSlate("Hidden", true);
  const voidString = ensure(voidEditor.container.querySelector("[data-slate-zero-width]"), "Void string");
  expect(voidString.getAttribute("data-slate-zero-width")).toBe("z");
  expect(voidString.getAttribute("data-slate-length")).toBe("6");
  expect(voidString.textContent).toBe("\uFEFF");
});
