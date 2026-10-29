import ShareDialog from "@/wab/client/components/widgets/ShareDialog";
import PermissionItem from "@/wab/client/components/widgets/plasmic/PermissionItem";
import ShareDialogContent from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { ApiFeatureTier, ApiTeam, TeamId } from "@/wab/shared/ApiSchema";
import { AccessLevel } from "@/wab/shared/EntUtil";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { mock } from "vitest-mock-extended";

const actor = vi.hoisted(() => ({
  level: "owner" as AccessLevel,
  topFrame: false,
  search: "",
  grant: vi.fn(),
  setSiteInfo: vi.fn(),
  updateTeam: vi.fn(),
  track: vi.fn(),
  copy: vi.fn(),
}));
vi.mock("copy-to-clipboard", () => ({ default: actor.copy }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    selfInfo: { id: "self", email: "owner@example.com" },
    api: {
      grantRevoke: actor.grant,
      setSiteInfo: actor.setSiteInfo,
      updateTeam: actor.updateTeam,
    },
    history: { location: { search: actor.search } },
  }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtxMaybe: () => (actor.topFrame ? {} : undefined),
}));
vi.mock("@/wab/shared/perms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/shared/perms")>()),
  getAccessLevelToResource: () => actor.level,
}));
vi.mock("@/wab/client/components/app-auth/PermissionsTab", () => ({
  default: () => null,
}));
vi.mock("@/wab/client/components/app-auth/app-auth-contexts", () => ({
  useAppAuthConfig: () => ({}),
}));
vi.mock("@/wab/client/components/modals/PricingModal", () => ({
  PaywallError: class extends Error {},
  maybeShowPaywall: (_ctx, run) => run(),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
}));
vi.mock("@/wab/client/observability", () => ({
  analytics: () => ({ track: actor.track }),
}));
vi.mock("@/wab/client/components/widgets", () => ({
  ClickStopper: ({ children }) => children,
  Spinner: () => null,
}));
vi.mock("@/wab/client/components/widgets/PublishSpinner", () => ({
  default: () => null,
}));
vi.mock("@/wab/client/components/widgets/Select", () => ({
  default: {
    Option: ({ value, isDisabled, children }) => (
      <option value={value} disabled={isDisabled}>
        {children}
      </option>
    ),
  },
}));
vi.mock(
  "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent",
  () => ({ default: () => null }),
);

beforeEach(() => {
  actor.level = "owner";
  actor.updateTeam.mockReset().mockResolvedValue({});
  actor.grant.mockReset().mockResolvedValue({ perms: [] });
  actor.copy.mockReset().mockReturnValue(true);
});

function renderShare() {
  return render(
    <ShareDialog
      open
      resource={{
        type: "team",
        resource: mock<ApiTeam>({
          id: "team" as TeamId,
          inviteId: "invite-token",
          defaultAccessLevel: "viewer",
          featureTier: mock<ApiFeatureTier>({
            contentRole: false,
            designerRole: false,
          }),
        }),
      }}
      perms={[]}
      closeDialog={vi.fn()}
      reloadPerms={vi.fn()}
    />,
  );
}

test("separates link invitations from email invitations and keeps their roles independent", async () => {
  const user = userEvent.setup();
  renderShare();
  const linkSection = screen.getByRole("region", { name: "Invite by link" });
  const emailSection = screen.getByRole("region", { name: "Invite by email" });
  expect(within(linkSection).queryByRole("textbox")).toBeNull();
  expect(within(emailSection).queryByRole("switch")).toBeNull();
  await user.click(within(linkSection).getByRole("combobox"));
  await user.click(
    screen.getByText("Content creator", {
      selector: ".ant-select-item-option-content",
    }),
  );
  await vi.waitFor(() =>
    expect(actor.updateTeam).toHaveBeenCalledWith("team", {
      defaultAccessLevel: "content",
    }),
  );
  expect(within(emailSection).getByTitle("Developer")).toBeTruthy();
  const inviteRole = within(emailSection).getByRole("combobox");
  for (const role of ["Content creator", "Designer"]) {
    await user.click(inviteRole);
    await user.click(
      screen.getByText(role, {
        selector:
          ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content",
      }),
    );
    expect(within(emailSection).getByTitle(role)).toBeTruthy();
  }
  expect(within(linkSection).getByTitle("Content creator")).toBeTruthy();
  fireEvent.change(within(emailSection).getByRole("textbox"), {
    target: { value: "new@example.com" },
  });
  fireEvent.click(within(emailSection).getByRole("button", { name: "Invite" }));
  await vi.waitFor(() =>
    expect(actor.grant).toHaveBeenCalledWith({
      grants: [
        { email: "new@example.com", accessLevel: "designer", teamId: "team" },
      ],
      revokes: [],
    }),
  );
});

test("content creators cannot grant higher roles or edit link invitations", () => {
  actor.level = "content";
  renderShare();
  expect(
    screen.getByRole("switch", { name: "Enable link invitations" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("combobox", {
      name: "Default permission for link sharing",
    }),
  ).toBeDisabled();
  const inviteRole = screen.getByRole("combobox", {
    name: "Permission level for new user",
  });
  expect(inviteRole).not.toBeDisabled();
  fireEvent.mouseDown(inviteRole);
  expect(
    screen.getByText("Content creator").closest(".ant-select-item-option"),
  ).not.toHaveClass("ant-select-item-option-disabled");
  for (const role of ["Designer", "Developer"]) {
    expect(
      screen.getByText(role).closest(".ant-select-item-option"),
    ).toHaveClass("ant-select-item-option-disabled");
  }
});

test("disabling link invitations leaves email invitations available and enabling starts with viewer", async () => {
  renderShare();
  fireEvent.click(
    screen.getByRole("switch", { name: "Enable link invitations" }),
  );
  await vi.waitFor(() =>
    expect(actor.updateTeam).toHaveBeenCalledWith("team", {
      defaultAccessLevel: null,
    }),
  );
  await vi.waitFor(() =>
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull(),
  );
  expect(
    screen.getByRole("textbox", { name: "Invite email" }),
  ).not.toBeDisabled();
  fireEvent.click(
    screen.getByRole("switch", { name: "Enable link invitations" }),
  );
  await vi.waitFor(() =>
    expect(actor.updateTeam).toHaveBeenLastCalledWith("team", {
      defaultAccessLevel: "viewer",
    }),
  );
  expect(
    await screen.findByRole("button", { name: "Copy link" }),
  ).toBeEnabled();
  expect(screen.getByText("Developer")).toBeTruthy();
});

test("copying the fixed invitation link shows success without changing permissions", () => {
  renderShare();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(actor.copy).toHaveBeenCalledWith(
    "http://localhost/orgs/team?inviteId=invite-token",
  );
  expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Copied");
  expect(actor.updateTeam).not.toHaveBeenCalled();
  expect(actor.grant).not.toHaveBeenCalled();
});

test("failed copying shows an error and can be retried", () => {
  actor.copy.mockReturnValueOnce(false);
  renderShare();
  const linkSection = within(
    screen.getByRole("region", { name: "Invite by link" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(linkSection.getByRole("alert").textContent).toBe(
    "Could not copy link",
  );
  expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  expect(linkSection.queryByRole("alert")).toBeNull();
});

test("existing members can receive either role, while read-only permission controls stay disabled", async () => {
  const onGrant = vi.fn().mockResolvedValue(undefined);
  const props = { accessLevel: "viewer" as const, onGrant, onRevoke: vi.fn() };
  const { rerender } = render(<PermissionItem {...props} canEdit />);
  const dropdown = screen.getByRole<HTMLSelectElement>("combobox");
  fireEvent.mouseDown(dropdown);
  fireEvent.click(screen.getByText("Designer"));
  await vi.waitFor(() => expect(onGrant).toHaveBeenCalledWith("designer"));
  await vi.waitFor(() => expect(dropdown.disabled).toBe(false));
  rerender(<PermissionItem {...props} canEdit={false} />);
  expect(dropdown.disabled).toBe(true);
});

const projectResource = {
  type: "project" as const,
  resource: { id: "project", name: "Project name", inviteOnly: true },
};
function renderProject() {
  return render(
    <ShareDialog
      open
      resource={
        projectResource as React.ComponentProps<
          typeof ShareDialogContent
        >["resource"]
      }
      perms={[]}
      reloadPerms={vi.fn()}
      closeDialog={vi.fn()}
    />,
  );
}

it("keeps the project context implicit and invites with the existing developer default", async () => {
  actor.level = "owner";
  actor.grant.mockResolvedValue({ perms: [] });
  renderProject();
  expect(screen.getByRole("dialog", { name: "Share project" })).toBeTruthy();
  expect(screen.queryByText("Project name")).toBeNull();
  expect(screen.getByText("Developer")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Invite email" }), {
    target: { value: "person@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
  await vi.waitFor(() =>
    expect(actor.grant).toHaveBeenCalledWith({
      grants: [
        {
          email: "person@example.com",
          accessLevel: "editor",
          projectId: "project",
        },
      ],
      revokes: [],
    }),
  );
});

it("updates everyone-else permissions immediately and copying alone changes no permissions", async () => {
  actor.level = "owner";
  actor.copy.mockReturnValue(true);
  actor.setSiteInfo.mockResolvedValue({});
  actor.setSiteInfo.mockClear();
  renderProject();
  fireEvent.click(screen.getByRole("button", { name: "Copy project link" }));
  expect(actor.setSiteInfo).not.toHaveBeenCalled();
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "Everyone else permission" }),
  );
  fireEvent.click(screen.getByText("Viewer"));
  await vi.waitFor(() =>
    expect(actor.setSiteInfo).toHaveBeenCalledWith("project", {
      inviteOnly: false,
    }),
  );
  await screen.findByText(
    "Other people can open this project with viewer permissions.",
  );
});

it("does not offer current-arena links from the dashboard", () => {
  actor.topFrame = false;
  actor.search = "";
  actor.level = "viewer";
  renderProject();
  expect(screen.queryByText("Copy link to current arena")).toBeNull();
  expect(
    screen
      .getByRole("combobox", { name: "Everyone else permission" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("textbox", { name: "Invite email" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("uses the native title and footer with two explicit copy actions in the editor", () => {
  actor.topFrame = true;
  actor.level = "owner";
  actor.copy.mockReturnValue(true);
  actor.setSiteInfo.mockClear();
  actor.grant.mockClear();
  renderProject();
  const dialog = screen.getByRole("dialog", { name: "Share project" });
  expect(dialog.querySelector(".ant-modal-title")?.textContent).toBe(
    "Share project",
  );
  expect(
    dialog.querySelector(".ant-modal-footer")?.querySelectorAll("button")
      .length,
  ).toBe(2);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryByText("Copy current arena preview link")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Copy link to current arena" }),
  );
  expect(actor.copy).toHaveBeenLastCalledWith(window.location.href);
  fireEvent.click(screen.getByRole("button", { name: "Copy project link" }));
  expect(actor.copy.mock.lastCall?.[0]).toMatch(/\/projects\/project$/);
  expect(actor.setSiteInfo).not.toHaveBeenCalled();
  expect(actor.grant).not.toHaveBeenCalled();
  actor.topFrame = false;
});
