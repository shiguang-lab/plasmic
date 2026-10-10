import TeamMemberList from "@/wab/client/components/dashboard/TeamMemberList";
import { ApiPermission, ApiTeam, TeamMember } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  change: vi.fn(),
  remove: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ selfInfo: { id: "self", email: "self@example.com" } }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    t: (s: string, args?: Record<string, string>) =>
      s.replace("{email}", args?.email ?? ""),
  }),
}));
vi.mock("@/wab/client/components/widgets/plasmic/ShareDialogContent", () => ({
  default: ({
    reloadPerms,
    closeDialog,
  }: {
    reloadPerms: () => void;
    closeDialog: () => void;
  }) => (
    <>
      <button onClick={reloadPerms}>Reload permissions</button>
      <button onClick={closeDialog}>Finish invite</button>
    </>
  ),
}));
const members: TeamMember[] = [
  { type: "email", email: "invite@example.com" },
  { type: "email", email: "none@example.com" },
  { type: "email", email: "self@example.com" },
];
const perms = [
  { email: "self@example.com", userId: "self", accessLevel: "owner" },
  { email: "invite@example.com", accessLevel: "designer" },
] as ApiPermission[];
function show(disabled = false, permissions = perms) {
  return render(
    <TeamMemberList
      team={{ id: "team" } as ApiTeam}
      members={members}
      perms={permissions}
      onChangeRole={mocks.change}
      onRemoveUser={mocks.remove}
      onReload={mocks.reload}
      disabled={disabled}
    />,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("filters pending invitations by their real permission and combines role filtering with search", async () => {
  show();
  fireEvent.mouseDown(screen.getByLabelText("Filter by role"));
  fireEvent.click(
    await screen.findByText("None", {
      selector: ".ant-select-item-option-content",
    }),
  );
  expect(
    screen.getByLabelText("Role for none@example.com"),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Role for invite@example.com")).toBeNull();
  fireEvent.change(screen.getByLabelText("Search members"), {
    target: { value: "invite" },
  });
  expect(screen.getByText("No matching members")).toBeInTheDocument();
});

it("surfaces role update failures and lets the user retry through the real callback", async () => {
  mocks.change
    .mockRejectedValueOnce(new Error("Denied"))
    .mockResolvedValueOnce(undefined);
  show();
  const role = screen.getByLabelText("Role for invite@example.com");
  fireEvent.mouseDown(role);
  fireEvent.click(
    await screen.findByText("Viewer", {
      selector: ".ant-select-item-option-content",
    }),
  );
  expect(
    await screen.findByText("Failed to update team member"),
  ).toBeInTheDocument();
  expect(mocks.change).toHaveBeenCalledWith("invite@example.com", "viewer");
  fireEvent.mouseDown(role);
  fireEvent.click(
    await screen.findByText("None", {
      selector: ".ant-select-item-option-content",
    }),
  );
  await waitFor(() =>
    expect(mocks.change).toHaveBeenLastCalledWith(
      "invite@example.com",
      undefined,
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText("Failed to update team member")).toBeNull(),
  );
});

it("protects self roles, owners, higher roles and read-only invitations", () => {
  const view = show(false, [perms[0], { ...perms[1], accessLevel: "owner" }]);
  expect(screen.getByLabelText("Role for self@example.com")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Actions for invite@example.com" }),
  ).toBeNull();
  view.unmount();
  const viewerPermissions = [
    { ...perms[0], accessLevel: "viewer" },
    perms[1],
  ] as ApiPermission[];
  show(true, viewerPermissions);
  expect(screen.getByRole("button", { name: "Invite" })).toBeDisabled();
  expect(screen.getByLabelText("Role for invite@example.com")).toBeDisabled();
});

it("opens an accessible invitation dialog and preserves its permission refresh callback", async () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload permissions" }));
  expect(mocks.reload).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Finish invite" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("removes pending members using their actual email", async () => {
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Actions for invite@example.com" }),
  );
  fireEvent.click(await screen.findByText("Remove member"));
  await waitFor(() =>
    expect(mocks.remove).toHaveBeenCalledWith("invite@example.com"),
  );
});
