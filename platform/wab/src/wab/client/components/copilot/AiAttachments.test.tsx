import {
  AiAttachmentList,
  AiAttachmentPicker,
  readAiAttachment,
  useAiAttachments,
} from "@/wab/client/components/copilot/AiAttachments";
import { localAiAttachmentsSchema } from "@/wab/shared/copilot/local-edit";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it.each(["iframe", "outside", "escape"])(
  "closes the attachment menu on %s without clearing chosen files",
  async (target) => {
    render(
      <>
        <Composer />
        <input aria-label="Canvas focus" />
      </>,
    );
    fireEvent.change(
      screen.getByLabelText(
        "Choose requirement documents and reference images",
      ),
      { target: { files: [new File(["A table"], "requirements.md")] } },
    );
    await screen.findByRole("button", {
      name: "Remove attachment requirements.md",
    });
    const trigger = screen.getByRole("button", {
      name: "Add files and images",
    });
    await waitFor(() => expect(trigger.hasAttribute("disabled")).toBe(false));
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("menuitem", { name: "Add reference images" });
    const canvas = screen.getByRole("textbox", { name: "Canvas focus" });
    if (target === "iframe") {
      canvas.focus();
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(document.body);
      fireEvent.click(document.body);
    } else if (target === "outside") {
      fireEvent.mouseDown(canvas);
      fireEvent.click(canvas);
    } else {
      fireEvent.keyDown(document, { key: "Escape" });
    }
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "Add reference images" }),
      ).toBeNull(),
    );
    expect(screen.getByText("requirements.md")).toBeTruthy();
    if (target === "iframe") {
      expect(document.activeElement).toBe(canvas);
    }
    if (target === "escape") {
      expect(document.activeElement).toBe(trigger);
    }
  },
);

function Composer() {
  const [attachments, setAttachments] = React.useState<
    import("@/wab/shared/copilot/local-edit").LocalAiAttachment[]
  >([]);
  const state = useAiAttachments(attachments, setAttachments);
  return (
    <div onPaste={state.onPaste}>
      <AiAttachmentPicker state={state} />
      <AiAttachmentList
        attachments={state.attachments}
        error={state.error}
        onRemove={(index) =>
          state.setAttachments(state.attachments.filter((_, i) => i !== index))
        }
      />
    </div>
  );
}

it("reads requirement text and binary references without losing file content", async () => {
  expect(
    await readAiAttachment(new File(["需求：查询表格"], "requirements.md")),
  ).toEqual({ type: "text", name: "requirements.md", text: "需求：查询表格" });
  expect(
    await readAiAttachment(
      new File(["%PDF-1.7"], "requirements.pdf", { type: "application/pdf" }),
    ),
  ).toEqual({
    type: "file",
    name: "requirements.pdf",
    mediaType: "application/pdf",
    data: btoa("%PDF-1.7"),
  });
  expect(
    await readAiAttachment(
      new File(["reference"], "reference.png", { type: "image/png" }),
    ),
  ).toEqual({
    type: "file",
    name: "reference.png",
    mediaType: "image/png",
    data: btoa("reference"),
  });
});

it("shows removable attachments and retains them after an unsupported file is chosen", async () => {
  render(<Composer />);
  const picker = screen.getByLabelText(
    "Choose requirement documents and reference images",
  );
  fireEvent.change(picker, {
    target: { files: [new File(["A table"], "requirements.txt")] },
  });
  const remove = await screen.findByRole("button", {
    name: "Remove attachment requirements.txt",
  });
  fireEvent.change(picker, {
    target: { files: [new File(["Word"], "requirements.docx")] },
  });
  await screen.findByText(
    "Supported attachments: PDF, TXT, Markdown, PNG, JPEG and WebP.",
  );
  expect(screen.getByText("requirements.txt")).toBeTruthy();
  fireEvent.click(remove);
  expect(screen.queryByText("requirements.txt")).toBeNull();
});

it("uses the plus menu for documents and images and accepts pasted images", async () => {
  const canvasPaste = vi.fn();
  render(
    <div onPaste={canvasPaste}>
      <Composer />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add files and images" }));
  expect(await screen.findByText("Add requirement documents")).toBeTruthy();
  expect(screen.getByText("Add reference images")).toBeTruthy();
  fireEvent.paste(
    screen.getByLabelText("Choose requirement documents and reference images"),
    {
      clipboardData: {
        files: [
          new File(["reference"], "reference.png", { type: "image/png" }),
        ],
      },
    },
  );
  expect(canvasPaste).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("img", { name: "reference.png" }),
  ).toBeTruthy();
});

it("rejects empty files, unsupported formats, malformed data and excessive attachment counts", async () => {
  await expect(readAiAttachment(new File([], "empty.md"))).rejects.toThrow(
    "empty or too large",
  );
  await expect(
    readAiAttachment(new File(["unsupported"], "design.zip")),
  ).rejects.toThrow("Supported attachments");
  expect(
    localAiAttachmentsSchema.safeParse([
      {
        type: "file",
        name: "image.png",
        mediaType: "image/png",
        data: "https://example.com/image.png",
      },
    ]).success,
  ).toBe(false);
  expect(
    localAiAttachmentsSchema.safeParse(
      Array.from({ length: 6 }, () => ({
        type: "text",
        name: "req.md",
        text: "A table",
      })),
    ).success,
  ).toBe(false);
});
