import { Api } from "@/wab/client/api";
import { asApiError } from "@/wab/client/api-error-presentation";
import { ShiguangSignIn } from "@/wab/client/components/pages/ShiguangSignIn";
import { StudioChrome } from "@/wab/client/components/studio/StudioChrome";
import { Loadable } from "@/wab/client/components/widgets";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { useHostFrameCtxIfHostFrame } from "@/wab/client/frame-ctx/host-frame-ctx";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { Redirect } from "@/wab/client/route/Redirect";
import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { createPath } from "history";
import * as React from "react";

export function PresentationEntry({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const host = useHostFrameCtxIfHostFrame();
  const code = APP_ROUTES.projectPresentation.parse(location.pathname)?.code;
  if (!code) {
    return <>{children}</>;
  }
  return (
    <Loadable
      key={code}
      loader={async () => {
        const api = host?.topFrameApi || new Api();
        const result = await api.getPresentation(code);
        registerPresentationProject(code, result.projectId);
        return result;
      }}
      loadingContents={() => <StudioChrome />}
      contents={() => <>{children}</>}
      failureContents={(retry, error) => {
        if (asApiError(error)?.statusCode === 401) {
          // The cross-origin canvas asks Studio to handle top-level navigation.
          return host ? (
            <Redirect to={APP_ROUTES.login.fill({}, { continueTo: createPath(location) })} />
          ) : (
            <ShiguangSignIn />
          );
        }
        return (
          <StudioChrome>
            <LoadingError onRetry={retry} />
          </StudioChrome>
        );
      }}
    />
  );
}
