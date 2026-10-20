import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";

import { useAppAuthConfig } from "@/wab/client/components/app-auth/app-auth-contexts";
import PermissionsTab from "@/wab/client/components/app-auth/PermissionsTab";
import {
  maybeShowPaywall,
  PaywallError,
} from "@/wab/client/components/modals/PricingModal";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import {
  ClickStopper,
  Spinner,
  Tab,
  Tabs,
} from "@/wab/client/components/widgets";
import PermissionItem, {
  commenterTooltip,
  contentCreatorTooltip,
  designerTooltip,
  developerTooltip,
  permissionDescriptions,
  permissionRoles,
  viewerTooltip,
} from "@/wab/client/components/widgets/plasmic/PermissionItem";
import PP__ShareDialogContent from "@/wab/client/components/widgets/plasmic/PlasmicShareDialogContent";
import Select from "@/wab/client/components/widgets/Select";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useTopFrameCtxMaybe } from "@/wab/client/frame-ctx/top-frame-ctx";
import { analytics } from "@/wab/client/observability";
import {
  ApiPermission,
  ApiResource,
  ApiTeam,
  Grant,
  GrantRevokeRequest,
  Revoke,
} from "@/wab/shared/ApiSchema";
import { getUserEmail } from "@/wab/shared/ApiSchemaUtil";
import { assert, ensure, spawn, withoutFalsy } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { parseEmailAddress } from "@/wab/shared/email-address";
import { accessLevelRank, GrantableAccessLevel } from "@/wab/shared/EntUtil";
import { ORGANIZATION_LOWER } from "@/wab/shared/Labels";
import {
  convertToTaggedResourceId,
  filterDirectResourcePerms,
  getAccessLevelToResource,
  resourceTypeIdField,
} from "@/wab/shared/perms";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { getPublicUrl } from "@/wab/shared/urls";
import { LockOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Select as AntdSelect, Button, Input, notification, message } from "antd";
import { createStyles } from "antd-style";
import copy from "copy-to-clipboard";
import L from "lodash";
import React, { useEffect, useState } from "react";

const useShareStyles = createStyles(({ token }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    color: token.colorText,
  },
  body: { maxHeight: "calc(100dvh - 250px)", minHeight: 0 },
  section: {
    padding: "0 0 20px",
    h3: { margin: "0 0 12px", fontSize: 14, fontWeight: 500 },
    "& + section": {
      paddingTop: 20,
      borderTop: `1px solid ${token.colorBorderSecondary}`,
    },
  },
  caption: {
    color: token.colorTextSecondary,
    fontSize: 12,
    margin: "10px 0 0",
    lineHeight: 1.6,
  },
  inviteRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 120px auto",
    gap: 8,
    "@media (max-width: 500px)": {
      gridTemplateColumns: "minmax(0, 1fr) 110px",
      button: { gridColumn: "1 / -1" },
    },
  },
  inherited: {
    padding: "0 0 20px",
    color: token.colorTextSecondary,
    summary: { cursor: "pointer" },
  },
  inheritedRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
    "& span": { minWidth: 0, overflowWrap: "anywhere" },
    "& a": {
      color: token.colorPrimary,
      "&:hover": { color: token.colorPrimaryHover },
      "&:active": { color: token.colorPrimaryActive },
    },
  },
  access: {
    margin: "0 0 20px",
    padding: 16,
    background: token.colorFillAlter,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
  },
  accessRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    h3: { flex: 1, margin: 0, fontSize: 14, fontWeight: 500 },
    "& .ant-select": { width: 112, flexShrink: 0 },
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: 0,
    "& > span": { margin: "0 auto 0 0", textAlign: "left" },
    "& > div": { marginLeft: "auto" },
  },
}));

export const personalProjectPaywallMessage = (
  <>
    <UiText
      message={
        "This project is a personal project that is not in any {part1} workspace, so it is limited to {part2} editors and no A/B testing or custom targeting. Please move the project into a {part3} whose plan supports a larger number of seats, or {part4}."
      }
      values={{
        part1: <UiLabel text={ORGANIZATION_LOWER} />,
        part2: DEVFLAGS.freeTier.maxUsers,
        part3: <UiLabel text={ORGANIZATION_LOWER} />,
        part4: (
          <a href="https://www.plasmic.app/pricing" target="_blank">
            <UiText
              message={"create such a {kind}"}
              values={{ kind: <UiLabel text={ORGANIZATION_LOWER} /> }}
            />
          </a>
        ),
      }}
    />
  </>
);

export function getTeamInviteLink(team: ApiTeam) {
  const url = new URL(
    APP_ROUTES.org.fill({
      teamId: team.id,
    }),
    getPublicUrl(),
  );
  url.searchParams.set("inviteId", team.inviteId);
  return url.toString();
}

export interface ShareDialogContentProps {
  renderDialog: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
  className?: string;
  closeDialog: () => void;
  resource: ApiResource;
  perms: ApiPermission[];
  reloadPerms: (perms: ApiPermission[]) => Promise<void>;
  updateResourceCallback?: (data: any) => Promise<void>;
}

function ShareDialogContent(props: ShareDialogContentProps) {
  const { t: uiT } = useI18n();
  const { styles, cx } = useShareStyles();
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const { className, resource, perms, reloadPerms, updateResourceCallback } =
    props;
  const [projectInviteOnly, setProjectInviteOnly] = useState(
    resource.type === "project" ? resource.resource.inviteOnly : true,
  );
  const resourceInviteOnly =
    resource.type === "project" ? resource.resource.inviteOnly : true;
  useEffect(() => {
    setProjectInviteOnly(resourceInviteOnly);
  }, [resource.resource.id, resourceInviteOnly]);
  const appCtx = useAppCtx();
  const hasTopFrameCtx = !!useTopFrameCtxMaybe();

  const ownAccessLevel = getAccessLevelToResource(
    resource,
    appCtx.selfInfo,
    perms,
  );

  const ownAccessLevelRank = accessLevelRank(ownAccessLevel);
  // Anyone can invite to a resource if they have at least content access
  // but it will require editor access to update invite by link
  const canInvite = ownAccessLevelRank >= accessLevelRank("content");
  const canEdit = ownAccessLevelRank >= accessLevelRank("editor");
  const [inviteAccessLevel, setInviteAccessLevel] =
    React.useState<GrantableAccessLevel>(canEdit ? "editor" : "viewer");
  const [email, setEmail] = React.useState("");
  const [isEmailInvalid, setEmailInvalid] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const isLoggedIn = appCtx.selfInfo != null;

  const isPersonalProject =
    resource.type === "project" &&
    appCtx.personalWorkspace?.id === resource.resource.workspaceId;

  function withResourceId(grantsOrRevokes: Grant[] | Revoke[]) {
    return grantsOrRevokes.map((p) => {
      p[resourceTypeIdField(resource.type)] = resource.resource.id;
      return p;
    });
  }

  async function doGrantRevoke(
    data: GrantRevokeRequest,
  ): Promise<{ enqueued?: boolean; granted?: boolean }> {
    data.grants = withResourceId(data.grants);
    data.revokes = withResourceId(data.revokes);
    try {
      const { perms: newPerms, enqueued } = await maybeShowPaywall(
        appCtx,
        async () => await appCtx.api.grantRevoke(data),
        {
          title: uiT("Upgrade to grant new permissions"),
          description: uiT(
            "This {part1} does not have enough seats to grant permissions to new users. Please increase the number of seats to be able to perform this action.",
            { part1: translateUiLabel(getUiLocale(), ORGANIZATION_LOWER) },
          ),
        },
      );
      await reloadPerms(newPerms);
      return { enqueued, granted: true };
    } catch (err) {
      if (err instanceof PaywallError && err.type === "requireTeam") {
        notification.warning({
          message: personalProjectPaywallMessage,
          duration: 0,
        });
        return {};
      } else {
        throw err;
      }
    }
  }

  async function invite() {
    const parsedEmail = parseEmailAddress(email);
    if (!parsedEmail) {
      setEmailInvalid(true);
      void message.error({ content: uiT("Insert a valid email to invite") });
      return;
    }
    setEmailInvalid(false);
    setSubmitting(true);
    try {
      const { enqueued, granted } = await doGrantRevoke({
        grants: [
          { email: parsedEmail.normalized, accessLevel: inviteAccessLevel },
        ],
        revokes: [],
      });

      if (!granted) {
        return;
      }
      if (enqueued) {
        notification.info({
          message: uiT("User has been waitlisted"),
          description: uiT(
            "Plasmic is currently in private alpha, so we've waitlisted the user you just tried to invite. Thanks for bearing with us!",
          ),
          placement: "bottomRight",
        });
      } else {
        void message.success({ content: uiT("Invitation sent") });
      }
      setEmail("");
    } catch {
      void message.error({ content: uiT("Failed to invite member") });
    } finally {
      setSubmitting(false);
    }
  }

  const shareByLinkAllowed =
    resource.type === "team" ? !!resource.resource.defaultAccessLevel : false;
  const noShareByLink =
    resource.type === "team" && !!resource.resource.defaultAccessLevel
      ? ownAccessLevelRank <
        accessLevelRank(resource.resource.defaultAccessLevel)
      : false;

  const updateProject = async (inviteOnly: boolean) => {
    assert(resource.type === "project", 'Resource type must be "project"');
    setUpdatingAccess(true);
    try {
      const data = await maybeShowPaywall(appCtx, () =>
        appCtx.api.setSiteInfo(resource.resource.id, { inviteOnly }),
      );
      setProjectInviteOnly(inviteOnly);
      await updateResourceCallback?.(data);
    } catch {
      void message.error({ content: uiT("Failed to update permissions") });
    } finally {
      setUpdatingAccess(false);
    }
  };

  const updateTeam = async (
    defaultAccessLevel: GrantableAccessLevel | null,
  ) => {
    assert(resource.type === "team", 'Resource type must be "team"');
    const data = await appCtx.api.updateTeam(resource.resource.id, {
      defaultAccessLevel,
    });
    await updateResourceCallback?.(data);
  };

  const existingPermItems = L.sortBy(
    filterDirectResourcePerms(perms, convertToTaggedResourceId(resource)),
    (p) =>
      `${p.accessLevel === "owner" ? 0 : 1}_${
        p.email ||
        ensure(p.user, "Permission with no email must have an user").email
      }`,
  ).map((perm) => {
    const permEmail =
      perm.email ||
      ensure(perm.user, "Permission with no email must have an user").email;
    const displayEmail =
      perm.email ||
      getUserEmail(
        ensure(perm.user, "Permission with no email must have an user"),
      );
    return (
      <PermissionItem
        key={permEmail}
        email={displayEmail}
        name={perm.user?.displayName}
        isSelf={perm.userId === appCtx.selfInfo?.id}
        description={
          resource.type === "project"
            ? uiT("Direct project permission")
            : undefined
        }
        accessLevel={perm.accessLevel}
        canEdit={canEdit}
        showOwnerOption={
          resource.type === "project" && ownAccessLevel === "owner"
        }
        onGrant={async (accessLevel) => {
          if (accessLevel === "owner") {
            const selfEmail = ensure(
              appCtx.selfInfo?.email,
              "Must be logged in to transfer ownership",
            );
            const confirmed = await reactConfirm({
              title: uiT("Transfer ownership"),
              message: (
                <>
                  <UiText
                    message={
                      "You will lose owner status and become an editor. Transfer ownership of {part1} to {part2}?"
                    }
                    values={{
                      part1: <strong>{resource.resource.name}</strong>,
                      part2: permEmail,
                    }}
                  />
                </>
              ),
            });
            if (!confirmed) {
              return;
            }
            await doGrantRevoke({
              // Order matters: the new owner must be promoted before the
              // current owner self-demotes, since the server processes
              // grants sequentially and the actor must still be an owner to
              // grant owner.
              grants: [
                { email: permEmail, accessLevel: "owner" },
                { email: selfEmail, accessLevel: "editor" },
              ],
              revokes: [],
            });
          } else {
            await doGrantRevoke({
              grants: [{ email: permEmail, accessLevel }],
              revokes: [],
            });
          }
        }}
        onRevoke={async () => {
          await doGrantRevoke({
            revokes: [{ email: permEmail }],
            grants: [],
          });
        }}
      />
    );
  });

  const copyLinkWithFeedback = (url: string) => {
    if (copy(url)) {
      void message.success({ content: uiT("Link copied") });
    } else {
      void message.error({ content: uiT("Could not copy link") });
    }
  };

  const projectFooter =
    resource.type === "project" ? (
      <div className={styles.footer}>
        <span className={styles.caption}>
          {uiT("Permission changes take effect immediately.")}
        </span>
        {hasTopFrameCtx && (
          <Button
            onClick={() => {
              analytics().track("project-copy-menu", {
                item: "copy-current-arena-link",
              });
              copyLinkWithFeedback(window.location.href);
            }}
          >
            {uiT("Copy link to current arena")}
          </Button>
        )}
        <Button
          type="primary"
          onClick={() => {
            analytics().track("project-copy-menu", {
              item: "button-copy-project-link",
            });
            copyLinkWithFeedback(
              new URL(
                APP_ROUTES.project.fill({ projectId: resource.resource.id }),
                getPublicUrl(),
              ).toString(),
            );
          }}
        >
          {uiT("Copy project link")}
        </Button>
      </div>
    ) : null;

  const collaboratorShareDialog =
    resource.type === "project" ? (
      <div className={cx(styles.root, className)}>
        <Scrollbar scrollX={false} className={styles.body}>
          <section className={styles.section}>
            <h3>{uiT("Invite members")}</h3>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!submitting && canInvite) {
                  spawn(invite());
                }
              }}
            >
              <div className={styles.inviteRow}>
                <Input
                  aria-label={uiT("Invite email")}
                  placeholder={uiT("Enter email address")}
                  value={email}
                  disabled={submitting || !canInvite}
                  status={isEmailInvalid ? "error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailInvalid(false);
                  }}
                />
                <AntdSelect
                  aria-label={uiT("Permission level for new user")}
                  value={inviteAccessLevel}
                  disabled={submitting || !canInvite}
                  onChange={setInviteAccessLevel}
                  options={permissionRoles.map(([value, label]) => ({
                    value,
                    label: uiT(label),
                    disabled: accessLevelRank(value) > ownAccessLevelRank,
                  }))}
                />
                <Button
                  htmlType="submit"
                  disabled={!email.trim() || !canInvite}
                  loading={submitting}
                >
                  {uiT("Invite")}
                </Button>
              </div>
              <p className={styles.caption}>
                {uiT(permissionDescriptions[inviteAccessLevel])}
              </p>
              {isEmailInvalid && (
                <p role="alert">{uiT("Insert a valid email to invite")}</p>
              )}
              {!canInvite && (
                <p className={styles.caption}>
                  {uiT("You do not have permission to invite members.")}
                </p>
              )}
            </form>
          </section>
          <section className={styles.section}>
            <h3>{uiT("Who has access")}</h3>
            {existingPermItems}
          </section>
          {(resource.resource.teamId ||
            (resource.resource.workspaceId && !isPersonalProject)) &&
            !isPersonalProject && (
              <details className={styles.inherited}>
                <summary>
                  {uiT("Organization and workspace permissions")}
                </summary>
                {resource.resource.teamId && (
                  <div className={styles.inheritedRow}>
                    <span>{resource.resource.teamName}</span>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={APP_ROUTES.org.fill({
                        teamId: resource.resource.teamId,
                      })}
                    >
                      {uiT("Manage")}
                    </a>
                  </div>
                )}
                {resource.resource.workspaceId && (
                  <div className={styles.inheritedRow}>
                    <span>{resource.resource.workspaceName}</span>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={APP_ROUTES.workspace.fill({
                        workspaceId: resource.resource.workspaceId,
                      })}
                    >
                      {uiT("Manage")}
                    </a>
                  </div>
                )}
              </details>
            )}
          <section className={styles.access}>
            <div className={styles.accessRow}>
              <h3>
                <LockOutlined /> {uiT("Everyone else")}
              </h3>
              <AntdSelect
                aria-label={uiT("Everyone else permission")}
                value={projectInviteOnly ? "none" : "viewer"}
                disabled={!canEdit || updatingAccess}
                loading={updatingAccess}
                onChange={(key) => spawn(updateProject(key === "none"))}
                options={[
                  { value: "none", label: uiT("None") },
                  { value: "viewer", label: uiT("Viewer") },
                ]}
              />
            </div>
            <p className={styles.caption}>
              {uiT(
                projectInviteOnly
                  ? "Other people cannot view this project. Existing project, workspace, and organization permissions still apply."
                  : "Other people can open this project with viewer permissions.",
              )}
            </p>
          </section>
        </Scrollbar>
      </div>
    ) : (
      <PP__ShareDialogContent
        className={className}
        resourceType={resource.type}
        existingPermItems={existingPermItems}
        state={
          !isLoggedIn
            ? "unlogged"
            : submitting
              ? "submitting"
              : isEmailInvalid
                ? "invalidEmail"
                : !canInvite
                  ? "noPermToShare"
                  : undefined
        }
        shareByLinkAllowed={shareByLinkAllowed ? "yes" : "no"}
        newUserRoleDropdown={{
          value: inviteAccessLevel,
          "aria-label": uiT("Permission level for new user"),
          onChange: (key) => setInviteAccessLevel(key as GrantableAccessLevel),
          children: [
            <Select.Option value="viewer">{viewerTooltip}</Select.Option>,
            <Select.Option value="commenter">{commenterTooltip}</Select.Option>,
            <Select.Option
              value="content"
              isDisabled={ownAccessLevelRank < accessLevelRank("content")}
            >
              {contentCreatorTooltip}
            </Select.Option>,
            <Select.Option
              value="designer"
              isDisabled={ownAccessLevelRank < accessLevelRank("designer")}
            >
              {designerTooltip}
            </Select.Option>,
            <Select.Option
              value="editor"
              isDisabled={ownAccessLevelRank < accessLevelRank("editor")}
            >
              {developerTooltip}
            </Select.Option>,
          ],
          isDisabled: submitting || !canInvite,
        }}
        shareByLinkPermDropdown={
          resource.type === "team" && resource.resource.defaultAccessLevel
            ? {
                "aria-label": uiT("Default permission for link sharing"),
                value: resource.resource.defaultAccessLevel,
                onChange: (value) => updateTeam(value as GrantableAccessLevel),
                children: [
                  <Select.Option value="viewer">{viewerTooltip}</Select.Option>,
                  <Select.Option value="commenter">
                    {commenterTooltip}
                  </Select.Option>,
                  <Select.Option value="content">
                    {contentCreatorTooltip}
                  </Select.Option>,
                  <Select.Option value="designer">
                    {designerTooltip}
                  </Select.Option>,
                  <Select.Option value="editor">
                    {developerTooltip}
                  </Select.Option>,
                ],
                isDisabled: !canEdit,
              }
            : undefined
        }
        newUserEmail={{
          onChange: (e) => {
            setEmail(e.target.value);
            if (isEmailInvalid && parseEmailAddress(e.target.value)) {
              setEmailInvalid(false);
            }
          },
          value: email,
          onEnter: invite,
        }}
        sendInviteButton={{
          onClick: invite,
        }}
        copyLink={
          resource.type === "team"
            ? {
                onClick: () => copy(getTeamInviteLink(resource.resource)),
              }
            : undefined
        }
        noShareByLink={noShareByLink}
        shareByLinkSwitch={
          resource.type === "team"
            ? {
                isDisabled: !canEdit,
                onChange: (checked: boolean) => {
                  if (checked) {
                    spawn(updateTeam("viewer"));
                  } else {
                    spawn(updateTeam(null));
                  }
                },
              }
            : undefined
        }
        permsCascade={{ showTeam: resource.type === "workspace" }}
        teamLink={{
          props: {
            href:
              resource.type === "workspace"
                ? APP_ROUTES.org.fill({ teamId: resource.resource.team.id })
                : undefined,
            target: "_blank",
          },
          wrap: (node) => <ClickStopper>{node}</ClickStopper>,
        }}
        teamName={{
          props: {
            children:
              resource.type === "workspace"
                ? resource.resource.team.name
                : undefined,
          },
        }}
      />
    );

  const { config, loading: loadingAuthConfig } =
    resource.type === "project"
      ? useAppAuthConfig(appCtx, resource.resource.id)
      : { config: undefined, loading: false };
  const showEndUsersTab =
    hasTopFrameCtx && resource.type === "project" && config;

  const [currentTab, setCurrentTab] = useState<"end-users" | "collaborators">(
    showEndUsersTab ? "end-users" : "collaborators",
  );

  useEffect(() => {
    setCurrentTab(showEndUsersTab ? "end-users" : "collaborators");
  }, [loadingAuthConfig]);

  if (loadingAuthConfig) {
    return props.renderDialog(<Spinner />, null);
  }

  const TabsWrapper = () => {
    return (
      <Tabs
        onSwitch={(tabKey) => {
          setCurrentTab(tabKey);
        }}
        barWrapper={(bar) => (
          <div
            style={{
              fontSize: 12,
              paddingLeft: 16,
            }}
          >
            {bar}
          </div>
        )}
        tabKey={currentTab}
        useDefaultClasses={false}
        tabClassName="hilite-tab"
        activeTabClassName="hilite-tab--active"
        tabs={withoutFalsy([
          showEndUsersTab &&
            new Tab({
              name: "End users",
              key: "end-users",
              contents: () => {
                return (
                  <PermissionsTab
                    appCtx={appCtx}
                    project={resource.resource}
                    directoryId={config.directoryId!}
                  />
                );
              },
            }),
          new Tab({
            name: "Collaborators",
            key: "collaborators",
            contents: () => {
              return collaboratorShareDialog;
            },
          }),
        ])}
      ></Tabs>
    );
  };

  const body = (
    <div style={{ width: "100%", minWidth: 0 }}>
      {showEndUsersTab ? TabsWrapper() : collaboratorShareDialog}
    </div>
  );
  const footer =
    showEndUsersTab && currentTab === "end-users" ? null : projectFooter;
  return props.renderDialog(body, footer);
}

export default ShareDialogContent;
