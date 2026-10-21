import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const submit = vi.fn();
const stop = vi.fn();
function Composer({
  running = false,
  canSubmit = true,
}: {
  running?: boolean;
  canSubmit?: boolean;
}) {
  const [value, onChange] = React.useState("");
  const [attachments, setAttachments] = React.useState<
    import("@/wab/shared/copilot/local-edit").LocalAiAttachment[]
  >([{ type: "text", name: "requirements.md", text: "A table" }]);
  const attachmentState = useAiAttachments(attachments, setAttachments);
  return (
    <AntdConfigProvider productUI>
      <AiComposer
        value={value}
        onChange={onChange}
        onSubmit={submit}
        attachmentState={attachmentState}
        scope="StatusFilter"
        models={["model"]}
        model="model"
        onModelChange={vi.fn()}
        canSubmit={canSubmit}
        running={running}
        onStop={stop}
        ariaLabel="Composer"
      />
    </AntdConfigProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  submit.mockClear();
  stop.mockClear();
});

it("preserves the scope, removes attachments and blocks submission while unavailable or running", () => {
  const { rerender } = render(<Composer canSubmit={false} />);
  expect(screen.getByText("StatusFilter")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove attachment requirements.md" }),
  );
  expect(screen.queryByText("requirements.md")).toBeNull();
  fireEvent.input(screen.getByRole("textbox"), {
    target: { innerText: "Change title" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(submit).not.toHaveBeenCalled();
  rerender(<Composer running />);
  expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "false");
  expect(screen.getByRole("button", { name: "AI model" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Send AI request" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Stop AI task" }));
  expect(submit).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledTimes(1);
});

it("expands in narrow containers and for overflowing text, then returns to compact layout", () => {
  let width = 530;
  const originalGetComputedStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = originalGetComputedStyle(element, pseudo);
    if (element.getAttribute("role") !== "group") {
      return style;
    }
    return new Proxy(style, {
      get(target, property) {
        if (property === "paddingLeft" || property === "paddingRight") {
          return "7px";
        }
        if (property === "columnGap") {
          return "6px";
        }
        return Reflect.get(target, property);
      },
    });
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute("role") === "group" ? width : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      const part = this.getAttribute("data-composer-part");
      if (part === "attachments") {
        return 30;
      }
      if (part === "scope") {
        return 100;
      }
      if (part === "actions") {
        return 152;
      }
      return this.getAttribute("aria-hidden") === "true"
        ? (this.textContent?.length ?? 0) * 8
        : 0;
    },
  );
  render(<Composer />);
  const root = screen.getByRole("group", { name: "Composer" });
  const input = screen.getByRole("textbox");
  expect(root).toHaveAttribute("data-expanded", "false");
  fireEvent.input(input, {
    target: { innerText: "Long description ".repeat(20) },
  });
  expect(root).toHaveAttribute("data-expanded", "true");
  fireEvent.input(input, { target: { innerText: "Short" } });
  expect(root).toHaveAttribute("data-expanded", "false");
  width = 277;
  fireEvent.input(input, { target: { innerText: "" } });
  expect(root).toHaveAttribute("data-expanded", "true");
  expect(screen.getByText("StatusFilter")).toBeTruthy();
});

it("keeps the node prefix beside the editable content in multiline mode", () => {
  render(<Composer />);
  const input = screen.getByRole("textbox");
  const prefix = screen.getByText("StatusFilter").closest("[data-composer-part=scope]");
  expect(prefix).toHaveAttribute("contenteditable", "false");
  expect(prefix?.parentElement).toBe(input.parentElement);
  expect(input).toHaveAttribute("contenteditable", "plaintext-only");
  fireEvent.input(input, { target: { innerText: "Change title\nand description" } });
  expect(screen.getByRole("group", { name: "Composer" })).toHaveAttribute("data-expanded", "true");
  expect(input).toHaveProperty("innerText", "Change title\nand description");
  expect(prefix?.parentElement).toBe(input.parentElement);
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(submit).toHaveBeenCalledTimes(1);
  fireEvent.input(input, { target: { innerText: "" } });
  expect(input).toHaveAttribute("data-empty", "true");
  expect(prefix).toBeInTheDocument();
});

it("treats the browser's lone line break after deletion as empty content", () => {
  render(<Composer />);
  const input = screen.getByRole("textbox");
  fireEvent.input(input, { target: { innerText: "Change title" } });
  input.replaceChildren(document.createElement("br"));
  fireEvent.input(input, { target: { innerText: "\n" } });
  expect(input).toHaveAttribute("data-empty", "true");
  expect(input).toHaveProperty("innerText", "");
  expect(screen.getByRole("button", { name: "Send AI request" })).toBeDisabled();
});
