import { SlateString, TextString } from "../../../../../../../canvas-packages/src/slate-string";
import assert from "node:assert/strict";
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { createEditor, Element, Node } from "slate";
// The native leaf and its provider must use the Canvas package's Slate context.
import * as SlateReact from "../../../../../../../canvas-packages/node_modules/slate-react";

afterEach(() => cleanup());

it("retains the native TextNode while updating committed text", () => {
  const mounted = render(<React.StrictMode><TextString text="Initial" /></React.StrictMode>);
  const span = mounted.container.querySelector("[data-slate-string]");
  assert(span, "Text string");
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

function actualSlate(text: string, voidNode = false) {
  const editor = SlateReact.withReact(createEditor());
  if (voidNode) { editor.isVoid = () => true; }
  const value: Element[] = [{ type: "paragraph", children: [{ text }] }];
  const mounted = render(
    <SlateReact.Slate editor={editor} initialValue={value}>
      <SlateReact.Editable renderLeaf={({ attributes, leaf, text: textNode }) => {
        const path = SlateReact.ReactEditor.findPath(editor, textNode);
        const parent = Node.parent(editor, path);
        assert(Element.isElement(parent), "Slate text parent is an element");
        return <span {...attributes}><SlateString isLast leaf={leaf} text={textNode} parent={parent} /></span>;
      }} />
    </SlateReact.Slate>,
  );
  return mounted;
}

it("renders ordinary and trailing text through the actual Slate editor leaf boundary", () => {
  const ordinary = actualSlate("Hello");
  expect(ordinary.container.querySelector("[data-slate-string]")?.textContent).toBe("Hello");
  ordinary.unmount();
  const trailing = actualSlate("Hello\n");
  expect(trailing.container.querySelector("[data-slate-string]")?.textContent).toBe("Hello\n\n");
});

it("retains empty-line and void-node zero-width attributes in the actual Slate editor", () => {
  const empty = actualSlate("");
  const emptyString = empty.container.querySelector("[data-slate-zero-width]");
  assert(emptyString, "Empty line");
  expect(emptyString.getAttribute("data-slate-zero-width")).toBe("n");
  expect(emptyString.getAttribute("data-slate-length")).toBe("0");
  expect(emptyString.querySelector("br")).toBeTruthy();
  empty.unmount();
  const voidEditor = actualSlate("Hidden", true);
  const voidString = voidEditor.container.querySelector("[data-slate-zero-width]");
  assert(voidString, "Void string");
  expect(voidString.getAttribute("data-slate-zero-width")).toBe("z");
  expect(voidString.getAttribute("data-slate-length")).toBe("6");
  expect(voidString.textContent).toBe("\uFEFF");
});
