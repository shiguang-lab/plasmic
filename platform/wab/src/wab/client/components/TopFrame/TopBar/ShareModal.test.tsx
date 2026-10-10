import { ShareModal } from "@/wab/client/components/TopFrame/TopBar/ShareModal";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
const mocks = vi.hoisted(() => ({
  refreshSiteInfo: vi.fn(),
  content: vi.fn(),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => ({
    hostFrameApi: { refreshSiteInfo: mocks.refreshSiteInfo },
  }),
}));
vi.mock("@/wab/client/components/widgets/Modal", () => ({
  Modal: ({
    children,
    open,
    onCancel,
  }: {
    children: React.ReactNode;
    open: boolean;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <button onClick={onCancel}>Dismiss</button>
        {children}
      </div>
    ) : null,
}));
vi.mock("@/wab/client/components/widgets/plasmic/ShareDialogContent", () => ({
  default: (props: object) => {
    mocks.content(props);
    return <div>Existing permission controls</div>;
  },
}));
afterEach(cleanup);
test("opens the original standalone permission dialog without delivery tabs", () => {
  const close = vi.fn().mockResolvedValue(undefined);
  const project = { id: "project" } as React.ComponentProps<
    typeof ShareModal
  >["project"];
  const perms: React.ComponentProps<typeof ShareModal>["perms"] = [];
  render(
    <ShareModal
      project={project}
      perms={perms}
      showShareModal
      setShowShareModal={close}
      refreshProjectAndPerms={vi.fn()}
    />,
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("Existing permission controls")).toBeTruthy();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(mocks.content).toHaveBeenCalledWith(
    expect.objectContaining({
      resource: { type: "project", resource: project },
      perms,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(close).toHaveBeenCalledWith(false);
});
