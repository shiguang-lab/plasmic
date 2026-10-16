import PreviewPublishSection, {
  PreviewPublishSectionProps,
} from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection";
import { PublishModal } from "@/wab/client/components/TopFrame/TopBar/PublishModal";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const copy = vi.hoisted(() => vi.fn().mockReturnValue(true));
vi.mock("copy-to-clipboard", () => ({ default: copy }));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
}));

const publication = {
  projectId: "project",
  code: "0123456789",
  version: "1.0.0",
  enabled: true,
  entryPath: "/groups",
  pages: [{ id: "groups", name: "Groups", path: "/groups" }],
  publishedAt: new Date().toISOString(),
  url: "https://preview.example.com/s/0123456789",
};
function props(
  overrides: Partial<PreviewPublishSectionProps> = {},
): PreviewPublishSectionProps {
  return {
    publication,
    pages: publication.pages,
    enabled: true,
    setEnabled: vi.fn(),
    hasActions: true,
    saveLabel: "Save version",
    currentVersion: "1.0.0",
    entryPath: "/groups",
    setEntryPath: vi.fn(),
    busy: false,
    loading: false,
    success: false,
    current: false,
    canEdit: true,
    publish: vi.fn(),
    unpublish: vi.fn(),
    close: vi.fn(),
    renderDialog: (body, footer) => (
      <PublishModal open compact onClose={() => {}} footer={footer}>
        {body}
      </PublishModal>
    ),
    ...overrides,
  };
}

it("has one publishing action, copies the live link, and confirms unpublishing", async () => {
  const actions = props();
  render(<PreviewPublishSection {...actions} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(copy).toHaveBeenCalledWith(publication.url);
  fireEvent.click(screen.getByRole("button", { name: "Update publication" }));
  expect(actions.publish).toHaveBeenCalledOnce();
  vi.mocked(reactConfirm).mockResolvedValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "Unpublish website…" }));
  await waitFor(() => expect(reactConfirm).toHaveBeenCalledOnce());
  expect(actions.unpublish).not.toHaveBeenCalled();
  vi.mocked(reactConfirm).mockResolvedValueOnce(true);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Unpublish website…" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Unpublish website…" }));
  await waitFor(() => expect(actions.unpublish).toHaveBeenCalledOnce());
});

it("keeps website settings in their section and the publishing action in the footer", () => {
  const actions = props({ publication: null });
  render(<PreviewPublishSection {...actions} />);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Also update website when saving a version",
    }),
  );
  expect(actions.setEnabled).toHaveBeenCalledWith(false);
  const button = screen.getByRole("button", { name: "Publish" });
  expect(button.closest(".ant-modal-footer")).toBeTruthy();
  expect(button.closest(".ant-modal-body")).toBeNull();
  expect(screen.getByRole("combobox").closest(".ant-modal-body")).toBeTruthy();
  expect(document.querySelector(".ant-modal-body footer")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(actions.publish).toHaveBeenCalledOnce();
});

it("keeps the live link and allows closing while actual publication continues", () => {
  const actions = props({ busy: true, phase: "building" });
  render(<PreviewPublishSection {...actions} />);
  const publish = screen.getByRole("button", { name: "Publishing…" });
  expect(publish.hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("More publishing options")).toBeNull();
  expect(screen.getByRole("link").getAttribute("href")).toBe(publication.url);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue in background" }),
  );
  expect(actions.close).toHaveBeenCalledOnce();
  expect(actions.publish).not.toHaveBeenCalled();
});

it("retains the live version after failure and offers retry", () => {
  const actions = props({ error: new Error("Build failed") });
  render(<PreviewPublishSection {...actions} />);
  expect(screen.getByText("Build failed")).toBeTruthy();
  expect(screen.getByText("Published version: 1.0.0")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry publishing" }));
  expect(actions.publish).toHaveBeenCalledOnce();
});

it("disables repeated publication when current and turns success into link copying", () => {
  const actions = props({ current: true });
  const { rerender } = render(<PreviewPublishSection {...actions} />);
  expect(
    screen
      .getByRole("button", { name: "Already up to date" })
      .hasAttribute("disabled"),
  ).toBe(true);
  rerender(<PreviewPublishSection {...actions} success />);
  fireEvent.click(screen.getByRole("button", { name: "Copy website link" }));
  expect(copy).toHaveBeenCalledWith(publication.url);
  expect(actions.publish).not.toHaveBeenCalled();
});

it("prevents viewers from changing settings or publishing", () => {
  const actions = props({ canEdit: false });
  render(<PreviewPublishSection {...actions} />);
  expect(
    screen
      .getByRole("button", { name: "Update publication" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("You do not have permission to publish this project."),
  ).toBeTruthy();
});

it("allows saving a version without updating the website", () => {
  const actions = props({ enabled: false });
  render(<PreviewPublishSection {...actions} />);
  fireEvent.click(screen.getByRole("button", { name: "Save version" }));
  expect(actions.publish).toHaveBeenCalledOnce();
  expect(screen.getByRole("checkbox").hasAttribute("checked")).toBe(false);
});
