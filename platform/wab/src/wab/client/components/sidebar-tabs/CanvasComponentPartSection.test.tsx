import { CanvasComponentPartSection } from "@/wab/client/components/sidebar-tabs/CanvasComponentPartSection";
import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewVariantSnapshot } from "@/wab/client/studio-ctx/view-variant-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkParam, mkVar } from "@/wab/shared/core/lang";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { Component, Param } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";

const rowRender = vi.hoisted(() => vi.fn());

vi.mock("@/wab/client/components/sidebar/SidebarSection", () => ({
  SidebarSection: ({ title, children }: any) => (
    <section data-title={title}>{children}</section>
  ),
}));
vi.mock("@/wab/client/components/widgets/Button", () => ({
  default: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({
  PropEditorRowWrapper: ({ param }: any) => {
    rowRender(param);
    return (
      <div data-testid="prop" data-param={param.uuid}>
        {param.variable.name}
      </div>
    );
  },
}));
vi.mock("@/wab/client/components/style-controls/StyleComponent", () => ({
  TplExpsProvider: class {},
}));
vi.mock("@/wab/client/i18n/UiText", () => ({
  UiText: ({ message }: any) => <span>{message}</span>,
}));

afterEach(() => {
  cleanup();
  rowRender.mockClear();
});

function makeView(studioCtx: any, variantStore: any) {
  return {
    studioCtx,
    variantStore,
    setFocusedComponentPart: () => undefined,
  } as unknown as ViewCtx;
}

function change(inst: any, field: string, mutate: () => void): ModelChange {
  mutate();
  return {
    type: "update",
    oldValue: undefined,
    newValue: Reflect.get(inst, field),
    changeNode: { inst, field },
  };
}

function rows() {
  return screen.queryAllByTestId("prop").map((row) => ({
    name: row.textContent,
    param: row.getAttribute("data-param"),
  }));
}

function setup({ params, props }: { params: Param[]; props: string[] }) {
  const models = new ModelSnapshots();
  const component = mkCodeComponent(
    "Dialog",
    { name: "Dialog", importPath: "./Dialog", props: {} },
    {},
  ) as Component;
  component.params.push(...params);
  const site = createSite();
  site.components.push(component);
  const tpl = mkTplComponent(component, mkBaseVariant());
  const part: CanvasComponentPart = {
    tpl,
    name: "confirm",
    displayName: "Confirm",
    selector: "[data-part]",
    props,
    element: document.createElement("button"),
  };
  const variantStore = createStore<ViewVariantSnapshot>(() => ({
    frames: [],
    global: { targets: [], pins: [] },
    showDefaultSlots: false,
    isEditingNonBaseVariant: false,
  isTargetingNonBaseVariant: false,
  }));
  const studioCtx: any = { modelSnapshots: models };
  const view = makeView(studioCtx, variantStore);
  const inspectorStore = createStore(() => ({
    selection: { viewCtx: view, componentPart: part },
    pending: false,
  }));
  studioCtx.inspectorStore = inspectorStore;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const commit = (mutate: () => void) =>
    act(() => {
      models.sync(recorder.withRecording(mutate).changes);
    });
  const dispose = () => {
    recorder.dispose();
    models.dispose();
  };
  return {
    models,
    component,
    view,
    variantStore,
    inspectorStore,
    commit,
    dispose,
  };
}

it("introduces a previously unmatched param by native name and rebinds its variable identity", () => {
  const cardTitle = mkParam({
    name: "draft",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const onConfirm = mkParam({
    name: "onConfirm",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const f = setup({
    params: [cardTitle, onConfirm],
    props: ["cardTitle", "onConfirm"],
  });
  try {
    const selection = f.inspectorStore.getState().selection;
    const variants = f.variantStore.getState();
    const roster = f.models.field(f.component, "params").getState();

    render(<CanvasComponentPartSection viewCtx={f.view} interactions={true} />);
    expect(rows()).toEqual([{ name: "onConfirm", param: onConfirm.uuid }]);

    const beforeIntroduce = rowRender.mock.calls.length;
    f.commit(() => {
      cardTitle.variable.name = "cardTitle";
    });
    expect(rows()).toEqual([
      { name: "cardTitle", param: cardTitle.uuid },
      { name: "onConfirm", param: onConfirm.uuid },
    ]);
    expect(rowRender.mock.calls.length).toBeGreaterThan(beforeIntroduce);
    expect(f.inspectorStore.getState().selection).toBe(selection);
    expect(f.variantStore.getState()).toBe(variants);
    expect(f.models.field(f.component, "params").getState()).toBe(roster);

    const previousVariable = cardTitle.variable;
    const replacementVariable = mkVar("cardTitle");
    f.commit(() => {
      cardTitle.variable = replacementVariable;
    });
    expect(rows()).toEqual([
      { name: "cardTitle", param: cardTitle.uuid },
      { name: "onConfirm", param: onConfirm.uuid },
    ]);
    expect(f.models.field(f.component, "params").getState()).toBe(roster);

    const beforeQuiet = rowRender.mock.calls.length;
    act(() => {
      f.models.sync([
        change(previousVariable, "name", () => {
          previousVariable.name = "onConfirm";
        }),
      ]);
    });
    expect(rows()).toEqual([
      { name: "cardTitle", param: cardTitle.uuid },
      { name: "onConfirm", param: onConfirm.uuid },
    ]);
    expect(rowRender).toHaveBeenCalledTimes(beforeQuiet);

    f.commit(() => {
      replacementVariable.name = "archived";
    });
    expect(rows()).toEqual([{ name: "onConfirm", param: onConfirm.uuid }]);
  } finally {
    f.dispose();
  }
});

it("preserves part prop order, the first matching param, and interaction filtering", () => {
  const betaFirst = mkParam({
    name: "beta",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const betaSecond = mkParam({
    name: "beta",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const gamma = mkParam({
    name: "gamma",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const alpha = mkParam({
    name: "alpha",
    paramType: "prop",
    type: typeFactory.text(),
  });
  const epsilon = mkParam({
    name: "beta",
    paramType: "prop",
    type: typeFactory.func(),
  });
  const f = setup({
    params: [betaFirst, betaSecond, gamma, alpha],
    props: ["gamma", "beta", "alpha"],
  });
  try {
    const roster = f.models.field(f.component, "params").getState();
    const rendered = render(
      <CanvasComponentPartSection viewCtx={f.view} interactions={true} />,
    );
    expect(rows()).toEqual([
      { name: "gamma", param: gamma.uuid },
      { name: "beta", param: betaFirst.uuid },
    ]);

    f.commit(() => {
      betaFirst.variable.name = "delta";
    });
    expect(rows()).toEqual([
      { name: "gamma", param: gamma.uuid },
      { name: "beta", param: betaSecond.uuid },
    ]);
    expect(f.models.field(f.component, "params").getState()).toBe(roster);

    f.commit(() => {
      f.component.params.push(epsilon);
    });
    expect(rows()).toEqual([
      { name: "gamma", param: gamma.uuid },
      { name: "beta", param: betaSecond.uuid },
    ]);

    const betaSecondIndex = f.component.params.indexOf(betaSecond);
    f.commit(() => {
      f.component.params.splice(betaSecondIndex, 1);
    });
    expect(rows()).toEqual([
      { name: "gamma", param: gamma.uuid },
      { name: "beta", param: epsilon.uuid },
    ]);

    f.commit(() => {
      gamma.type = typeFactory.text();
    });
    expect(rows()).toEqual([{ name: "beta", param: epsilon.uuid }]);

    rendered.rerender(
      <CanvasComponentPartSection viewCtx={f.view} interactions={false} />,
    );
    expect(rows()).toEqual([
      { name: "gamma", param: gamma.uuid },
      { name: "alpha", param: alpha.uuid },
    ]);

    rendered.rerender(
      <CanvasComponentPartSection viewCtx={f.view} interactions={true} />,
    );
    expect(rows()).toEqual([{ name: "beta", param: epsilon.uuid }]);
  } finally {
    f.dispose();
  }
});
