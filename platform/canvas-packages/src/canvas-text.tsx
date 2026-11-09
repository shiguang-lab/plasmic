import * as React from "react";
import { createEditor, type Descendant } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, useSelected, withReact } from "slate-react";
import type { CanvasSnapshotStore } from "./canvas-frame";

export type CanvasTextEditorInstance = ReturnType<typeof createNativeTextEditor>;
function createNativeTextEditor() { return withReact(withHistory(createEditor())); }

export interface CanvasTextEditorProps<Runtime> {
  readonly runtime: Runtime;
  readonly inline: boolean;
  readonly readOnly: boolean;
  readonly initialValue: Descendant[];
  readonly configureEditor: (editor: CanvasTextEditorInstance, inline: boolean, runtime: Runtime) => CanvasTextEditorInstance;
  readonly activateEditor: (editor: CanvasTextEditorInstance, readOnly: boolean, runtime: Runtime) => void;
  readonly resetEditor: (editor: CanvasTextEditorInstance, value: Descendant[]) => void;
  readonly valuesEqual: (first: unknown, second: unknown) => boolean;
  readonly onSetup: (editor: CanvasTextEditorInstance) => void;
  readonly onChange: (editor: CanvasTextEditorInstance) => void;
  readonly onValueChange: (value: Descendant[]) => void;
  readonly onReset: () => void;
  readonly editableProps: Omit<React.ComponentProps<typeof Editable>, "onKeyDown">;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, editor: CanvasTextEditorInstance) => void;
}

/** Slate and its editor Hooks run in the Canvas realm, beside their providers. */
export function CanvasTextEditor<Runtime>({ runtime, inline, readOnly, initialValue, configureEditor, activateEditor, resetEditor, valuesEqual, onSetup, onChange, onValueChange, onReset, editableProps, onKeyDown }: CanvasTextEditorProps<Runtime>) {
  const editor = React.useMemo(() => configureEditor(createNativeTextEditor(), inline, runtime), [configureEditor, inline, runtime]);
  const previousValue = React.useRef(initialValue);
  const setup = React.useRef(onSetup);
  React.useLayoutEffect(() => { setup.current = onSetup; }, [onSetup]);
  React.useEffect(() => { setup.current(editor); }, [editor]);
  React.useEffect(() => { activateEditor(editor, readOnly, runtime); }, [activateEditor, editor, readOnly, runtime]);
  React.useEffect(() => {
    if (!valuesEqual(initialValue, previousValue.current) && !valuesEqual(initialValue, editor.children)) {
      resetEditor(editor, initialValue);
      onReset();
    }
    previousValue.current = initialValue;
  }, [editor, initialValue, valuesEqual, resetEditor, onReset]);
  return <Slate editor={editor} initialValue={initialValue} onChange={() => onChange(editor)} onValueChange={onValueChange}>
    <Editable {...editableProps} readOnly={readOnly} onKeyDown={(event) => onKeyDown(event, editor)} />
  </Slate>;
}

export function CanvasSlateChildren({ render }: { readonly render: (selected: boolean) => React.ReactNode }) {
  const selected = useSelected();
  return render(selected);
}

/** Projects a native store through a pure model renderer, with no injected Hooks. */
export function CanvasStoreProjection<T>({ store, render }: { readonly store: CanvasSnapshotStore<T>; readonly render: (value: T) => React.ReactNode }) {
  const value = React.useSyncExternalStore(store.subscribe, store.getState, store.getInitialState);
  return render(value);
}
