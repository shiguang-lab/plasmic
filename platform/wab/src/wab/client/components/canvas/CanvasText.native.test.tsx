import { CanvasSlateChildren, CanvasStoreProjection, CanvasTextEditor, type CanvasTextEditorInstance, type CanvasTextEditorProps } from "../../../../../../canvas-packages/src/canvas-text";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { Transforms } from "slate";
import { createStore } from "zustand/vanilla";

afterEach(cleanup);

it("owns the real Slate editor and selection provider, and resets only changed model text", async () => {
  const configured = vi.fn((editor: CanvasTextEditorInstance) => editor);
  const activate = vi.fn();
  const setup = vi.fn();
  const reset = vi.fn((editor: CanvasTextEditorInstance, value: CanvasTextEditorProps<undefined>["initialValue"]) => {
    editor.children = value; editor.history = { undos: [], redos: [] }; editor.onChange();
  });
  const resetDraft = vi.fn(), changed = vi.fn();
  const initialValue = [{ type: "paragraph" as const, children: [{ text: "First" }] }];
  const props: CanvasTextEditorProps<undefined> = {
    runtime: undefined, inline: true, readOnly: false, initialValue,
    configureEditor: configured, activateEditor: activate, resetEditor: reset,
    valuesEqual: (first, second) => JSON.stringify(first) === JSON.stringify(second),
    onSetup: setup, onChange: vi.fn(), onValueChange: changed, onReset: resetDraft,
    onKeyDown: vi.fn(), editableProps: { as: "span", renderElement: ({ attributes, children }) => <span {...attributes}><CanvasSlateChildren render={() => children} /></span> },
  };
  const mounted = render(<CanvasTextEditor {...props} />);
  await waitFor(() => expect(setup).toHaveBeenCalledTimes(1));
  const editor = setup.mock.calls[0][0] as CanvasTextEditorInstance;
  expect(mounted.container.textContent).toBe("First");
  await act(async () => { Transforms.insertText(editor, " draft", { at: { path: [0, 0], offset: 5 } }); });
  expect(mounted.container.textContent).toBe("First draft");
  mounted.rerender(<CanvasTextEditor {...props} initialValue={[{ type: "paragraph", children: [{ text: "First" }] }]} />);
  expect(mounted.container.textContent).toBe("First draft");
  expect(reset).not.toHaveBeenCalled();
  mounted.rerender(<CanvasTextEditor {...props} initialValue={[{ type: "paragraph", children: [{ text: "Remote" }] }]} />);
  await waitFor(() => expect(mounted.container.textContent).toBe("Remote"));
  expect(reset).toHaveBeenCalledTimes(1); expect(resetDraft).toHaveBeenCalledTimes(1);
  expect(configured).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalled();
});

it("projects actual native store snapshots and releases them on unmount", () => {
  const store = createStore(() => ({ text: "First" }));
  const subscribe = vi.spyOn(store, "subscribe");
  const mounted = render(<CanvasStoreProjection store={store} render={(value) => <span>{value.text}</span>} />);
  act(() => store.setState({ text: "Next" }));
  expect(mounted.container.textContent).toBe("Next");
  expect(subscribe).toHaveBeenCalledTimes(1);
  mounted.unmount();
  act(() => store.setState({ text: "Closed" }));
  expect(mounted.container.textContent).toBe("");
});
