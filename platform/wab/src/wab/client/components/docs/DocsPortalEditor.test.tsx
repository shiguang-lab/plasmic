import { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import { DocsPortalEditor } from "@/wab/client/components/docs/DocsPortalEditor";
import { serializeDependentModules } from "@/wab/client/components/docs/serialize-docs-preview";
import { createDocsModelFixture } from "@/wab/client/components/docs/__testonly__/model-fixture";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ProjectConfig } from "@/wab/shared/codegen/types";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mockDeep } from "vitest-mock-extended";

const monaco = vi.hoisted(() => {
  class Model {
    listeners = new Set<() => void>();
    dispose = vi.fn(() => this.listeners.clear());
    constructor(
      public value: string,
      public uri: { toString(): string },
    ) {}
    getValue() {
      return this.value;
    }
    setValue(value: string) {
      this.value = value;
      this.listeners.forEach((listener) => listener());
    }
    onDidChangeContent(listener: () => void) {
      this.listeners.add(listener);
      return { dispose: () => this.listeners.delete(listener) };
    }
  }
  const models: Model[] = [];
  const libs: { dispose: ReturnType<typeof vi.fn> }[] = [];
  const defaults = {
    setCompilerOptions: vi.fn(),
    setDiagnosticsOptions: vi.fn(),
    setEagerModelSync: vi.fn(),
    addExtraLib: vi.fn(() => {
      const lib = { dispose: vi.fn() };
      libs.push(lib);
      return lib;
    }),
  };
  const api = {
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    editor: {
      createModel: (
        value: string,
        _language: string,
        uri: { toString(): string },
      ) => {
        const model = new Model(value, uri);
        models.push(model);
        return model;
      },
    },
    typescript: {
      typescriptDefaults: defaults,
      ScriptTarget: { Latest: 99 },
      ModuleResolutionKind: { NodeJs: 2 },
      ModuleKind: { CommonJS: 1 },
      JsxEmit: { React: 2 },
    },
  };
  const editor = {
    model: null as Model | null,
    getModel() {
      return this.model;
    },
    setModel(model: Model | null) {
      this.model = model;
    },
    setHiddenAreas: vi.fn(),
  };
  return { api, editor, models, libs };
});

vi.mock("monaco-editor", () => monaco.api);
vi.mock("@monaco-editor/react", async () => {
  const { useEffect } = await import("react");
  return {
    loader: { config: vi.fn() },
    default: (props: {
      beforeMount(api: unknown): void;
      onMount(editor: unknown, api: unknown): void;
    }) => {
      useEffect(() => {
        props.beforeMount(monaco.api);
        props.onMount(monaco.editor, monaco.api);
      }, []);
      return <div data-testid="monaco" />;
    },
  };
});
vi.mock("@/wab/client/monaco-worker-url", () => ({
  configureMonacoWorkers: vi.fn(),
}));
vi.mock("@/wab/client/ui-theme", () => ({
  useUiAppearance: () => ({ appearance: "light" }),
}));
vi.mock("@/wab/client/components/docs/serialize-docs-preview", () => ({
  formatDocsCode: vi.fn(async (code: string) => code),
  serializeDependentModules: vi.fn(),
  makePlumeDepsImports: vi.fn(() => ""),
  serializeToggledComponent: vi.fn(() => "<PlasmicFirst />"),
  serializeToggledIcon: vi.fn(() => "<Icon />"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  monaco.models.length = 0;
  monaco.libs.length = 0;
  monaco.editor.model = null;
});
afterEach(cleanup);

function fixture() {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const first = mgr.addComponent({ name: "First", type: ComponentType.Plain });
  const second = mgr.addComponent({
    name: "Second",
    type: ComponentType.Plain,
  });
  const { ctx, commit } = createDocsModelFixture(site);
  ctx.setComponentCustomCode(first, "<PlasmicFirst />");
  ctx.setFocusedComponent(first);
  const setParameterCount = (count: number) => {
    first.params.splice(0, first.params.length, ...Array.from({ length: count }, (_, index) => mkParam({ name: `caption${index}`, paramType: "prop", type: typeFactory.text() })));
    commit(first, "params", [first]);
  };
  vi.mocked(serializeDependentModules).mockImplementation(() => ({
    modules: [
      {
        name: "./dependency.tsx",
        lang: "tsx",
        source: `export const value = ${first.params.length};`,
      },
    ],
    globalGroups: [],
    depsProjectConfigs: [],
    projectConfig: mockDeep<ProjectConfig>(),
    components: new Set([first]),
  }));
  return { ctx, first, second, setParameterCount };
}

it("updates text without regenerating dependencies or echoing programmatic edits", () => {
  const { ctx, first, second, setParameterCount } = fixture();
  const write = vi.spyOn(ctx, "setComponentCustomCode");
  const mounted = render(<DocsPortalEditor docsCtx={ctx} />);
  expect(serializeDependentModules).toHaveBeenCalledTimes(1);
  expect(write).not.toHaveBeenCalled();
  expect(
    monaco.models.every((model) => !model.uri.toString().includes("/./")),
  ).toBe(true);
  const model = ensure(monaco.editor.model, "active model");
  for (let i = 0; i < 30; i++) {
    act(() =>
      ctx.setComponentCustomCode(first, `<PlasmicFirst title="${i}" />`),
    );
  }
  expect(serializeDependentModules).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledTimes(30);
  expect(model.getValue()).toContain('title="29"');
  write.mockClear();
  act(() => ctx.setComponentCustomCode(second, "<Second />"));
  expect(model.getValue()).toContain('title="29"');
  expect(serializeDependentModules).toHaveBeenCalledTimes(1);
  write.mockClear();
  act(() => model.setValue('<PlasmicFirst title="typed" />'));
  expect(ctx.getComponentCustomCode(first)).toBe(
    '<PlasmicFirst title="typed" />',
  );
  expect(write).toHaveBeenCalledOnce();
  expect(serializeDependentModules).toHaveBeenCalledTimes(1);
  act(() => setParameterCount(1));
  expect(serializeDependentModules).toHaveBeenCalledTimes(2);
  expect(
    monaco.models
      .find((item) => item.uri.toString().endsWith("dependency.tsx"))
      ?.getValue(),
  ).toContain("= 1;");
  mounted.unmount();
  const calls = vi.mocked(serializeDependentModules).mock.calls.length;
  ctx.setComponentCustomCode(first, "after unmount");
  setParameterCount(2);
  expect(serializeDependentModules).toHaveBeenCalledTimes(calls);
  expect(model.listeners.size).toBe(0);
  expect(monaco.editor.getModel()).toBeNull();
  expect(monaco.models.length).toBeGreaterThan(0);
  for (const item of monaco.models) {
    expect(item.dispose).toHaveBeenCalledOnce();
  }
  expect(monaco.libs).toHaveLength(3);
  for (const lib of monaco.libs) {
    expect(lib.dispose).toHaveBeenCalledOnce();
  }
});

it("isolates editable examples from component code and releases the previous example", () => {
  const { ctx, first } = fixture();
  const example = new CodePreviewCtx("example one");
  const replacement = new CodePreviewCtx("example two");
  const mounted = render(
    <DocsPortalEditor docsCtx={ctx} codePreviewCtx={example} />,
  );
  const original = ensure(monaco.editor.model, "example model");
  act(() => ctx.setComponentCustomCode(first, "component change"));
  expect(original.getValue()).toContain("example one");
  expect(serializeDependentModules).toHaveBeenCalledTimes(1);
  act(() => original.setValue("typed example"));
  expect(example.getCode()).toBe("typed example");
  expect(ctx.getComponentCustomCode(first)).toBe("component change");
  mounted.rerender(
    <DocsPortalEditor docsCtx={ctx} codePreviewCtx={replacement} />,
  );
  const current = ensure(monaco.editor.model, "replacement model");
  expect(current).not.toBe(original);
  expect(current.getValue()).toContain("example two");
  act(() => example.setCode("stale"));
  expect(current.getValue()).toContain("example two");
  expect(original.listeners.size).toBe(0);
  mounted.unmount();
});


it("keeps editable code during a native dependency failure and recovers on the next model commit", () => {
  const { ctx, setParameterCount } = fixture();
  const mounted = render(<DocsPortalEditor docsCtx={ctx} />);
  const model = ensure(monaco.editor.model, "Active model");
  vi.mocked(serializeDependentModules).mockImplementationOnce(() => { throw new Error("Invalid dependency"); });
  expect(() => act(() => setParameterCount(1))).not.toThrow();
  expect(screen.getByRole("alert").textContent).toBe("Invalid dependency");
  expect(monaco.editor.model).toBe(model);
  act(() => model.setValue("user recovery code"));
  act(() => setParameterCount(2));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(monaco.editor.model).toBe(model);
  expect(model.getValue()).toContain("user recovery code");
  expect(monaco.models.find((item) => item.uri.toString().endsWith("dependency.tsx"))?.getValue()).toContain("= 2;");
  mounted.unmount();
  ctx.dispose();
});
