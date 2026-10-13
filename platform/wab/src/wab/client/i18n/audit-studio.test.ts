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
])(
  "keeps the reviewed dynamic/default UI path localized: %s",
  (file, leaked) => {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const found = scanSource(source).map((x) => x.text);
    expect(found.filter((text) => leaked.includes(text))).toEqual([]);
  },
);
