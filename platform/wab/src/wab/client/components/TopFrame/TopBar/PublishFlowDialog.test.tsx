import { showError } from "@/wab/client/ErrorNotifications";
vi.mock("@/wab/client/ErrorNotifications", async (original) => ({
  ...(await original<typeof import("@/wab/client/ErrorNotifications")>()),
  showError: vi.fn(),
}));
import PublishFlowDialog from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialog";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
  retryDomains: vi.fn(),
  domains: { isLoading: false, error: undefined as Error | undefined },
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/client/api-hooks", () => ({
  useGetDomainsForProject: () => ({
    ...mocks.domains,
    data: { domains: [] },
    mutate: mocks.retryDomains,
  }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => {
  const hostFrameApi = {
    calculateNextPublishVersion: mocks.calculate,
    getProjectReleases: async () => [],
    switchLeftTab: vi.fn(),
  };
  return { useTopFrameCtx: () => ({ hostFrameApi }) };
});
vi.mock("@/wab/client/hooks/useAsyncStrict", () => ({
  useAsyncFnStrict: () => [{}, vi.fn()],
  useAsyncStrict: () => ({}),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog",
  () => ({
    PlasmicPublishFlowDialog: (props: any) => (
      <>
        <button
          disabled={props.publishButton.disabled}
          onClick={props.publishButton.onClick}
        >
          {props.publishButton.children}
        </button>
        {props.webhooksDescription.children}
      </>
    ),
  }),
);

vi.mock("./SubsectionPushDeploy", () => ({ default: () => null }));
vi.mock("./SubsectionWebhooks", () => ({ default: () => null }));

function openDialog(
  integrations = true,
  website?: React.ComponentProps<typeof PublishFlowDialog>["website"],
  integrationVisible = true,
) {
  const section = () => ({
    visible: true,
    enable: true,
    block: false,
    setVisibleEnableBlock: vi.fn(),
    setup: {
      tags: [],
      description: "",
      setDescription: vi.fn(),
      setTags: vi.fn(),
    },
  });
  const subsectionMeta = {
    saveVersion: section(),
    pushDeploy: {
      ...section(),
      enable: integrations,
      visible: integrationVisible,
    },
    webhooks: {
      ...section(),
      enable: integrations,
      visible: integrationVisible,
    },
    plasmicHosting: section(),
  };
  render(
    <PublishFlowDialog
      {...({
        appCtx: { api: {}, appConfig: { enablePlasmicHosting: false } },
        project: { id: "project", name: "Project" },
        subsectionMeta,
        website,
        renderDialog: (body: React.ReactNode, footer: React.ReactNode) => (
          <>
            {body}
            {footer}
          </>
        ),
        latestPublishedVersionData: { version: "1.0.0", revisionId: "rev" },
        publish: vi.fn(),
        closeDialog: vi.fn(),
      } as unknown as React.ComponentProps<typeof PublishFlowDialog>)}
    />,
  );
  return subsectionMeta;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.domains = { isLoading: false, error: undefined };
});

it("recovers version calculation instead of leaving publishing stuck in loading", async () => {
  mocks.calculate
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ version: "0.0.1", changeLog: [] });
  openDialog();
  await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.any(Error), { title: "Failed to load publishing settings" }));
  expect(
    screen
      .getByRole("button", {
        name: /Loading\.\.\.|Save version and run integrations/,
      })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", {
          name: /Loading\.\.\.|Save version and run integrations/,
        })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(mocks.calculate).toHaveBeenCalledTimes(2);
});

it("describes build integrations without opening code onboarding", async () => {
  mocks.calculate.mockResolvedValueOnce({ version: "0.0.1", changeLog: [] });
  openDialog();
  expect(
    screen.getByText(
      "Trigger a build in Vercel, Netlify, Jenkins, or any other CI/CD pipeline.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "add Plasmic to your codebase" }),
  ).toBeNull();
});

it("retries the actual domain request after a settings failure", () => {
  mocks.domains.error = new Error("Offline");
  mocks.calculate.mockResolvedValueOnce(undefined);
  openDialog();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.retryDomains).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole("button", {
      name: /Loading\.\.\.|Save version and run integrations/,
    }),
  ).toBeNull();
});

it("names the version-only action without promising website publication", async () => {
  mocks.calculate.mockResolvedValueOnce({ version: "0.0.1", changeLog: [] });
  openDialog(false);
  expect(
    await screen.findByRole("button", { name: "Save version" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publish website" })).toBeNull();
});

const website = {
  enabled: true,
  setEnabled: vi.fn(),
  publication: {
    projectId: "project",
    code: "code",
    enabled: true,
    version: "1.0.0",
    entryPath: "/groups",
    pages: [{ id: "groups", name: "Groups", path: "/groups" }],
    url: "https://preview.example.com/s/code",
    publishedAt: "2026-10-16",
  },
  pages: [{ id: "groups", name: "Groups", path: "/groups" }],
  entryPath: "/groups",
  setEntryPath: vi.fn(),
  busy: false,
  loading: false,
  canEdit: true,
  unpublish: vi.fn(),
  retry: vi.fn(),
};
it("uses one website action and disables republishing unchanged content", async () => {
  mocks.calculate.mockResolvedValue(undefined);
  openDialog(false, website);
  const button = await screen.findByRole("button", {
    name: "Already up to date",
  });
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Save version" })).toBeNull();
});
it("allows publishing a saved version that is newer than the live website", async () => {
  mocks.calculate.mockResolvedValue(undefined);
  openDialog(false, {
    ...website,
    publication: { ...website.publication, version: "0.0.1" },
  });
  const button = await screen.findByRole("button", {
    name: "Update publication",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
});
it("detects an entry-page change even when the saved version is unchanged", async () => {
  mocks.calculate.mockResolvedValue(undefined);
  openDialog(false, { ...website, entryPath: "/other" });
  const button = await screen.findByRole("button", {
    name: "Update publication",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
});

it("opens the existing integration setup from the two add-action cards", async () => {
  mocks.calculate.mockResolvedValue(undefined);
  const sections = openDialog(false, website, false);
  expect(
    await screen.findByRole("region", { name: "Add publish actions" }),
  ).toBeTruthy();
  expect(
    screen.getByText("Generate a new Next.js / Gatsby / React repo."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Push to GitHub" }));
  expect(sections.pushDeploy.setVisibleEnableBlock).toHaveBeenCalledWith(
    true,
    false,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Call webhooks" }));
  expect(sections.webhooks.setVisibleEnableBlock).toHaveBeenCalledWith(
    true,
    true,
    true,
  );
  expect(screen.queryByText("More publishing options")).toBeNull();
});
