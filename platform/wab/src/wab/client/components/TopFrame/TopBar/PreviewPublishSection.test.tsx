import PreviewPublishSection, {
  PreviewPublishSectionProps,
} from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const copy = vi.hoisted(() => vi.fn());
vi.mock("copy-to-clipboard", () => ({ default: copy }));

const publication = {
  projectId: "project",
  code: "0123456789",
  version: "1.0.0",
  enabled: true,
  entryPath: "/groups",
  pages: [{ id: "groups", name: "Groups", path: "/groups" }],
  publishedAt: new Date().toISOString(),
  url: "https://preview.plasmic.shiguanglab.com/s/0123456789",
};
function props(
  overrides: Partial<PreviewPublishSectionProps> = {},
): PreviewPublishSectionProps {
  return {
    publication,
    enabled: true,
    setEnabled: vi.fn(),
    entryPath: "/groups",
    setEntryPath: vi.fn(),
    busy: false,
    hasPublishedVersion: true,
    canEdit: true,
    publish: vi.fn(),
    unpublish: vi.fn(),
    ...overrides,
  };
}

describe("published website controls", () => {
  it("copies the stable link and offers update and unpublish actions", () => {
    const actions = props();
    render(<PreviewPublishSection {...actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(copy).toHaveBeenCalledWith(publication.url);
    fireEvent.click(screen.getByRole("button", { name: "Update website" }));
    fireEvent.click(screen.getByRole("button", { name: "Unpublish website" }));
    expect(actions.publish).toHaveBeenCalledOnce();
    expect(actions.unpublish).toHaveBeenCalledOnce();
  });
  it("allows first-time website publishing with the next version", () => {
    const actions = props({
      publication: null,
      enabled: false,
      hasPublishedVersion: false,
    });
    render(<PreviewPublishSection {...actions} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(actions.setEnabled).toHaveBeenCalledWith(true);
    expect(
      screen
        .getByRole("button", { name: "Publish website" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("prevents viewer changes and keeps the previous link visible on failure", () => {
    render(
      <PreviewPublishSection
        {...props({ canEdit: false, error: "Code generation failed" })}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Update website" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Unpublish website" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("checkbox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Code generation failed")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(publication.url);
  });
});
