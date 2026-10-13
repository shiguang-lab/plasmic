import { promptWorkspace } from "@/wab/client/components/dashboard/dashboard-actions";
import Select from "@/wab/client/components/widgets/Select";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { ApiTeam, ApiWorkspace } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "antd";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const onSubmit = vi.hoisted(() => vi.fn());

vi.mock("@/wab/client/components/widgets/Modal", () => ({
  Modal: ({ children, okText, cancelText, okButtonProps, onCancel }) => (
    <div role="dialog">
      {children}
      <Button onClick={onCancel}>{cancelText}</Button>
      <Button {...okButtonProps}>{okText}</Button>
    </div>
  ),
}));
vi.mock("@/wab/client/components/modals/ContentEditorConfigModal", () => ({
  ContentEditorConfigModal: () => null,
}));
vi.mock("@/wab/client/components/modals/PricingModal", () => ({
  maybeShowPaywall: vi.fn(),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: async (content) => {
    render(content(onSubmit, vi.fn()));
  },
}));

afterEach(() => {
  onSubmit.mockClear();
  cleanup();
  act(() => setLanguagePreference("en"));
});

it.each(languageOptions)(
  "localizes the duplicate prompt in $value",
  async ({ value }) => {
    act(() => setLanguagePreference(value));
    const name = "Desktop UX {name} $&";
    await act(async () => {
      await promptWorkspace({
        workspaces: [],
        allTeams: [],
        allowNoWorkspace: false,
        message: "Select a destination workspace:",
        noWorkspacesMessage: "No workspaces available.",
        confirmButtonMessage: "Duplicate",
        projectName: name,
      });
    });
    expect(
      screen.getByText(translate(value, "Select a destination workspace:")),
    ).toBeTruthy();
    expect(screen.getByText(translate(value, "Select..."))).toBeTruthy();
    expect(
      screen.getByRole("button", { name: translate(value, "Duplicate") }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: translate(value, "Cancel") }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox")).toHaveValue(
      translate(value, "Copy of {name}", { name }),
    );
    fireEvent.keyDown(
      screen.getByRole("button", {
        name: translate(value, "Select a destination workspace:"),
      }),
      { key: "ArrowDown" },
    );
    expect(
      await screen.findByText(translate(value, "No workspaces available.")),
    ).toBeTruthy();
  },
);

it("updates an open prompt's captions without rewriting the edited project name", async () => {
  act(() => setLanguagePreference("en"));
  await act(async () => {
    await promptWorkspace({
      workspaces: [],
      allTeams: [],
      allowNoWorkspace: false,
      message: "Select a destination workspace:",
      noWorkspacesMessage: "No workspaces available.",
      confirmButtonMessage: "Duplicate",
    });
  });
  const input = screen.getByRole("textbox");
  expect(input).toHaveValue("New Project");
  fireEvent.change(input, { target: { value: "My own project name" } });
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.getByText("选择目标工作区：")).toBeTruthy();
  expect(screen.getByText(translate("zh-CN", "Select..."))).toBeTruthy();
  expect(
    screen.getByRole("button", { name: translate("zh-CN", "Duplicate") }),
  ).toBeTruthy();
  expect(input).toHaveValue("My own project name");
});

it.each(["Move", undefined] as const)(
  "localizes %s while retaining workspace and organization names",
  async (operation) => {
    act(() => setLanguagePreference("zh-CN"));
    const team = mock<ApiTeam>({
      id: "team" as ApiTeam["id"],
      name: "Organization Alpha",
    });
    const workspace = mock<ApiWorkspace>({
      id: "workspace" as ApiWorkspace["id"],
      name: "Workspace Alpha",
      team,
    });
    await act(async () => {
      await promptWorkspace({
        workspaces: [workspace],
        allTeams: [team],
        allowNoWorkspace: false,
        message: "Select a destination workspace:",
        noWorkspacesMessage: "No workspaces available.",
        confirmButtonMessage: operation,
      });
    });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: translate("zh-CN", operation ?? "Confirm"),
      }),
    ).toBeDisabled();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "选择目标工作区：" }),
      { key: "ArrowDown" },
    );
    expect(await screen.findByText(team.name)).toBeTruthy();
    await userEvent.click(screen.getByRole("option", { name: workspace.name }));
    expect(
      screen.getByRole("button", {
        name: translate("zh-CN", operation ?? "Confirm"),
      }),
    ).not.toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: translate("zh-CN", operation ?? "Confirm"),
      }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        result: "workspace",
        workspace,
        name: undefined,
      }),
    );
  },
);

it("preserves an explicit Select placeholder", () => {
  act(() => setLanguagePreference("zh-CN"));
  render(<Select placeholder="Business placeholder" />);
  expect(screen.getByText("Business placeholder")).toBeTruthy();
});
