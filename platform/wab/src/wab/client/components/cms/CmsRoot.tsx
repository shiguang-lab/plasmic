import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import { useCmsDatabase } from "@/wab/client/components/cms/cms-contexts";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultCmsRootProps,
  PlasmicCmsRoot,
} from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsRoot";
import { Redirect } from "@/wab/client/route/Redirect";
import { Switch, switchCase, switchDefault } from "@/wab/client/route/Switch";
import { CmsDatabaseId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Alert, Button, Skeleton } from "antd";
import * as React from "react";

export interface CmsRootProps extends DefaultCmsRootProps {
  databaseId: CmsDatabaseId;
}

function CmsRoot_(props: CmsRootProps, ref: HTMLElementRefOf<"div">) {
  const { databaseId, ...rest } = props;
  const { t } = useI18n();
  const { styles } = useCmsLayoutStyles();
  const { database, error, mutate } = useCmsDatabase(databaseId);
  if (!database) {
    return (
      <div className={styles.loading}>
        {error ? (
          <Alert
            type="error"
            showIcon
            title={t("Failed to load content library")}
            action={
              <Button
                onClick={() => {
                  void mutate();
                }}
              >
                {t("Retry")}
              </Button>
            }
          />
        ) : (
          <div role="status" aria-label={t("Loading content library…")}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        )}
      </div>
    );
  }
  return (
    <Switch
      cases={[
        switchCase({
          route: APP_ROUTES.cmsContentRoot,
          render: () => (
            <PlasmicCmsRoot
              root={{ ref, className: styles.root }}
              activeTab={"content"}
              {...rest}
            />
          ),
        }),
        switchCase({
          route: APP_ROUTES.cmsSchemaRoot,
          render: () => (
            <PlasmicCmsRoot
              root={{ ref, className: styles.root }}
              activeTab={"schema"}
              {...rest}
            />
          ),
        }),
        switchCase({
          route: APP_ROUTES.cmsSettings,
          render: () => (
            <PlasmicCmsRoot
              root={{ ref, className: styles.root }}
              activeTab={"settings"}
              {...rest}
            />
          ),
        }),
        switchDefault({
          render: () => (
            <Redirect
              to={APP_ROUTES.cmsContentRoot.fill({ databaseId: databaseId })}
            />
          ),
        }),
      ]}
    />
  );
}

const CmsRoot = React.forwardRef(CmsRoot_);
export default CmsRoot;
