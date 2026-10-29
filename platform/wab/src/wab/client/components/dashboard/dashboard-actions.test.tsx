import type { AppCtx } from "@/wab/client/app-ctx";
import {
  promptMoveToWorkspace,
  promptWorkspace,
} from "@/wab/client/components/dashboard/dashboard-actions";
import Select from "@/wab/client/components/widgets/Select";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  ApiPermission,
  ApiTeam,
  ApiUser,
  ApiWorkspace,
} from "@/wab/shared/ApiSchema";
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

afterEach(async () => {
  onSubmit.mockClear();
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

it.each(languageOptions)(
  "localizes the duplicate prompt in $value",
  async ({ value }) => {
    await act(async () => await setLanguagePreference(value));
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
      screen.getByRole("combobox", {
        name: translate(value, "Select a destination workspace:"),
      }),
      { key: "ArrowDown", keyCode: 40 },
    );
    expect(
      await screen.findByText(translate(value, "No workspaces available.")),
    ).toBeTruthy();
  },
);

it("updates an open prompt's captions without rewriting the edited project name", async () => {
  await act(async () => await setLanguagePreference("en"));
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
  await act(async () => await setLanguagePreference("zh-CN"));
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
    await act(async () => await setLanguagePreference("zh-CN"));
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
      screen.getByRole("combobox", { name: "选择目标工作区：" }),
      { key: "ArrowDown", keyCode: 40 },
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

it("preserves an explicit Select placeholder", async () => {
  await act(async () => await setLanguagePreference("zh-CN"));
  render(<Select placeholder="Business placeholder" />);
  expect(screen.getByText("Business placeholder")).toBeTruthy();
});

it("opens the workspace prompt while loading and uses refreshed permissions", async () => {
  const team = mock<ApiTeam>({ id: "team" as ApiTeam["id"], name: "Team" });
  const workspace = mock<ApiWorkspace>({
    id: "workspace" as ApiWorkspace["id"],
    name: "Destination",
    team,
  });
  const user = mock<ApiUser>({ id: "user" as ApiUser["id"] });
  const permission = mock<ApiPermission>({
    userId: user.id,
    teamId: team.id,
    accessLevel: "designer",
  });
  const { promise: pending, resolve: finishLoading } =
    Promise.withResolvers<void>();
  const appCtx = mock<AppCtx>({
    selfInfo: user,
    workspaces: [],
    perms: [permission],
  });
  appCtx.getAllTeams.mockReturnValue([team]);
  appCtx.reloadAppCtx.mockImplementation(async () => {
    await pending;
    appCtx.workspaces = [workspace];
    appCtx.perms = [{ ...permission, accessLevel: "editor" }];
  });

  await act(async () => {
    await promptMoveToWorkspace(appCtx, null, false, "Move");
  });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByText("Loading…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

  await act(async () => {
    finishLoading();
    await pending;
  });
  expect(screen.getByRole("combobox")).toBeEnabled();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown", keyCode: 40 });
  await userEvent.click(
    await screen.findByRole("option", { name: "Destination" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      result: "workspace",
      workspace,
      name: undefined,
    }),
  );
});
