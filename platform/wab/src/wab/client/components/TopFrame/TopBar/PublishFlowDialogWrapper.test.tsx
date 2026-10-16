import PreviewPublishSection from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection";
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
  flowMount: vi.fn(),
  flowUnmount: vi.fn(),
  unpublish: vi.fn(),
  getPages: vi.fn(),
  saveEnabled: true,
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
      unpublishPreviewPublication: mocks.unpublish,
      publishPreviewPublication: mocks.buildWebsite,
    },
  }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => ({
    hostFrameApi: {
      publishVersion: mocks.saveVersion,
      getPublishPages: mocks.getPages,
      getLatestPublishedVersionId: mocks.latestVersionId,
    },
  }),
}));
vi.mock("./PublishFlowDialog", () => ({
  default: (props: any) => {
    React.useEffect(() => {
      mocks.flowMount();
      return () => mocks.flowUnmount();
    }, []);
    React.useEffect(() => {
      props.subsectionMeta.saveVersion.setVisibleEnableBlock(
        true,
        mocks.saveEnabled,
        !mocks.saveEnabled,
      );
    }, []);
    return props.website ? (
      <PreviewPublishSection
        {...props.website}
        renderDialog={props.renderDialog}
        currentVersion="1.0.0"
        saveLabel="Save version"
        hasActions={mocks.saveEnabled}
        publish={props.publish}
        close={props.closeDialog}
        success={props.publishState === "success"}
        current={false}
        loading={props.website.loading}
      />
    ) : null;
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
      />
    </SWRConfig>,
  );
  const button = await screen.findByRole("button", {
    name: firstPublication ? "Publish" : "Update publication",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(button.closest(".ant-modal-footer")).toBeTruthy();
  expect(button.closest(".ant-modal-body")).toBeNull();
  return button;
}

describe("website publishing from the dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveEnabled = true;
    mocks.getPages.mockResolvedValue(oldPublication.pages);
    mocks.saveVersion.mockResolvedValue("PreFilling");
    mocks.latestVersionId.mockResolvedValue("new-version-id");
    mocks.buildWebsite.mockResolvedValue({
      publication: { ...oldPublication, version: "0.0.2" },
    });
  });

  it("saves the version without building the website when its checkbox is off", async () => {
    mocks.saveVersion.mockResolvedValue("PreFilling");
    await openDialog();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Also update website when saving a version",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    await waitFor(() => expect(mocks.saveVersion).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Done" });
    expect(mocks.buildWebsite).not.toHaveBeenCalled();
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
          .getByRole("button", { name: "Publishing…" })
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
    fireEvent.click(await openDialog());
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).toHaveBeenCalledOnce();
    expect(mocks.buildWebsite).toHaveBeenCalledOnce();
  });

  it("stops the main action after a failed version save", async () => {
    mocks.saveVersion.mockResolvedValue("SaveFailed");
    fireEvent.click(await openDialog());
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
    const retry = screen.getByRole("button", { name: "Retry publishing" });
    await waitFor(() =>
      expect(retry.classList.contains("ant-btn-loading")).toBe(false),
    );
    fireEvent.click(retry);
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).toHaveBeenCalledTimes(2);
    expect(mocks.buildWebsite).toHaveBeenCalledTimes(2);
  });
  it("reuses the saved version when only website publication is needed", async () => {
    mocks.saveEnabled = false;
    fireEvent.click(await openDialog());
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).not.toHaveBeenCalled();
    expect(mocks.buildWebsite).toHaveBeenCalledOnce();
  });

  it("continues a running publication after closing and reopening its dialog", async () => {
    let completeBuild: (value: any) => void = () => {
      throw new Error("Not started");
    };
    mocks.getPublication.mockResolvedValue({ publication: oldPublication });
    mocks.buildWebsite.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeBuild = resolve;
        }),
    );
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <SWRConfig value={{ provider: () => new Map() }}>
          <button onClick={() => setOpen(true)}>Reopen publication</button>
          <PublishFlowDialogWrapper
            project={{ id: "project" } as any}
            refreshProjectAndPerms={mocks.refreshProject}
            activatedBranch={undefined}
            editorPerm
            latestPublishedVersionData={{
              revisionId: "revision",
              version: "0.0.1",
            }}
            revisionNum={114}
            showPublishModal={open}
            keepPublishModalOpen={false}
            setShowPublishModal={async (value) => setOpen(value)}
          />
        </SWRConfig>
      );
    }
    render(<Harness />);
    const primary = await screen.findByRole("button", {
      name: "Update publication",
    });
    await waitFor(() => expect(primary.hasAttribute("disabled")).toBe(false));
    fireEvent.click(primary);
    await waitFor(() => expect(mocks.buildWebsite).toHaveBeenCalledOnce());
    fireEvent.click(
      screen.getByRole("button", { name: "Continue in background" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.flowUnmount).not.toHaveBeenCalled();
    expect(mocks.flowMount).toHaveBeenCalledOnce();
    expect(document.querySelector(".ant-modal-wrap")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reopen publication" }));
    expect(mocks.flowMount).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("button", { name: "Publishing…" }),
    ).toBeTruthy();
    await act(async () =>
      completeBuild({ publication: { ...oldPublication, version: "0.0.2" } }),
    );
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.saveVersion).toHaveBeenCalledOnce();
    expect(mocks.buildWebsite).toHaveBeenCalledOnce();
  });
  it("builds the existing version when a concurrent save reports it was already published", async () => {
    mocks.saveVersion.mockResolvedValue("SkipAlreadyPublished");
    fireEvent.click(await openDialog());
    await screen.findByText("Published version: 0.0.2");
    expect(mocks.buildWebsite).toHaveBeenCalledOnce();
  });
});
