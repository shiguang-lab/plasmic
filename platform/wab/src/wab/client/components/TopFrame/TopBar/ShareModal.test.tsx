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
vi.mock("@/wab/client/components/widgets/plasmic/ShareDialogContent", () => ({
  default: (props: { closeDialog: () => void }) => {
    mocks.content(props);
    return (
      <div>
        Existing permission controls
        <button onClick={props.closeDialog}>Dismiss</button>
      </div>
    );
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
  const underlyingKey = vi.fn();
  window.addEventListener("keydown", underlyingKey);
  try {
    fireEvent.keyDown(screen.getByRole("button", { name: "Dismiss" }), {
      key: "Escape",
    });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
    expect(underlyingKey).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("keydown", underlyingKey);
  }
  close.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledExactlyOnceWith(false);
  close.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(close).toHaveBeenCalledWith(false);
});

test("uses the native mask to dismiss and ignores dialog content and body events", () => {
  const close = vi.fn().mockResolvedValue(undefined);
  const props = {
    project: { id: "project" } as React.ComponentProps<
      typeof ShareModal
    >["project"],
    perms: [],
    showShareModal: true,
    setShowShareModal: close,
    refreshProjectAndPerms: vi.fn(),
  };
  const { rerender } = render(<ShareModal {...props} />);
  const click = (target: Element) => {
    fireEvent.mouseDown(target);
    fireEvent.mouseUp(target);
    fireEvent.click(target);
  };
  click(screen.getByText("Existing permission controls"));
  expect(close).not.toHaveBeenCalled();
  click(document.body);
  expect(close).not.toHaveBeenCalled();
  const maskArea = screen.getByRole("dialog").closest(".ant-modal-wrap");
  if (!maskArea) {
    throw new Error("Missing native modal mask area");
  }
  click(maskArea);
  expect(close).toHaveBeenCalledExactlyOnceWith(false);
  rerender(<ShareModal {...props} showShareModal={false} />);
  click(document.body);
  expect(close).toHaveBeenCalledTimes(1);
});
