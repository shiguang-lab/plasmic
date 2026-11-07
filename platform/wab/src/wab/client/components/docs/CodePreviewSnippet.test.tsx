import type { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import CodePreviewSnippet from "@/wab/client/components/docs/CodePreviewSnippet";
import { createDocsModelFixture } from "@/wab/client/components/docs/__testonly__/model-fixture";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { PlumeDocsExample } from "@/wab/shared/plume/plume-registry";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

const capture = vi.hoisted(() => ({ editor: vi.fn(), viewport: vi.fn() }));
vi.mock("@/wab/client/components/docs/DocsPortalEditor", () => ({
  DocsPortalEditor: (props: { codePreviewCtx: CodePreviewCtx }) => {
    capture.editor(props.codePreviewCtx);
    return null;
  },
}));
vi.mock("@/wab/client/components/docs/DocsPreviewCanvas", () => ({
  DocsPreviewCanvas: (props: { codePreviewCtx: CodePreviewCtx }) => {
    capture.viewport(props.codePreviewCtx);
    return null;
  },
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicCodePreviewSnippet",
  () => ({
    PlasmicCodePreviewSnippet: (props: {
      editor: React.ReactNode;
      viewport: React.ReactNode;
      info: string;
    }) => (
      <div>
        {props.info}
        {props.editor}
        {props.viewport}
      </div>
    ),
  }),
);

afterEach(cleanup);

it.each(["loader", "codegen"] as const)("preserves edited examples across presentation changes in %s while tracking immutable source inputs", async (mode) => {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const component = mgr.addComponent({
    name: "First",
    type: ComponentType.Plain,
  });
  const { ctx } = createDocsModelFixture(site);
  ctx.setCodegenType(mode);
  const componentRef = ctx.models.snapshots.ref(component);
  let example: PlumeDocsExample = {
    title: "Example",
    info: "Before",
    code: "return <Instance />;",
    instances: { "": { props: {} } },
  };
  const content = () => <React.StrictMode><CodePreviewSnippet component={componentRef} docsCtx={ctx} example={example} /></React.StrictMode>;
  const mounted = render(content());
  const current = () =>
    ensure(
      capture.editor.mock.lastCall?.[0],
      "example controller",
    ) as CodePreviewCtx;
  const initial = current();
  await vi.waitFor(() => expect(initial.getCode()).toContain("return"));
  act(() => initial.setCode("user edited code"));
  example = { ...example, info: "After" };
  mounted.rerender(content());
  expect(mounted.getByText("After")).toBeTruthy();
  expect(current()).toBe(initial);
  expect(current().getCode()).toBe("user edited code");
  example = { ...example, code: 'return <div title="changed" />;' };
  mounted.rerender(content());
  const replacement = current();
  expect(replacement).not.toBe(initial);
  expect(replacement.getCode()).toContain('title="changed"');
  expect(capture.viewport.mock.lastCall?.[0]).toBe(replacement);
  await vi.waitFor(() =>
    expect(replacement.getCode()).toContain('title="changed"'),
  );
  expect(initial.getCode()).toBe("user edited code");
  mounted.unmount();
});
