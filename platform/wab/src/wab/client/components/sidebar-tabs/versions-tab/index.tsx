import { promptPublishProj } from "@/wab/client/components/modals/UpgradeDepModal";
import { RevisionsList } from "@/wab/client/components/sidebar-tabs/versions-tab/RevisionsList";
import { VersionsList } from "@/wab/client/components/sidebar-tabs/versions-tab/VersionsList";
import { useVersionsStyles } from "@/wab/client/components/sidebar-tabs/versions-tab/styles";
import { Matcher } from "@/wab/client/components/view-common";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import PlasmicLeftVersionsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftVersionsPanel";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { spawn } from "@/wab/shared/common";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Dropdown, Input, Menu, Spin } from "antd";
import { observer } from "mobx-react";
import React from "react";

const FilterValueToLabel = {
  all: "All",
  revisions: "Autosaved Versions",
  versions: "Published Versions",
} as const;

type VersionsFilter = keyof typeof FilterValueToLabel;

interface VersionsTabProps {
  useVersionsCTA: boolean;
  dismissVersionsCTA: () => void;
}

export const VersionsTab = observer(function VersionsTab(
  props: VersionsTabProps,
) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles } = useVersionsStyles();
  const [query, setQuery] = React.useState("");
  const [isPublishing, setIsPublishing] = React.useState<boolean>(false);
  const [filter, setFilter] = React.useState<VersionsFilter>("all");
  const matcher = React.useMemo(() => new Matcher(query), [query]);
  const readOnly = studioCtx.getLeftTabPermission("versions") === "readable";

  async function publishProject() {
    const response = await promptPublishProj({ studioCtx });

    if (response && response.confirm) {
      setIsPublishing(true);
      await studioCtx.publish(
        response.tags,
        response.title,
        studioCtx.dbCtx().branchInfo?.id,
      );
      setIsPublishing(false);
    }
  }

  const renderPublishingSkeleton = () => {
    return (
      <div
        id="publishing-version-spinner-item"
        className="SidebarSectionListItem hover-outline group pointer"
      >
        <Spin size="small" className="ml-sm" />
        <div className="flex-fill ml-sm text-ellipsis text-unselectable">
          <UiText message={"A new version is being published"} />
        </div>
      </div>
    );
  };

  return (
    <PlasmicLeftVersionsPanel
      root={{ className: styles.root }}
      leftSearchPanel={{
        render: () => (
          <div className={styles.search}>
            <Input.Search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search...")}
              aria-label={t("Search")}
              autoFocus
              allowClear
            />
          </div>
        ),
      }}
      publishButton={
        readOnly
          ? { render: () => null }
          : {
              onClick: () => spawn(publishProject()),
            }
      }
      list={filter}
      filterButton={{
        props: {
          children: t(FilterValueToLabel[filter]),
        },
        wrap: (node) => (
          <Dropdown
            popupRender={() => (
              <Menu selectedKeys={[filter]}>
                {Object.entries(FilterValueToLabel).map(([key, label]) => (
                  <Menu.Item
                    key={key}
                    onClick={() => setFilter(key as VersionsFilter)}
                  >
                    {t(label)}
                  </Menu.Item>
                ))}
              </Menu>
            )}
          >
            {node}
          </Dropdown>
        ),
      }}
      revisionsContainer={<RevisionsList studioCtx={studioCtx} />}
      versionsContainer={
        <VersionsList studioCtx={studioCtx} matcher={matcher} />
      }
      content={{
        as: Scrollbar,
        props: {
          scrollX: false,
          style: { overflow: "hidden", flex: 1, height: "auto" },
        },
        wrap: (node) => (
          <>
            {isPublishing && renderPublishingSkeleton()}
            {node}
          </>
        ),
      }}
      variants={
        props.useVersionsCTA
          ? {
              showAlert: "showAlert",
            }
          : {}
      }
      versionsHeader={{
        title: null,
        description: (
          <div className={styles.description}>
            <div>{t("Autosaved versions let you restore previous edits.")}</div>
            <div>
              {t("Published versions are snapshots for deployment and reuse.")}
            </div>
          </div>
        ),
        ...(props.useVersionsCTA
          ? {
              alert: (
                <div>
                  <UiText message={"Newest changes haven't been published."} />{" "}
                  <a onClick={props.dismissVersionsCTA}>
                    <UiText message={"[Dismiss]"} />
                  </a>
                </div>
              ),
            }
          : {}),
      }}
    />
  );
});
