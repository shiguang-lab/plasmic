import CmsEntryDetails from "@/wab/client/components/cms/CmsEntryDetails";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  mutate: vi.fn(),
  row: undefined as unknown,
  table: undefined as unknown,
  database: undefined as unknown,
  pathParams: {} as Record<string, string>,
  listeners: new Set<() => void>(),
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsRow: () => ({
    row: React.useSyncExternalStore(
      (listener) => {
        mocks.listeners.add(listener);
        return () => {
          mocks.listeners.delete(listener);
        };
      },
      () => mocks.row,
    ),
  }),
  useCmsDatabase: () => ({ database: mocks.database }),
  useCmsTable: () => mocks.table,
  useMutateRow: () => mocks.mutate,
  useMutateTableRows: () => vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({ updateCmsRow: mocks.update }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: mocks.pathParams,
  }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: vi.fn() }),
}));
vi.mock("@/wab/client/route/useBeforeNavigation", () => ({
  useBeforeNavigation: vi.fn(),
}));
vi.mock("@/wab/client/route/Switch", () => ({
  Switch: () => null,
  switchCase: (x: unknown) => x,
  switchDefault: (x: unknown) => x,
}));
vi.mock("@/wab/client/components/cms/CmsEntryHistory", () => ({
  CmsEntryHistory: () => null,
}));
vi.mock("@/wab/client/components/cms/CmsEntryCloneModal", () => ({
  CmsEntryCloneModal: () => null,
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsEntryDetails", () => ({
  PlasmicCmsEntryDetails: {
    left: () => null,
    right: (props: any) => (
      <div>
        {props.menuButton.menu()}
        {props.publishButton.render({}, (p: any) => (
          <button {...p}>Publish fixture</button>
        ))}
      </div>
    ),
  },
}));

afterEach(cleanup);
it("keeps collapsed nested and localized values through local database publish, unpublish, reopen and republish", async () => {
  const { withDb, getTeamAndWorkspace } =
    await import("@/wab/server/__testonly__/backend-util");
  const { CmsMetaType, cmsFieldMetaDefaults } =
    await import("@/wab/shared/ApiSchema");
  await withDb(async (_sudo, _users, [getDb]) => {
    const mgr = getDb();
    const { workspace } = await getTeamAndWorkspace(mgr);
    const database = await mgr.createCmsDatabase({
      name: "Local audit CMS",
      workspaceId: workspace.id,
    });
    await mgr.updateCmsDatabaseById(database.id, {
      extraData: { locales: ["zh-CN"] },
    });
    const table = await mgr.createCmsTable({
      databaseId: database.id,
      identifier: "audit",
      name: "Audit",
      schema: {
        fields: [
          {
            ...cmsFieldMetaDefaults,
            defaultValueByLocale: {},
            identifier: "title",
            label: "Title",
            type: CmsMetaType.TEXT,
            localized: true,
          },
          {
            ...cmsFieldMetaDefaults,
            defaultValueByLocale: {},
            identifier: "items",
            label: "Items",
            type: CmsMetaType.LIST,
            fields: [
              {
                ...cmsFieldMetaDefaults,
                defaultValueByLocale: {},
                identifier: "label",
                label: "Label",
                type: CmsMetaType.TEXT,
              },
              {
                ...cmsFieldMetaDefaults,
                defaultValueByLocale: {},
                identifier: "nested",
                label: "Nested",
                type: CmsMetaType.LIST,
                fields: [
                  {
                    ...cmsFieldMetaDefaults,
                    defaultValueByLocale: {},
                    identifier: "label",
                    label: "Label",
                    type: CmsMetaType.TEXT,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const content = {
      "": {
        title: "Local audit",
        items: [
          { label: "First", nested: [{ label: "Nested" }] },
          { label: "Second" },
        ],
      },
      "zh-CN": { title: "本地完整数据" },
    };
    const row = await mgr.createCmsRow(table.id, {
      identifier: "Local audit",
      data: null,
      draftData: content,
    });
    mocks.database = await mgr.getCmsDatabaseById(database.id);
    mocks.table = table;
    mocks.row = row;
    mocks.pathParams = {
      databaseId: database.id,
      tableId: table.id,
      rowId: row.id,
    };
    mocks.update.mockImplementation((id, fields) =>
      mgr.updateCmsRow(id, fields),
    );
    mocks.mutate.mockImplementation(async () => {
      mocks.row = await mgr.getCmsRowById(row.id);
      mocks.listeners.forEach((listener) => listener());
      return mocks.row;
    });
    let view = render(<CmsEntryDetails />);
    expect(screen.queryByLabelText("Label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Publish fixture" }));
    await waitFor(async () =>
      expect((await mgr.getCmsRowById(row.id)).data).toEqual(content),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Publish fixture" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    fireEvent.click(screen.getByText("Unpublish entry"));
    await waitFor(async () => {
      const unpublished = await mgr.getCmsRowById(row.id);
      expect(unpublished.data).toBeNull();
      expect(unpublished.draftData).toEqual(content);
    });
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Publish fixture" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    view.unmount();
    mocks.row = await mgr.getCmsRowById(row.id);
    view = render(<CmsEntryDetails />);
    expect(screen.getByDisplayValue("Local audit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish fixture" }));
    await waitFor(async () =>
      expect((await mgr.getCmsRowById(row.id)).data).toEqual(content),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Publish fixture" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    view.unmount();
    const fresh = await mgr.getCmsRowById(row.id);
    expect(fresh.draftData).toBeNull();
    expect(fresh.data).toEqual(content);
  });
});
