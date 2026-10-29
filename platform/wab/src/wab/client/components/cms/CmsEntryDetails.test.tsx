import CmsEntryDetails from "@/wab/client/components/cms/CmsEntryDetails";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { message } from "antd";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  published: false,
  row: {
    id: "row1",
    revision: 1,
    identifier: "Fixture",
    data: null,
    draftData: {
      "": {
        title: "Before",
        items: [
          { label: "First", nested: [{ label: "Nested" }] },
          { label: "Second" },
        ],
      },
      "zh-CN": { title: "中文" },
    },
  },
}));
vi.mock("@/wab/client/components/cms/cms-contexts", () => ({
  useCmsRow: () => ({
    row: mocks.published
      ? { ...mocks.row, data: mocks.row.draftData, draftData: null }
      : mocks.row,
  }),
  useCmsDatabase: () => ({
    database: { id: "db1", extraData: { locales: ["zh-CN"] } },
  }),
  useCmsTable: () => ({
    id: "table1",
    schema: {
      fields: [
        { identifier: "title", label: "Title", type: "text", localized: true },
        {
          identifier: "items",
          label: "Items",
          type: "list",
          fields: [
            { identifier: "label", label: "Label", type: "text" },
            {
              identifier: "nested",
              label: "Nested",
              type: "list",
              fields: [{ identifier: "label", label: "Label", type: "text" }],
            },
          ],
        },
      ],
    },
  }),
  useMutateRow: () => async () => mocks.row,
  useMutateTableRows: () => vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useApi: () => ({ updateCmsRow: mocks.update }),
}));
vi.mock("@/wab/client/route/useMatchedRoute", () => ({
  useMatchedRoute: () => ({
    pathParams: { databaseId: "db1", tableId: "table1", rowId: "row1" },
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

beforeEach(async () => {
  await setLanguagePreference("en");
  vi.clearAllMocks();
  mocks.published = false;
  mocks.update.mockResolvedValue({});
});

it("enables republishing immediately after unpublishing a previously unchanged entry", async () => {
  mocks.published = true;
  render(<CmsEntryDetails />);
  expect(
    screen
      .getByRole("button", { name: "Publish fixture" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByText("Unpublish entry"));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("row1", {
      identifier: "Fixture",
      data: null,
      draftData: mocks.row.draftData,
      revision: 1,
    }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Publish fixture" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
});
afterEach(async () => {
  cleanup();
  await setLanguagePreference("en");
  vi.clearAllMocks();
});

it("updates an open publish notification in all languages while retaining CMS content", async () => {
  const success = vi.spyOn(message, "success").mockImplementation(vi.fn());
  render(<CmsEntryDetails />);
  fireEvent.click(screen.getByRole("button", { name: "Publish fixture" }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  const notice = success.mock.calls[0][0] as { content: React.ReactNode };
  const view = render(<>{notice.content}</>);
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).toBe(translate(value, "Your changes have been published."));
  }
  expect(mocks.update).toHaveBeenCalledWith("row1", {
    identifier: "Fixture", data: mocks.row.draftData, draftData: null, revision: 1,
  });
});

it("publishes never-expanded nested lists and localized values without losing data", async () => {
  render(<CmsEntryDetails />);
  expect(screen.queryByLabelText("Label")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Publish fixture" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  expect(mocks.update).toHaveBeenCalledWith("row1", {
    identifier: "Fixture",
    data: mocks.row.draftData,
    draftData: null,
    revision: 1,
  });
});

it("autosaves a scalar edit while preserving untouched collapsed nested lists", async () => {
  render(<CmsEntryDetails />);
  fireEvent.change(screen.getByDisplayValue("Before"), {
    target: { value: "After" },
  });
  await waitFor(() => expect(mocks.update).toHaveBeenCalled(), {
    timeout: 4000,
  });
  expect(mocks.update).toHaveBeenCalledWith("row1", {
    identifier: "Fixture",
    draftData: {
      ...mocks.row.draftData,
      "": { ...mocks.row.draftData[""], title: "After" },
    },
    revision: 1,
  });
});
