import { showError } from "@/wab/client/ErrorNotifications";
import { AppCtx, AppOps } from "@/wab/client/app-ctx";
import { AddTrustedHostModal } from "@/wab/client/components/AddTrustedHostModal";
import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import SettingsContainer from "@/wab/client/components/pages/plasmic/SettingsContainer";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useAsyncStrict } from "@/wab/client/hooks/useAsyncStrict";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultSettingsPageProps,
  PlasmicSettingsPage,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicSettingsPage";
import { ApiTrustedHost } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import copy from "copy-to-clipboard";
import * as React from "react";
import { useStore } from "zustand";

interface SettingsPageProps extends DefaultSettingsPageProps {
  appCtx: AppCtx;
}

interface SettingsContentProps extends SettingsPageProps {
  displayName: string;
  email: string;
  ops: AppOps;
  rootRef: HTMLElementRefOf<"div">;
}

function SettingsPageContent(props: SettingsContentProps) {
  "use memo";
  const { appCtx, displayName, email, ops, rootRef, ...rest } = props;
  const { t } = useI18n();
  const tokensState = usePersonalApiTokens();
  const [copiedToken, setCopiedToken] = React.useState("");
  const [hostsState, setHostsState] = React.useState<
    "loading" | "error" | ApiTrustedHost[]
  >();
  const [showHostModal, setShowHostModal] = React.useState(false);

  const updateHostList = React.useCallback(() => {
    setHostsState("loading");
    appCtx.api
      .getTrustedHostsList()
      .then((data) => setHostsState(data.trustedHosts))
      .catch((error) => {
        setHostsState("error");
        showError(error, { title: "Unable to load trusted hosts." });
      });
  }, [appCtx, setHostsState]);

  React.useEffect(() => {
    updateHostList();
  }, [updateHostList]);
  return (
    <>
      {documentTitle(t("Settings"))}
      <PlasmicSettingsPage
        root={{ ref: rootRef, className: dashboard.dashboardContent }}
        {...rest}
        defaultLayout={{
          render: () => (
            <>
              {showHostModal && (
                <AddTrustedHostModal
                  appCtx={appCtx}
                  onCancel={() => setShowHostModal(false)}
                  onUpdate={() => {
                    updateHostList();
                    setShowHostModal(false);
                  }}
                />
              )}
              <SettingsContainer
                name={displayName}
                email={email}
                tokensState={tokensState}
                hostsState={hostsState}
                onRetryTrustedHosts={updateHostList}
                onNewToken={() => ops.createPersonalApiToken()}
                onDeleteToken={(token: string) =>
                  ops.revokePersonalApiToken(token)
                }
                onCopyToken={(e: React.MouseEvent, token: string) => {
                  setCopiedToken(token);
                  copy(token);
                }}
                copiedToken={copiedToken}
                onDeleteTrustedHost={(host) =>
                  appCtx.api
                    .deleteTrustedHost(host.id)
                    .then(() => updateHostList())
                }
                onNewTrustedHost={() => setShowHostModal(true)}
              ></SettingsContainer>
            </>
          ),
        }}
      />
    </>
  );
}

function usePersonalApiTokens() {
  const appCtx = useAppCtx();
  const tokens = useStore(appCtx.personalApiTokensStore, (state) => state);
  const api = appCtx.api;

  return useAsyncStrict(async () => {
    if (tokens === null) {
      const fetched = await api.listPersonalApiTokens();
      appCtx.setPersonalApiTokens(fetched);
      return fetched;
    } else {
      return tokens;
    }
  }, [api, tokens, appCtx]);
}

function SettingsPage_(props: SettingsPageProps, ref: HTMLElementRefOf<"div">) {
  const user = ensure(props.appCtx.selfInfo, "Unexpected null selfInfo");
  return (
    <SettingsPageContent
      {...props}
      displayName={user.displayName}
      email={user.email}
      ops={ensure(props.appCtx.ops, "Unexpected null AppOps")}
      rootRef={ref}
    />
  );
}

const SettingsPage = React.forwardRef(SettingsPage_);
export default SettingsPage;
