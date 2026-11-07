import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import RootComment from "@/wab/client/components/comments/RootComment";
import { ThreadHistoryStatus } from "@/wab/client/components/comments/ThreadHistoryStatus";
import type { TplCommentThread } from "@/wab/client/components/comments/utils";
import { CopilotPromptImage } from "@/wab/client/components/copilot/CopilotPromptImage";
import { useDepFilterButton } from "@/wab/client/components/sidebar/left-panel-utils";
import { DefaultStylesPanel } from "@/wab/client/components/sidebar/ThemesControls";
import { VariantLabel } from "@/wab/client/components/VariantControls";
import { EditableGroupLabel } from "@/wab/client/components/variants/EditableGroupLabel";
import VariantPinButton from "@/wab/client/components/variants/VariantPinButton";
import VariantRow from "@/wab/client/components/variants/VariantRow";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  ProjectDependency,
} from "@/wab/shared/model/classes";
import { ensure } from "@/wab/shared/common";
import { mkVariant } from "@/wab/shared/Variants";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({
  ctx: undefined as any,
  themes: [] as any[],
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock("@/wab/client/activate-theme", () => ({ activateTheme: vi.fn() }));
vi.mock("@/wab/shared/core/theme-styles", () => ({
  getSelectableThemes: () => fixture.themes.map((theme) => ({ theme })),
}));
vi.mock("@/wab/client/components/ContextMenu", () => ({
  useContextMenu: () => ({}),
}));
vi.mock("@/wab/client/studio-ctx/ui/studio-ui-actions", () => ({
  UiActionsOverlay: () => null,
}));
// Keep rendering boundaries transparent: captions must arrive localized, while
// values and user-authored names must arrive unchanged.
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantPinButton",
  () => ({
    PlasmicVariantPinButton: ({ root, onClick }: any) => (
      <button title={root.tooltip} disabled={root.disabled} onClick={onClick}>
        Pin
      </button>
    ),
  }),
);
vi.mock("@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantRow", () => ({
  PlasmicVariantRow: ({ recordButton }: any) => (
    <button title={recordButton.tooltip} onClick={recordButton.onClick}>
      Record
    </button>
  ),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftThemesPanel",
  () => ({
    default: ({ themeSelector }: any) => (
      <select
        value={themeSelector.props.value}
        onChange={(event) => themeSelector.props.onChange(event.target.value)}
      >
        {themeSelector.props.options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  }),
);
vi.mock("@/wab/client/components/comments/CommentPost", () => ({
  default: ({ subjectLabel }: any) => <div>{subjectLabel}</div>,
}));
vi.mock("@/wab/client/components/widgets/EditableLabel", async () => ({
  EditableLabel: (await import("react")).forwardRef(
    ({ inputBoxPlaceholder, value, onEdit }: any, _ref) => (
      <input
        placeholder={inputBoxPlaceholder}
        value={value}
        onChange={(event) => onEdit(event.target.value)}
      />
    ),
  ),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_comments/PlasmicThreadHistoryStatus",
  () => ({
    PlasmicThreadHistoryStatus: ({ tooltip, status }: any) => (
      <button onClick={status.onClick}>{tooltip.content}</button>
    ),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicCopilotPromptImage",
  () => ({
    PlasmicCopilotPromptImage: ({ tooltip, button }: any) => (
      <button onClick={button.onClick}>{tooltip.content}</button>
    ),
  }),
);

beforeEach(async () => await setLanguagePreference("en"));
afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

it("localizes generated comment and image tooltip defaults through their consuming wrappers", async () => {
  const editThread = vi.fn();
  const onDelete = vi.fn();
  fixture.ctx = { commentsCtx: { editThread } };
  const thread = { id: "thread", resolved: false } as TplCommentThread;
  const view = render(
    <>
      <ThreadHistoryStatus commentThread={thread} />
      <CopilotPromptImage
        image={{ base64: "AA==", type: "png" }}
        onDelete={onDelete}
      />
    </>,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([translate(value, "Resolve"), translate(value, "Delete image")]);
  }
  fireEvent.click(screen.getAllByRole("button")[0]);
  fireEvent.click(screen.getAllByRole("button")[1]);
  expect(editThread).toHaveBeenCalledWith("thread", true);
  expect(onDelete).toHaveBeenCalledOnce();
  view.rerender(
    <ThreadHistoryStatus commentThread={{ ...thread, resolved: true }} />,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(screen.getByRole("button").textContent).toBe(
      translate(value, "Re-open"),
    );
  }
});

it("translates imported variant captions inside placeholders without changing editable names", async () => {
  const variant = mkVariant({ name: "Settings" });
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({ name: "Variants", type: ComponentType.Plain });
  const group = tplMgr.createVariantGroup({ component, name: "Settings" });
  group.param.variable.name = "Settings";
  const onEdit = vi.fn();
  const models = new ModelSnapshots();
  const selection = new StudioSelection(() => models);
  fixture.ctx = { site, modelSnapshots: models, focusedViewCtx: () => undefined, selectionStore: selection.store };
  render(
    <>
      <VariantLabel variant={variant} />
      <EditableGroupLabel group={group} onEdit={onEdit} />
    </>,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.map((input) => input.placeholder)).toEqual([
      translate(value, "{part1} name", { part1: translate(value, "Variant") }),
      translate(value, "{part1} group name", {
        part1: translate(value, "Variants"),
      }),
    ]);
    expect(inputs.map((input) => input.value)).toEqual([
      "Settings",
      "Settings",
    ]);
  }
  expect(onEdit).not.toHaveBeenCalled();
  expect(variant.name).toBe("Settings");
});

it("updates variant actions in every language without changing their handlers or state", async () => {
  const toggle = vi.fn();
  const target = vi.fn();
  const variant = mkVariant({ name: "BusinessVariant" });
  const ctx = {} as StudioCtx;
  const view = render(
    <>
      <VariantPinButton onToggle={toggle} />
      <VariantRow
        studioCtx={ctx}
        variant={variant}
        pinState={undefined}
        onTarget={target}
      />
    </>,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(screen.getByText("Pin").title).toBe(
      translate(value, "View variant"),
    );
    expect(screen.getByText("Record").title).toBe(
      translate(value, "Add to recording"),
    );
  }
  view.rerender(
    <>
      <VariantPinButton pinState="pinnedTrue" onToggle={toggle} />
      <VariantRow
        studioCtx={ctx}
        variant={variant}
        pinState="selected-pinned"
        onTarget={target}
      />
    </>,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(screen.getByText("Pin").title).toBe(
      translate(value, "Turn off variant"),
    );
    expect(screen.getByText("Record").title).toBe(
      translate(value, "Stop recording"),
    );
  }
  fireEvent.click(screen.getByText("Pin"));
  fireEvent.click(screen.getByText("Record"));
  expect(toggle).toHaveBeenCalledOnce();
  expect(target).toHaveBeenCalledWith(false);
  expect(variant.name).toBe("BusinessVariant");
});

it("updates owned and imported theme captions without changing theme ids or project names", async () => {
  const site = createSite();
  const importedSite = createSite();
  const owned = ensure(site.activeTheme, "Owned theme");
  const imported = ensure(importedSite.activeTheme, "Imported theme");
  const originalIds = [owned.defaultStyle.uuid, imported.defaultStyle.uuid];
  const dependency = new ProjectDependency({ uuid: "theme-dependency", pkgId: "theme-pkg", projectId: "theme-project", version: "1.0.0", name: "Business Library", site: importedSite });
  site.projectDependencies.push(dependency);
  const models = new ModelSnapshots();
  fixture.themes = [owned, imported];
  fixture.ctx = {
    site,
    modelSnapshots: models,
    subscribeModelChanges: () => () => undefined,
    projectDependencyManager: { getOwnerDep: () => dependency },
  };
  try {
    render(<DefaultStylesPanel />);
    for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((option) => option.textContent)).toEqual([
      translate(value, "This project's theme"),
      translate(value, "Theme from {project}", { project: dependency.name }),
    ]);
    expect(options.map((option) => option.value)).toEqual(originalIds);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      originalIds[0],
    );
    }
    expect(dependency.name).toBe("Business Library");
  } finally {
    cleanup(); models.dispose();
  }
});

it("updates both dependency filter states while preserving the selected dependency", async () => {
  const dep = { uuid: "dependency" } as ProjectDependency;
  const ctx = {
    projectDependencyManager: { getNiceDepName: () => "Customer Library" },
  } as unknown as StudioCtx;
  function Filter() {
    const { filterProps } = useDepFilterButton({ studioCtx: ctx, deps: [dep] });
    return (
      <>
        <span>{filterProps.tooltip}</span>
        {filterProps.popupRender?.()}
      </>
    );
  }
  const view = render(<Filter />);
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toContain(
      translate(value, "Filter by imported projects"),
    );
  }
  fireEvent.click(screen.getByText("Customer Library"));
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toContain(
      translate(value, "Filtering by: {projects}", {
        projects: '"Customer Library"',
      }),
    );
    expect(
      view.container.querySelector('[role="menuitem"]')?.className,
    ).toContain("selected");
  }
});

it("updates deleted comment locations without translating a user-authored element name", async () => {
  const thread = {
    comments: [{}],
    label: "Deleted variant",
    subjectInfo: {
      ownerComponent: { name: "BusinessPage" },
      ownerComponentName: "BusinessPage",
      variants: undefined,
    },
  } as unknown as TplCommentThread;
  const view = render(<RootComment commentThread={thread} showLocation />);
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toBe(
      `BusinessPage · ${translate(value, "Deleted variant")}`,
    );
  }
  thread.subjectInfo = undefined;
  view.rerender(<RootComment commentThread={{ ...thread }} />);
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toBe(
      translate(value, "Deleted element"),
    );
  }
});
