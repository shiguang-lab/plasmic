import fs from "node:fs";
import path from "node:path";

const { scanSource } = require("../../../../tools/i18n/audit-studio.cjs") as {
  scanSource: (
    source: string,
    file?: string,
  ) => { text: string; kind: string }[];
};

it("finds dialogs, defaults, conditional text and untranslated interpolation values", () => {
  const found = scanSource(`
    const explanation = failed ? "Deploy failed" : "Ready";
    function Example({ placeholder = "Select..." }) {
      notification.error({ message: explanation });
      message.loading({ content: "Refreshing data..." });
      const help = <Popover content="Run this action" />;
      return <Dialog title="Duplicate" placeholder={placeholder} popover="About this plan" disabledTooltip="No permission" emptyDescription="Nothing here" instruction="Click to duplicate" hoverText="Remove image">
        Select a workspace
        {busy ? "Saving..." : "Save"}
        {t("{state} item", { state: busy ? "Pending" : "Done" })}
        <UiText message="{status}" values={{ status: "Not configured" }} />
        {renderPlasmicSlot({ defaultContents: "No options" })}
      </Dialog>;
    }
  `);
  expect(found.map((x) => x.text)).toEqual(
    expect.arrayContaining([
      "Deploy failed",
      "Ready",
      "Select...",
      "Duplicate",
      "Select a workspace",
      "Saving...",
      "Save",
      "Pending",
      "Done",
      "Not configured",
      "No options",
      "About this plan",
      "No permission",
      "Nothing here",
      "Click to duplicate",
      "Remove image",
      "Refreshing data...",
      "Run this action",
    ]),
  );
});

it("does not confuse translation keys, branch tests, stored values or prop contracts with UI sinks", () => {
  const found = scanSource(`
    const saved = { propName: "selectedValue", value: "English content" };
    const view = <><UiText message="Save" />{t("Saved {name}", { name: saved.value })}
      <input value="English content" />
      {kind === "private" ? t("Private") : t("Public")}
    </>;
  `);
  expect(found).toEqual([]);
});

it("fails on invalid source rather than silently skipping scan coverage", () => {
  expect(() => scanSource("const view = <Dialog")).toThrow();
});

it("finds untranslated imported captions at the rendering and interpolation sites", () => {
  const source = `import { ARENAS_DESCRIPTION as help, VARIANT_CAP, A_DATA_SOURCE_LOWER } from "@/wab/shared/Labels";
    const view = <Dialog tooltip={help} title={t("{part1} name", { part1: String(VARIANT_CAP) })} />;
    const other = <Dialog description={A_DATA_SOURCE_LOWER} />;`;
  const found = scanSource(source) as { text: string; kind: string; line: number }[];
  expect(found.map(item => item.text)).toEqual([
    "Custom arenas are where you can lay out artboards however you want, similar to vector design tools.",
    "Variant", "an integration",
  ]);
  expect(found.map(item => item.line)).toEqual([2, 2, 3]);
  expect(scanSource(`import { ARENAS_DESCRIPTION, VARIANT_CAP } from "@/wab/shared/Labels";
    const view = <Dialog tooltip={<UiText message={ARENAS_DESCRIPTION} />} title={t("{part1} name", { part1: label(VARIANT_CAP) })} />;`)).toEqual([]);
});

it.each([
  ["components/cms/CmsModelDetails.tsx", ["Saved", "Save", "Saving..."]],
  [
    "components/cms/CmsSettingsPage.tsx",
    ["Duplicate CMS Schema", "Duplicating...", "Save"],
  ],
  [
    "components/cms/CmsEntryDetails.tsx",
    ["Auto-saved.", "Saving draft...", "Edited.", "Publish", "Publishing..."],
  ],
  [
    "components/comments/CommentIndicatorIcon.tsx",
    ["comment", "comments", "replies"],
  ],
  ["components/coding/DataInspector.tsx", ["No data available"]],
  [
    "components/ContextMenuIndicator/ContextMenuIndicator.tsx",
    ["Use dynamic value"],
  ],
  [
    "components/TopFrame/TopBar/SubsectionPlasmicHosting.tsx",
    ["Unable to call /api/revalidate", "please retry later"],
  ],
  [
    "components/app-auth/ActivityTab.tsx",
    ["This user will lose access to this app."],
  ],
  ["components/variants/VariantPinButton.tsx", ["Turn off variant", "View variant"]],
  ["components/variants/VariantRow.tsx", ["Stop recording", "Add to recording"]],
  ["components/sidebar/left-panel-utils.tsx", ["Filter by imported projects", "Filtering by: {…}"]],
  ["components/sidebar/ThemesControls.tsx", ["This project's theme", "Theme from {…}"]],
  ["components/github/GithubIntegration.tsx", [
    "Loading organizations...", "Select organization...", "Loading repositories...",
    "Select repository...", "Loading branches...", "Select branch...",
    "Detecting framework...", "Select framework...", "Detecting language...", "Select language...",
  ]],
  ["components/sidebar-tabs/DataSource/DataSourceOpPicker.tsx", ["Switch to a different record", "Configure operation"]],
  ["components/canvas/site-ops.tsx", ["Component converted to page.", "Page converted to reusable component."]],
  ["components/canvas/view-ops.tsx", ["You cannot paste into or around the selected", "element. Try pasting elsewhere."]],
  ["components/copilot/CopilotPromptDialog.tsx", ["Close suggestion history"]],
  ["components/sidebar/RuleSetControls.tsx", ["e.g. :hover, :focus, :nth-child(odd)"]],
  ["components/pages/admin/AdminPage.tsx", ["Are you sure you want to revert to this version?"]],
  ["components/VariantControls.tsx", ["Variant"]],
  ["components/variants/EditableGroupLabel.tsx", ["Variants"]],
  ["components/studio/arenas/ComponentArenaLayout.tsx", ["Variant"]],
  ["components/dashboard/useUpsellQueryParam.ts", ["organization"]],
  ["components/sidebar-tabs/useAnimations.ts", ["animations"]],
  ["components/TopFrame/DataSourcePicker.tsx", ["integration"]],
  ["components/app-auth/PermissionsTab.tsx", ["Add"]],
  ["components/cms/CmsEntryDetails.tsx", [
    "Refreshing data...", "Checking uniqueness violation...", "Updated to latest changes",
    "Your changes have been published.", "Unpublishing {…}...", "Unpublished {…}.",
    "Reverting {…}...", "Reverted {…}.", "Deleting {…}...", "Deleted {…}.",
    "Duplicating {…}...", "A duplicate of {…} has been created. You are now viewing the duplicated entry.",
    "Publish webhook(s) succeeded.", "{…} publish webhook(s) responded with non-2xx response code.",
  ]],
  ["components/pages/admin/AdminTeamsView.tsx", [
    "This cancels the Stripe subscription and puts the organization on the free tier. No refunds will be issued.",
    'This will reset the team trial for team "{…}"', 'This will replace the existing token for team "{…}".',
  ]],
  ["components/sidebar-tabs/StateManagement/ActionBuilder.tsx", ["Current value: {…}", "(cannot display)", "Run this action"]],
])(
  "keeps the reviewed dynamic/default UI path localized: %s",
  (file, leaked) => {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const found = scanSource(source).map((x) => x.text);
    expect(found.filter((text) => leaked.includes(text))).toEqual([]);
  },
);
