import PublishFlowDialog from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialog";
import { UiText } from "@/wab/client/i18n/UiText";
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
  code: vi.fn(),
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
  const hostFrameApi = { calculateNextPublishVersion: mocks.calculate };
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
          Save and publish
        </button>
        {props.webhooksDescription.render({
          children: (
            <UiText message="Trigger a build in Vercel, Netlify, Jenkins, or any other CI/CD pipeline. You should first [add Plasmic to your codebase]." />
          ),
        })}
      </>
    ),
  }),
);

function openDialog() {
  const section = () => ({
    visible: true,
    enable: true,
    block: false,
    setVisibleEnableBlock: vi.fn(),
    setup: {},
  });
  render(
    <PublishFlowDialog
      {...({
        appCtx: { api: {} },
        project: { id: "project", name: "Project" },
        subsectionMeta: {
          saveVersion: section(),
          pushDeploy: section(),
          webhooks: section(),
          plasmicHosting: section(),
        },
        setShowCodeModal: mocks.code,
        publish: vi.fn(),
        closeDialog: vi.fn(),
      } as unknown as React.ComponentProps<typeof PublishFlowDialog>)}
    />,
  );
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
  await screen.findByText("Failed to load publishing settings");
  expect(
    screen
      .getByRole("button", { name: "Save and publish" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save and publish" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(mocks.calculate).toHaveBeenCalledTimes(2);
});

it("renders the localized integration link from the real publish description", async () => {
  mocks.calculate.mockResolvedValueOnce({ version: "0.0.1", changeLog: [] });
  openDialog();
  fireEvent.click(
    screen.getByRole("link", { name: "add Plasmic to your codebase" }),
  );
  await waitFor(() => expect(mocks.code).toHaveBeenCalledWith(true));
});

it("retries the actual domain request after a settings failure", () => {
  mocks.domains.error = new Error("Offline");
  mocks.calculate.mockResolvedValueOnce(undefined);
  openDialog();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.retryDomains).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Save and publish" })).toBeNull();
});
