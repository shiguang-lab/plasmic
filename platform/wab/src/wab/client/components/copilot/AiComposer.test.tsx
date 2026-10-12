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
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Change title" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(submit).not.toHaveBeenCalled();
  rerender(<Composer running />);
  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "AI model" })).toBeDisabled();
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
          return "10px";
        }
        if (property === "columnGap") {
          return "8px";
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
        return 36;
      }
      if (part === "scope") {
        return 100;
      }
      if (part === "actions") {
        return 184;
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
  fireEvent.change(input, {
    target: { value: "Long description ".repeat(20) },
  });
  expect(root).toHaveAttribute("data-expanded", "true");
  fireEvent.change(input, { target: { value: "Short" } });
  expect(root).toHaveAttribute("data-expanded", "false");
  width = 277;
  fireEvent.change(input, { target: { value: "" } });
  expect(root).toHaveAttribute("data-expanded", "true");
  expect(screen.getByText("StatusFilter")).toBeTruthy();
});
