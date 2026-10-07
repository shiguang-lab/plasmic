import { useAppAuthPubConfig } from "@/wab/client/components/app-auth/app-auth-contexts";
import { IntakeFlowForm } from "@/wab/client/components/pages/IntakeFlowForm";
import { Spinner } from "@/wab/client/components/widgets";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
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
        This app is not configured correctly for authentication. Please contact
        the app owner.
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
          Sign in with Shiguang
        </Button>
      </IntakeFlowForm>
    );
  }
  if (!appCtx.selfInfo.emailVerified) {
    return (
      <IntakeFlowForm>
        <a href="https://shiguanglab.com/account">
          Verify your email in your Shiguang account
        </a>{" "}
        before signing in to this app.
      </IntakeFlowForm>
    );
  }
  if (!config.allowed) {
    return (
      <IntakeFlowForm>
        You ({appCtx.selfInfo.email}) are not authorized to access{" "}
        {config.appName}. Please contact the app owner.
      </IntakeFlowForm>
    );
  }
  return (
    <IntakeFlowForm>
      <p>
        You are signing in to <b>{config.appName}</b> as{" "}
        {appCtx.selfInfo.displayName}.
      </p>
      <Button
        type="primary"
        onClick={() =>
          window.location.replace(
            `${getPublicUrl()}/api/v1/app-auth/code?${params}`,
          )
        }
      >
        Sign in
      </Button>
    </IntakeFlowForm>
  );
}
