import {
  CmsDetailsLayout,
  CmsSettingsLayout,
} from "@/wab/client/components/cms/CmsDetailsLayout";
import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import { CmsNavigation } from "@/wab/client/components/cms/CmsLeftTabs";
import { CmsModelsListLayout } from "@/wab/client/components/cms/CmsModelsList";
import { CmsTopBarChrome } from "@/wab/client/components/cms/CmsTopBar";
import {
  FormSkeleton,
  PillSkeleton,
  RowsSkeleton,
} from "@/wab/client/components/widgets/ContentSkeletons";
import { useI18n } from "@/wab/client/i18n";
import { PlasmicCmsContentPage } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsContentPage";
import { PlasmicCmsModelContent } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsModelContent";
import { PlasmicCmsRoot } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsRoot";
import { PlasmicCmsSchemaPage } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsSchemaPage";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Flex, Input, Select, Skeleton } from "antd";
import * as React from "react";

export function CmsContentLoading({ schema = false }: { schema?: boolean }) {
  const { t } = useI18n();
  const { styles, cx } = useCmsLayoutStyles();
  const modelsList = {
    render: ({ className }: { className?: string }) => (
      <CmsModelsListLayout
        className={className}
        isSchemaMode={schema}
        searchInput={{ disabled: true, value: "" }}
        addAction={<PillSkeleton width={32} height={32} />}
      >
        <RowsSkeleton rows={5} />
      </CmsModelsListLayout>
    ),
  };
  if (schema) {
    return (
      <PlasmicCmsSchemaPage
        cmsModelsList={modelsList}
        cmsModelDetails={{
          render: ({ className }) => (
            <CmsDetailsLayout className={className}>
              <FormSkeleton />
            </CmsDetailsLayout>
          ),
        }}
      />
    );
  }
  return (
    <PlasmicCmsContentPage
      cmsModelsList={modelsList}
      cmsModelContent={{
        render: ({ className }) => (
          <PlasmicCmsModelContent
            className={className}
            entriesList={{
              render: ({ className: listClassName }) => (
                <section className={cx(listClassName, styles.entries)}>
                  <Flex
                    className={styles.sidePanelHeader}
                    justify="space-between"
                    align="center"
                  >
                    <Skeleton.Input
                      active
                      size="small"
                      style={{ width: 120 }}
                    />
                    <PillSkeleton width={32} height={32} />
                  </Flex>
                  <div className={styles.sidePanelBody}>
                    <Input.Search disabled placeholder={t("Search…")} />
                    <Select
                      disabled
                      value="last-created"
                      options={[
                        { value: "last-created", label: t("Last created") },
                      ]}
                    />
                    <Scrollbar scrollX={false} className={styles.entryList}>
                      <RowsSkeleton rows={5} />
                    </Scrollbar>
                  </div>
                </section>
              ),
            }}
            entryDetail={{
              render: ({ className: detailClassName }) => (
                <CmsDetailsLayout className={detailClassName}>
                  <div role="status" aria-label={t("Loading content entries…")}>
                    <FormSkeleton />
                  </div>
                </CmsDetailsLayout>
              ),
            }}
          />
        ),
      }}
    />
  );
}

// The initial shell uses the actual CMS layout while database data and the
// route module load. These overrides don't require an API context.
export function CmsLoadingShell({ content }: { content?: React.ReactNode }) {
  const { pathname } = useLocation();
  const { styles } = useCmsLayoutStyles();
  const { t } = useI18n();
  const databaseId = APP_ROUTES.cmsRoot.parse(pathname, false)?.databaseId;
  const activeTab = APP_ROUTES.cmsSettings.parse(pathname)
    ? "settings"
    : APP_ROUTES.cmsSchemaRoot.parse(pathname, false)
      ? "schema"
      : "content";
  const body =
    content ??
    (activeTab === "settings" ? (
      <CmsSettingsLayout
        content={
          <FormSkeleton
            labels={[
              t("CMS ID"),
              t("Public Token"),
              t("Secret Token"),
              t("Locales"),
            ]}
          />
        }
      />
    ) : (
      <CmsContentLoading schema={activeTab === "schema"} />
    ));
  return (
    <PlasmicCmsRoot
      root={{ className: styles.root }}
      activeTab={activeTab}
      cmsTopBar={{
        render: ({ className }) => (
          <CmsTopBarChrome
            className={className}
            navigation={
              <CmsNavigation
                activeTab={activeTab}
                contentHref={
                  databaseId
                    ? APP_ROUTES.cmsContentRoot.fill({ databaseId })
                    : undefined
                }
                schemaHref={
                  databaseId
                    ? APP_ROUTES.cmsSchemaRoot.fill({ databaseId })
                    : undefined
                }
                hideSettings
              />
            }
          >
            <Skeleton.Input active style={{ width: 200 }} />
          </CmsTopBarChrome>
        ),
      }}
      cmsLeftTabs={{ render: () => null }}
      cmsContentPage={{ render: () => <>{body}</> }}
      cmsSchemaPage={{ render: () => <>{body}</> }}
      cmsSettingsPage={{ render: () => <>{body}</> }}
    />
  );
}
