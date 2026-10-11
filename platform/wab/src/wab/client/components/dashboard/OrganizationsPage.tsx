import { promptNewTeam } from "@/wab/client/components/dashboard/dashboard-actions";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { Redirect } from "@/wab/client/route/Redirect";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

export default observer(function OrganizationsPage() {
  const appCtx = useAppCtx();
  const { t } = useI18n();
  const history = useHistory();
  const team = appCtx.getAllTeams()[0];
  if (team) {
    return <Redirect to={APP_ROUTES.org.fill({ teamId: team.id })} />;
  }
  return (
    <section className={styles.spacesEmpty}>
      {documentTitle(t("Spaces"))}
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("No organizations yet.")}
      >
        <Button
          type="primary"
          icon={<PlusOutlined aria-hidden />}
          onClick={() => void promptNewTeam(appCtx, history)}
        >
          {t("New organization")}
        </Button>
      </Empty>
    </section>
  );
});
