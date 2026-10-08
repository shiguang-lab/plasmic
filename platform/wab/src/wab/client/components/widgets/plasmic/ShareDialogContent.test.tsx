import PermissionItem from "@/wab/client/components/widgets/plasmic/PermissionItem";
import ShareDialogContent from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { ApiFeatureTier, ApiTeam } from "@/wab/shared/ApiSchema";
import { AccessLevel } from "@/wab/shared/EntUtil";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const actor = vi.hoisted(() => ({ level: "owner" as AccessLevel }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    selfInfo: { id: "self" },
    history: { location: { search: "" } },
  }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtxMaybe: () => undefined,
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
  maybeShowPaywall: vi.fn(),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
}));
vi.mock("@/wab/client/observability", () => ({ analytics: vi.fn() }));
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
vi.mock(
  "@/wab/client/components/widgets/plasmic/PlasmicPermissionItem",
  () => ({
    default: ({ roleDropdown }) => (
      <TestDropdown label="Member role" {...roleDropdown} />
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
    <ShareDialogContent
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
  for (const role of ["content", "designer"]) {
    expect(
      dropdown.querySelector<HTMLOptionElement>(`option[value="${role}"]`)
        ?.disabled,
    ).toBe(false);
    fireEvent.change(dropdown, { target: { value: role } });
    await vi.waitFor(() => expect(dropdown.disabled).toBe(false));
    expect(onGrant).toHaveBeenLastCalledWith(role);
  }
  rerender(<PermissionItem {...props} canEdit={false} />);
  expect(dropdown.disabled).toBe(true);
});
