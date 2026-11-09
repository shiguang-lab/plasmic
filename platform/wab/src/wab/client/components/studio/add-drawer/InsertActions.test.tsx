import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createSite } from "@/wab/shared/core/sites";
import { ModelRevisions } from "@/wab/shared/model-revisions";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { InsertActions } from "@/wab/client/components/studio/add-drawer/AddDrawerItem";
import { InsertRelLoc } from "@/wab/client/components/canvas/view-ops";
import {
  AddItemType,
  AddTplItem,
} from "@/wab/client/definitions/insertables";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (text: string, values?: Record<string, unknown>) =>
      values
        ? Object.entries(values).reduce(
            (message, [key, value]) =>
              message.replace(`{${key}}`, String(value)),
            text,
          )
        : text,
  }),
}));

afterEach(cleanup);

it("rebinds insert actions when native selection focus changes", () => {
  const models = new ModelSnapshots();
  const site = createSite();
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  const selection = new StudioSelection(() => models);
  selection.set(mock<ViewCtx>(), []);
  const revisions = new ModelRevisions();
  const studioCtx = mock<StudioCtx>({ selectionStore: selection.store, getCodeRegistrationRevision: () => "0:0", subscribeCodeRegistrations: () => () => undefined });
  Object.defineProperties(studioCtx, { modelRevisions: { value: revisions }, modelSnapshots: { value: models }, site: { value: site }, arenaState: { value: arenaState } });
  const item: AddTplItem = {
    type: AddItemType.tpl,
    key: "tpl-text",
    label: "Text",
    icon: null,
    factory: () => undefined,
    canWrap: true,
  };

  const mounted = render(
    <InsertActions
      studioCtx={studioCtx}
      item={item}
      validTplLocs={new Set([InsertRelLoc.wrap])}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Wrap current selection with Text" }),
  ).toBeInTheDocument();

  act(() => selection.set(undefined, []));

  expect(
    screen.queryByRole("button", { name: /Wrap current selection/ }),
  ).toBeNull();
  mounted.unmount();
  arenaState.dispose();
  revisions.dispose();
  selection.dispose();
  models.dispose();
});
