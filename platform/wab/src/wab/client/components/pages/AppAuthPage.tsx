import { useAppAuthPubConfig } from "@/wab/client/components/app-auth/app-auth-contexts";
import { IntakeFlowForm } from "@/wab/client/components/pages/IntakeFlowForm";
import { Spinner } from "@/wab/client/components/widgets";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import { getPublicUrl } from "@/wab/shared/urls";
import { Button } from "antd";
import React from "react";

/** Authorization for a published app; user authentication belongs to Shiguang. */
export function AppAuthPage() {
  const appCtx = useAppCtx();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const clientId = params.get("client_id");
  const { config, loading } = useAppAuthPubConfig(
    appCtx,
    clientId ?? "",
    appCtx.selfInfo?.email,
  );
  const required = [
    "client_id",
    "state",
    "response_type",
    "code_challenge",
    "code_challenge_method",
  ];
  if (loading) {
    return <Spinner />;
  }
  if (!config || required.some((key) => !params.get(key))) {
    return (
      <IntakeFlowForm>
        <UiText
          message={
            "This app is not configured correctly for authentication. Please contact the app owner."
          }
        />
      </IntakeFlowForm>
    );
  }
  if (!appCtx.selfInfo) {
    return (
      <IntakeFlowForm>
        <Button
          type="primary"
          href={getShiguangSignInUrl(window.location.href)}
        >
          <UiText message={"Sign in with Shiguang"} />
        </Button>
      </IntakeFlowForm>
    );
  }
  if (!appCtx.selfInfo.emailVerified) {
    return (
      <IntakeFlowForm>
        <UiText
          message="Verify your email before signing in to this app. {link}"
          values={{
            link: (
              <a href="https://shiguanglab.com/account">
                <UiText message="Verify your email in your Shiguang account" />
              </a>
            ),
          }}
        />
      </IntakeFlowForm>
    );
  }
  if (!config.allowed) {
    return (
      <IntakeFlowForm>
        <UiText
          message="You ({email}) are not authorized to access {app}. Please contact the app owner."
          values={{ email: appCtx.selfInfo.email, app: config.appName }}
        />
      </IntakeFlowForm>
    );
  }
  return (
    <IntakeFlowForm>
      <p>
        <UiText
          message={"You are signing in to {part1} as {part2}."}
          values={{
            part1: <b>{config.appName}</b>,
            part2: appCtx.selfInfo.displayName,
          }}
        />
      </p>
      <Button
        type="primary"
        onClick={() =>
          window.location.replace(
            `${getPublicUrl()}/api/v1/app-auth/code?${params}`,
          )
        }
      >
        <UiText message={"Sign in"} />
      </Button>
    </IntakeFlowForm>
  );
}
