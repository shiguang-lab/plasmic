import PublishFlowDialogWrapper from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialogWrapper";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveVersion: vi.fn(),
  latestVersionId: vi.fn(),
  getPublication: vi.fn(),
  buildWebsite: vi.fn(),
  refreshProject: vi.fn(),
  asyncState: { loading: false, value: null },
}));

vi.mock("@/wab/client/api", () => ({ apiKey: (...parts: string[]) => parts }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    appConfig: { previewOrigin: "https://preview.example.com" },
    api: {
      getPreviewPublication: mocks.getPublication,
      publishPreviewPublication: mocks.buildWebsite,
    },
  }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => ({
    hostFrameApi: {
      publishVersion: mocks.saveVersion,
      getLatestPublishedVersionId: mocks.latestVersionId,
    },
  }),
}));
vi.mock("./PublishFlowDialog", () => ({
  default: (props: any) => {
    React.useEffect(() => {
      props.subsectionMeta.saveVersion.setVisibleEnableBlock(true, true, false);
    }, []);
    return (
      <>
        {props.websiteSection}
        <button disabled={props.websiteBusy} onClick={props.publish}>
          Publish version
        </button>
      </>
    );
  },
}));
vi.mock("./PublishWizard", () => ({ default: () => null }));
vi.mock("./TopBarModal", () => ({
  TopBarModal: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("./SubsectionSaveVersion", () => ({
  mkSaveVersionPublishState: (status: any) =>
    !status?.enabled
      ? undefined
      : status.result === "Success"
        ? "success"
        : !status.result || status.result === "PreFilling"
          ? "publishing"
          : "failure",
}));
vi.mock("./SubsectionPushDeploy", () => ({
  mkPushDeployPublishState: () => undefined,
}));
vi.mock("./SubsectionWebhooks", () => ({
  mkWebhooksPublishState: () => undefined,
}));
vi.mock("@/wab/client/hooks/useAsyncStrict", () => ({
  useAsyncFnStrict: () => [mocks.asyncState, async () => null],
  useAsyncStrict: () => ({ loading: false }),
}));
vi.mock("@/wab/client/components/TopFrame/TopFrameChrome", () => ({
  topFrameTourSignals: { dispatch: vi.fn() },
}));
vi.mock("@/wab/client/components/widgets/plasmic/ShareDialogContent", () => ({
  personalProjectPaywallMessage: "Publishing unavailable",
}));
vi.mock("@/wab/client/tracking", () => ({ trackEvent: vi.fn() }));
vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  notification: { warning: vi.fn(), error: vi.fn() },
}));

const oldPublication = {
  projectId: "project",
  code: "0123456789",
  enabled: true,
  version: "0.0.1",
  entryPath: "/groups",
  pages: [{ id: "groups", name: "Groups", path: "/groups" }],
  url: "https://preview.example.com/s/0123456789",
  publishedAt: "2026-10-08T10:00:00Z",
};

async function openDialog(firstPublication = false) {
  mocks.getPublication.mockResolvedValue({
    publication: firstPublication ? null : oldPublication,
  });
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <PublishFlowDialogWrapper
        project={{ id: "project" } as any}
        refreshProjectAndPerms={mocks.refreshProject}
        activatedBranch={undefined}
        editorPerm={true}
        latestPublishedVersionData={
          firstPublication
            ? undefined
            : { revisionId: "revision", version: "0.0.1" }
        }
        revisionNum={114}
        showPublishModal={true}
        keepPublishModalOpen={false}
        setShowPublishModal={vi.fn()}
        setShowCodeModal={vi.fn()}
      />
    </SWRConfig>,
  );
  const button = await screen.findByRole("button", {
    name: firstPublication ? "Publish website" : "Update website",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  return button;
}

describe("website publishing from the dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveVersion.mockResolvedValue("PreFilling");
    mocks.latestVersionId.mockResolvedValue("new-version-id");
    mocks.buildWebsite.mockResolvedValue({
      publication: { ...oldPublication, version: "0.0.2" },
    });
  });

  it.each([false, true])(
    "saves current contents before direct publication (first publication: %s)",
    async (first) => {
      let finishSave: (result: string) => void = () => {
        throw new Error("Saving has not started");
      };
      mocks.saveVersion.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishSave = resolve;
          }),
      );
      fireEvent.click(await openDialog(first));
      expect(mocks.saveVersion).toHaveBeenCalledWith([], "", undefined);
      expect(mocks.buildWebsite).not.toHaveBeenCalled();
      expect(
        screen
          .getByRole("button", { name: "Publish version" })
          .hasAttribute("disabled"),
      ).toBe(true);
      await act(async () => {
        finishSave("PreFilling");
      });
      await waitFor(() =>
        expect(mocks.buildWebsite).toHaveBeenCalledWith(
          "project",
          first ? undefined : "/groups",
        ),
      );
      await screen.findByText("Published version: 0.0.2");
      expect(mocks.refreshProject).toHaveBeenCalledOnce();
    },
  );

  it.each(["SaveFailed", "OutOfDate", "UnknownError", "PaywallError"])(
    "keeps the existing website when saving returns %s",
    async (result) => {
      mocks.saveVersion.mockResolvedValue(result);
      fireEvent.click(await openDialog());
      await screen.findByText("Website publishing failed");
      expect(mocks.buildWebsite).not.toHaveBeenCalled();
      expect(screen.getByRole("link").getAttribute("href")).toBe(
        oldPublication.url,
      );
      expect(screen.getByText("Published version: 0.0.1")).toBeTruthy();
    },
  );

  it("saves only once when website publishing is included in the main action", async () => {
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Publish version" }));
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).toHaveBeenCalledOnce();
    expect(mocks.buildWebsite).toHaveBeenCalledOnce();
  });

  it("stops the main action after a failed version save", async () => {
    mocks.saveVersion.mockResolvedValue("SaveFailed");
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Publish version" }));
    await screen.findByText("Website publishing failed");
    expect(mocks.buildWebsite).not.toHaveBeenCalled();
  });

  it("retains the live link after build failure and retries with current changes", async () => {
    mocks.buildWebsite.mockRejectedValueOnce(
      new Error("Code generation failed"),
    );
    fireEvent.click(await openDialog());
    await screen.findByText("Code generation failed");
    expect(screen.getByText("Published version: 0.0.1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update website" }));
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).toHaveBeenCalledTimes(2);
    expect(mocks.buildWebsite).toHaveBeenCalledTimes(2);
  });
});
