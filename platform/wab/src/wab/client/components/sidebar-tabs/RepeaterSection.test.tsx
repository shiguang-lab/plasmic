import { RepeaterSection } from "@/wab/client/components/sidebar-tabs/RepeaterSection";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewVariantSnapshot } from "@/wab/client/studio-ctx/view-variant-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";

vi.mock("@/wab/client/components/style-controls/StyleComponent", () => {
  class StyleTarget {}
  const passthrough = (value: any) => value;
  const Context = ({ children }: any) => children;
  return {
    StyleTarget,
    TplExpsProvider: class {},
    SingleRsExpsProvider: class {},
    FlexControlHelper: class {},
    StylePanelSection: () => null,
    TabbedStylePanelSection: () => null,
    WithStyleContextMenu: () => null,
    createStyleTarget: () => ({}),
    withStyleComponent: passthrough,
    providesStyleTarget: () => passthrough,
    useStyleTarget: () => ({}),
    getLabelForStyleName: (name: string) => name,
    createStyleContextMenu: () => null,
    makeMobxExpProxy: passthrough,
    StyleTargetContext: { Provider: Context, Consumer: Context },
    SidebarPopupSettingContext: { Provider: Context, Consumer: Context },
    providesSidebarPopupSetting: () => passthrough,
    withSidebarPopupSetting: passthrough,
    useSidebarPopupSetting: () => ({}),
  };
});
vi.mock("@/wab/client/components/style-controls/align-items-controls", () => ({
  AlignItemsControls: () => null,
  alignItemsIcons: {},
}));
vi.mock("@/wab/client/components/sidebar/MixinControls", () => ({
  MixinPreview: () => null,
  MixinPopup: () => null,
  MixinFormContent: () => null,
  MixinsPanel: () => null,
  EditMixinButton: () => null,
}));
vi.mock("@/wab/client/components/style-controls/DefinedIndicator", () => ({
  DefinedIndicator: () => null,
}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentPropsSection", () => ({
  ComponentPropsSection: ({ tpl }: any) => (
    <div data-testid="repeater-props">{tpl.component.name}</div>
  ),
}));

afterEach(() => cleanup());

function change(inst: any, field: string, mutate: () => void): ModelChange {
  mutate();
  return {
    type: "update",
    oldValue: undefined,
    newValue: Reflect.get(inst, field),
    changeNode: { inst, field },
  };
}

it("re-renders the repeater props from its native parent field", () => {
  const models = new ModelSnapshots();
  const first = mkCodeComponent(
    "FirstRepeater",
    { name: "FirstRepeater", importPath: "./FirstRepeater", props: {} },
    {},
  );
  const second = mkCodeComponent(
    "SecondRepeater",
    { name: "SecondRepeater", importPath: "./SecondRepeater", props: {} },
    {},
  );
  const firstParent = mkTplComponent(first, mkBaseVariant());
  const secondParent = mkTplComponent(second, mkBaseVariant());
  const child = mkTplTagX("div");
  child.parent = firstParent;
  const view = {
    studioCtx: { modelSnapshots: models, inspectorSelection: undefined },
    variantStore: createStore<ViewVariantSnapshot>(() => ({
      frames: [],
      global: { targets: [], pins: [] },
      showDefaultSlots: false,
      isEditingNonBaseVariant: false,
  isTargetingNonBaseVariant: false,
    })),
    variantTplMgr: () => ({
      getTargetVariantComboForNode: () => [],
      getEffectiveVariantComboForNode: () => [],
      getTargetIndicatorComboForNode: () => [],
    }),
  } as unknown as ViewCtx;

  try {
    render(<RepeaterSection tpl={child} viewCtx={view} />);
    expect(screen.getByTestId("repeater-props").textContent).toBe(
      "FirstRepeater",
    );

    act(() => {
      models.sync([
        change(child, "parent", () => {
          child.parent = secondParent;
        }),
      ]);
    });
    expect(screen.getByTestId("repeater-props").textContent).toBe(
      "SecondRepeater",
    );
  } finally {
    models.dispose();
  }
});
