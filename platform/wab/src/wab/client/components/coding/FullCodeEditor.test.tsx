import { FullCodeEditor } from "@/wab/client/components/coding/FullCodeEditor";
import { cleanup, render } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  model: { getLanguageId: () => "plaintext", getLineContent: () => "已输入 {co}" },
  register: vi.fn(() => ({ dispose: vi.fn() })),
  executeEdits: vi.fn(),
  focus: vi.fn(),
}));
vi.mock("monaco-editor", () => ({
  editor: { setTheme: vi.fn() },
  languages: { CompletionItemKind: { Variable: 6 }, registerCompletionItemProvider: mocks.register },
  KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 1 },
}));
vi.mock("@/wab/client/components/coding/monacoEditorUtil", async () => {
  const { useEffect } = await import("react");
  return {
    createFilePathWithExtension: (name: string) => name,
    useMonacoEditor: (container: HTMLElement | null, options: any) => {
      useEffect(() => {
        if (!container) return;
        const editor = {
          getModel: () => mocks.model,
          getSelection: () => ({ startLineNumber: 1, endLineNumber: 1, startColumn: 5, endColumn: 5 }),
          onDidChangeModelContent: () => ({ dispose: vi.fn() }),
          addCommand: vi.fn(), executeEdits: mocks.executeEdits, focus: mocks.focus,
        };
        const disposables = [...options.onAfterEditorCreate(editor, { getUserValue: () => "" })];
        return () => disposables.reverse().forEach((d) => d?.dispose());
      }, [container]);
      return { getUserValue: () => "", resetUserValue: vi.fn() };
    },
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("completes placeholders only in this editor and replaces the whole partial token", () => {
  const view = render(<FullCodeEditor language="text" defaultValue="已输入 {co}" templateVariables={["count", "maxLength"]} autoFocus={false} />);
  const [language, provider] = mocks.register.mock.calls[0] as any;
  expect(language).toBe("plaintext");
  expect(provider.triggerCharacters).toEqual(["{"]);
  const result = provider.provideCompletionItems(mocks.model, { lineNumber: 1, column: 8 });
  expect(result.suggestions.map((s: any) => s.insertText)).toEqual(["{count}", "{maxLength}"]);
  expect(result.suggestions[0].range).toEqual({ startLineNumber: 1, endLineNumber: 1, startColumn: 5, endColumn: 9 });
  expect(provider.provideCompletionItems({ ...mocks.model }, { lineNumber: 1, column: 8 }).suggestions).toEqual([]);
  const disposable = mocks.register.mock.results[0].value;
  view.unmount();
  expect(disposable.dispose).toHaveBeenCalledOnce();
});

it("inserts a selected variable at the cursor without replacing the template", () => {
  const ref = React.createRef<FullCodeEditor>();
  render(<FullCodeEditor ref={ref} language="text" defaultValue="已输入 " autoFocus={false} />);
  ref.current?.insertAtCursor("{count}");
  expect(mocks.executeEdits).toHaveBeenCalledWith("insert", [{ range: { startLineNumber: 1, endLineNumber: 1, startColumn: 5, endColumn: 5 }, text: "{count}" }]);
  expect(mocks.focus).toHaveBeenCalledOnce();
  expect(mocks.register).not.toHaveBeenCalled();
});
