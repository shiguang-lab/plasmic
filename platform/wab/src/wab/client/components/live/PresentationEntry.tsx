import { Api } from "@/wab/client/api";
import { asApiError } from "@/wab/client/api-error-presentation";
import { getLoginRouteWithContinuation } from "@/wab/client/cli-routes";
import { PreviewLoading } from "@/wab/client/components/live/PreviewLoading";
import { Loadable } from "@/wab/client/components/widgets";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { useHostFrameCtxIfHostFrame } from "@/wab/client/frame-ctx/host-frame-ctx";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { Redirect } from "@/wab/client/route/Redirect";
import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
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
      loadingContents={() => <PreviewLoading />}
      contents={() => <>{children}</>}
      failureContents={(retry, error) =>
        asApiError(error)?.statusCode === 401 ? (
          <Redirect to={getLoginRouteWithContinuation()} />
        ) : (
          <PreviewLoading>
            <LoadingError onRetry={retry} />
          </PreviewLoading>
        )
      }
    />
  );
}
