import ShareDialog from "@/wab/client/components/widgets/ShareDialog";
import PermissionItem from "@/wab/client/components/widgets/plasmic/PermissionItem";
import ShareDialogContent from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { ApiFeatureTier, ApiTeam } from "@/wab/shared/ApiSchema";
import { AccessLevel } from "@/wab/shared/EntUtil";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const actor = vi.hoisted(() => ({
  level: "owner" as AccessLevel,
  topFrame: false,
  search: "",
  grant: vi.fn(),
  setSiteInfo: vi.fn(),
  track: vi.fn(),
  copy: vi.fn(),
}));
vi.mock("copy-to-clipboard", () => ({ default: actor.copy }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    selfInfo: { id: "self", email: "owner@example.com" },
    api: { grantRevoke: actor.grant, setSiteInfo: actor.setSiteInfo },
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
  () => ({
    default: ({ newUserRoleDropdown, shareByLinkPermDropdown }) => (
      <>
        <TestDropdown label="Invite role" {...newUserRoleDropdown} />
        {shareByLinkPermDropdown && (
          <TestDropdown label="Link role" {...shareByLinkPermDropdown} />
        )}
      </>
    ),
  }),
);

function TestDropdown({
  label,
  value,
  isDisabled,
  children,
  onChange,
}: {
  label: string;
  value: string;
  isDisabled?: boolean;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={isDisabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

function renderShare() {
  return render(
    <ShareDialog
      open
      resource={{
        type: "team",
        resource: mock<ApiTeam>({
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

test("both roles can be selected for invitations and link sharing without a paid tier", () => {
  actor.level = "owner";
  renderShare();
  for (const role of ["Content creator", "Designer"]) {
    for (const option of screen.getAllByRole<HTMLOptionElement>("option", {
      name: role,
    })) {
      expect(option.disabled).toBe(false);
    }
  }
  const invite = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Invite role",
  });
  fireEvent.change(invite, { target: { value: "content" } });
  expect(invite.value).toBe("content");
  fireEvent.change(invite, { target: { value: "designer" } });
  expect(invite.value).toBe("designer");
});

test("content creators still cannot grant designer or developer access or edit link sharing", () => {
  actor.level = "content";
  renderShare();
  const invite = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Invite role",
  });
  expect(invite.disabled).toBe(false);
  expect(
    invite.querySelector<HTMLOptionElement>('option[value="content"]')
      ?.disabled,
  ).toBe(false);
  expect(
    invite.querySelector<HTMLOptionElement>('option[value="designer"]')
      ?.disabled,
  ).toBe(true);
  expect(
    invite.querySelector<HTMLOptionElement>('option[value="editor"]')?.disabled,
  ).toBe(true);
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Link role" })
      .disabled,
  ).toBe(true);
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
