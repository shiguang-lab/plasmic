import { ImportPlasmicButton } from "@/wab/client/components/dashboard/ImportPlasmicButton";
import * as domUtils from "@/wab/client/dom-utils";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { message } from "antd";
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  importProject: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    api: {
      importProject: mocks.importProject,
    },
  }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    message: {
      success: mocks.success,
      error: mocks.error,
    },
  };
});

describe("ImportPlasmicButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  it("renders with the expected label and icon", () => {
    render(<ImportPlasmicButton />);
    const button = screen.getByRole("button", { name: /import \.plasmic/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("triggers getUploadedFile with .plasmic and .json filter when clicked", () => {
    const spy = vi.spyOn(domUtils, "getUploadedFile").mockImplementation(() => {});
    render(<ImportPlasmicButton workspaceId={"ws-123" as any} />);
    fireEvent.click(screen.getByRole("button", { name: /import \.plasmic/i }));
    expect(spy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ accept: ".plasmic,.json" }),
    );
  });

  it("imports valid .plasmic file successfully and redirects", async () => {
    mocks.importProject.mockResolvedValueOnce({ projectId: "new-proj-123" });
    vi.spyOn(domUtils, "getUploadedFile").mockImplementation((callback) => {
      const sampleContent = JSON.stringify({
        format: "plasmic/project",
        version: 1,
        name: "My Project",
        bundles: [],
      });
      const file = new File([sampleContent], "My-Project.plasmic", {
        type: "application/json",
      });
      void callback(sampleContent, file);
    });

    render(<ImportPlasmicButton workspaceId={"ws-123" as any} />);
    fireEvent.click(screen.getByRole("button", { name: /import \.plasmic/i }));

    await waitFor(() => {
      expect(mocks.importProject).toHaveBeenCalledWith(
        expect.stringContaining("plasmic/project"),
        {
          projectName: "My-Project",
          workspaceId: "ws-123",
        },
      );
    });

    expect(mocks.success).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Imported project successfully",
      }),
    );
    expect(window.location.href).toContain("new-proj-123");
  });

  it("handles invalid json content gracefully", async () => {
    vi.spyOn(domUtils, "getUploadedFile").mockImplementation((callback) => {
      void callback("invalid json", undefined);
    });

    render(<ImportPlasmicButton />);
    fireEvent.click(screen.getByRole("button", { name: /import \.plasmic/i }));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalled();
    });
    expect(mocks.importProject).not.toHaveBeenCalled();
  });

  it("honors disabled prop", () => {
    render(<ImportPlasmicButton disabled />);
    expect(screen.getByRole("button", { name: /import \.plasmic/i })).toBeDisabled();
  });
});
