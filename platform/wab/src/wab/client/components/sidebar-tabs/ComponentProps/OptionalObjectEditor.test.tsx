import { InnerPropEditorRow, PropValueEditorContext } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { ExprCtx, getRawCode } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { getProjectFlags } from "@/wab/shared/devflags";
import { tryEvalExpr } from "@/wab/shared/eval";
import { Expr, ensureKnownExpr } from "@/wab/shared/model/classes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/contexts/StudioContexts", async () => ({
  useStudioCtx: () => ({ site: createSite(), siteInfo: { id: "test" }, customFunctionsSchema: () => ({}), projectFlags: () => ({}) }),
  StudioCtxContext: (await import("react")).createContext(undefined),
}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/CodeEditor", () => ({
  checkStrSizeLimit: () => true,
  CodeEditor: ({ title, value, onChange, templateVariables, lang }: any) => (
    <>
      <textarea aria-label={title} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <output>{JSON.stringify({ lang, templateVariables })}</output>
    </>
  ),
}));

const exprCtx: ExprCtx = { component: null, inStudio: true, projectFlags: getProjectFlags(createSite()) };
const showCount = {
  type: "object" as const,
  toggleable: true,
  fields: { formatter: { type: "string" as const, control: "large" as const, templateVariables: ["count", "maxLength"] } },
};

afterEach(cleanup);

it("enables an object, edits the nested template with the code editor and clears it through the switch", () => {
  const saved = vi.fn();
  function Harness() {
    const [value, setValue] = React.useState<Expr>();
    return (
      <PropValueEditorContext.Provider value={{ componentPropValues: {}, ccContextData: {}, paramOwnerNames: [], env: {}, exprCtx }}>
        <InnerPropEditorRow
          attr="showCount"
          label="Show count"
          propType={showCount}
          expr={value}
          onDelete={() => { setValue(undefined); saved(undefined); }}
          controlExtras={{ path: ["showCount"] }}
          onChange={(next) => {
            const expression = next === undefined ? undefined : ensureKnownExpr(next);
            setValue(expression);
            if (expression === undefined) {
              saved(undefined);
            } else {
              const result = tryEvalExpr(getRawCode(expression, exprCtx), {});
              expect(result.err).toBeUndefined();
              saved(result.val);
            }
          }}
        />
      </PropValueEditorContext.Provider>
    );
  }
  const view = render(<Harness />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("switch"));
  expect(saved).toHaveBeenLastCalledWith({});
  expect(screen.getByRole("textbox", { name: "Formatter" })).toBeTruthy();
  expect(screen.getByText(JSON.stringify({ lang: "text", templateVariables: ["count", "maxLength"] }))).toBeTruthy();

  const template = "已输入 {count} / {maxLength} 字";
  fireEvent.change(screen.getByRole("textbox"), { target: { value: template } });
  expect(saved).toHaveBeenLastCalledWith({ formatter: template });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(template);

  fireEvent.click(screen.getByRole("switch"));
  expect(saved).toHaveBeenLastCalledWith(undefined);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("switch"));
  expect(saved).toHaveBeenLastCalledWith({});
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  view.unmount();
});
