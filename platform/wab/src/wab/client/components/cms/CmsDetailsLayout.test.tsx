import {
  CmsEntryDetailsLayout,
  CmsModelDetailsLayout,
  CmsSettingsLayout,
} from "@/wab/client/components/cms/CmsDetailsLayout";
import { CmsContentLoading } from "@/wab/client/components/cms/CmsLoading";
import { CmsModelsListLayout } from "@/wab/client/components/cms/CmsModelsList";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/PublicLink", () => ({
  PublicLink: (props) => <a {...props} />,
}));
vi.mock("@/wab/client/contexts/AppContexts", async () => ({
  AppCtxContext: (await import("react")).createContext(undefined),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(["entry", "schema", "settings"])(
  "keeps the %s toolbar outside its single shared scroll viewport",
  async (kind) => {
    const field = <input aria-label="Last field" defaultValue="Editable" />;
    const ref = React.createRef<HTMLDivElement>();
    const view = render(
      kind === "entry" ? (
        <CmsEntryDetailsLayout
          ref={ref}
          entryNameValue="Audit entry"
          saveStatus="Auto-saved."
        >
          {field}
        </CmsEntryDetailsLayout>
      ) : kind === "schema" ? (
        <CmsModelDetailsLayout ref={ref} modelNameValue="Audit model">
          {field}
        </CmsModelDetailsLayout>
      ) : (
        <CmsSettingsLayout ref={ref} details="1 model" content={field} />
      ),
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll("[data-overlayscrollbars]"),
      ).toHaveLength(1),
    );
    const host = view.container.querySelector("[data-overlayscrollbars]");
    expect(
      screen.getByLabelText("Last field").closest("[data-overlayscrollbars]"),
    ).toBe(host);
    expect(
      screen
        .getByRole("button", { name: kind === "entry" ? "Publish" : "Save" })
        .closest("[data-overlayscrollbars]"),
    ).toBeNull();
    expect(ref.current).toBe(view.container.firstElementChild);
    expect(
      getComputedStyle(ensure(ref.current, "Missing details layout root"))
        .minHeight,
    ).toBe("0");
    fireEvent.change(screen.getByLabelText("Last field"), {
      target: { value: "After" },
    });
    expect(screen.getByLabelText("Last field")).toHaveValue("After");
  },
);

it("keeps active and archived models in one viewport with a fixed search input", async () => {
  function Fixture() {
    return (
      <CmsModelsListLayout
        searchInput={{ value: "", onChange: vi.fn() }}
        archivedModels={<div>Archived model</div>}
        collapsedState={React.useState(false)}
      >
        <div>Active model</div>
      </CmsModelsListLayout>
    );
  }
  const view = render(<Fixture />);
  await waitFor(() =>
    expect(
      view.container.querySelectorAll("[data-overlayscrollbars]"),
    ).toHaveLength(1),
  );
  const host = screen
    .getByText("Active model")
    .closest("[data-overlayscrollbars]");
  expect(
    screen.getByText("Archived model").closest("[data-overlayscrollbars]"),
  ).toBe(host);
  expect(
    screen
      .getByPlaceholderText("Filter...")
      .closest("[data-overlayscrollbars]"),
  ).toBeNull();
});

it.each([false, true])(
  "uses bounded shared scroll regions while loading, schema=%s",
  async (schema) => {
    const view = render(<CmsContentLoading schema={schema} />);
    await waitFor(() =>
      expect(
        view.container.querySelectorAll("[data-overlayscrollbars]"),
      ).toHaveLength(schema ? 2 : 3),
    );
    expect(view.container.querySelector(".max-scrollable")).toBeNull();
    for (const host of view.container.querySelectorAll(
      "[data-overlayscrollbars]",
    )) {
      expect(
        host.parentElement?.closest("[data-overlayscrollbars]"),
      ).toBeNull();
    }
  },
);
