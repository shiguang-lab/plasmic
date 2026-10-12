import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { CopilotChatDialog } from "@/wab/client/components/copilot/CopilotChatDialog";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const config = vi.hoisted(() => ({ enableLocalAiEditing: true }));
const state = vi.hoisted(() => ({
  session: undefined as LocalEditSession | undefined,
  configured: true,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ appConfig: config }),
}));
vi.mock("@/wab/client/copilot/local-edit-session", async (original) => {
  const actual =
    await original<typeof import("@/wab/client/copilot/local-edit-session")>();
  return {
    ...actual,
    getLocalEditSession: () => state.session,
    localAiFetch: async () => ({
      configured: state.configured,
      model: "fixture-model",
    }),
  };
});
afterEach(cleanup);
beforeEach(() => {
  state.session = new LocalEditSession("project");
  state.configured = true;
  config.enableLocalAiEditing = true;
});
function mount() {
  const onClose = vi.fn();
  const project = mock<ApiProject>({
    id: toOpaque("project"),
    name: "Project",
  });
  return {
    onClose,
    ...render(
      <AntdConfigProvider productUI>
        <CopilotChatDialog
          project={project}
          hiddenByModal={false}
          onClose={onClose}
        />
      </AntdConfigProvider>,
    ),
  };
}
it("renders a working Web composer and submits once through the session", async () => {
  const run = vi
    .spyOn(state.session as LocalEditSession, "run")
    .mockResolvedValue();
  mount();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Change the title" } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Send AI request" }),
    ).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send AI request" }));
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith("Change the title", undefined);
  expect(input).toHaveValue("");
});
it("shows configuration state without enabling an unavailable model", async () => {
  state.configured = false;
  mount();
  await screen.findByText(
    "Configure the AI service on the server to start editing.",
  );
  expect(
    screen.getByRole("button", { name: "Send AI request" }),
  ).toBeDisabled();
});
it("closing the panel stops its current task", () => {
  const stop = vi.spyOn(state.session as LocalEditSession, "stop");
  const { onClose } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(stop).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
