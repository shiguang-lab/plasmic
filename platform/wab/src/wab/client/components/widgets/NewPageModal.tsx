import { Icon } from "@/wab/client/components/widgets/Icon";
import NewComponentItem from "@/wab/client/components/widgets/NewComponentItem";
import NewComponentSection from "@/wab/client/components/widgets/NewComponentSection";
import Textbox, { TextboxRef } from "@/wab/client/components/widgets/Textbox";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { getPageTemplatesGroups } from "@/wab/client/insertable-templates";
import EyeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Eye";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { InsertableTemplatesItem } from "@/wab/shared/devflags";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { formatBusinessHref } from "@plasmic-shared/preview";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Flex, Radio, Tooltip, theme } from "antd";
import * as React from "react";

export type NewPageInfo =
  | {
      name: string;
      type: "blank";
    }
  | {
      name: string;
      type: "dynamic";
    }
  | {
      name: string;
      type: "template";
      componentName: string;
      projectId: string;
    };

interface NewPageModalProps {
  onSubmit: (info: NewPageInfo) => void;
  onCancel: () => void;
  studioCtx: StudioCtx;
  folderPath?: string;
}

function NewPageModal(props: NewPageModalProps) {
  const { t: uiT } = useI18n();
  const { onSubmit, onCancel, studioCtx, folderPath } = props;
  const nameId = React.useId();
  const typeId = React.useId();
  const { token } = theme.useToken();
  const topFrameApi = useTopFrameApi();
  const isDesktop = navigator.userAgent.includes("PlasmicDesktop/");

  const [pageInfo, setPageInfo] = React.useState<NewPageInfo>({
    type: "blank",
    name: "",
  });
  const nameRef = React.useRef<TextboxRef>(null);

  React.useEffect(() => {
    if (folderPath !== undefined) {
      setPageInfo((prev) => ({ ...prev, name: folderPath }));
    }
  }, [folderPath]);

  const isApp = studioCtx.siteInfo.hasAppAuth;
  const contentEditorMode = studioCtx.contentEditorMode;
  const pageTemplatesGroups =
    isApp || contentEditorMode ? [] : getPageTemplatesGroups(studioCtx);
  const showDefaultPageTemplates =
    pageTemplatesGroups.length === 0 ||
    !studioCtx.getCurrentUiConfig().hideDefaultPageTemplates;

  const getNewPageName = (defaultName: string) => {
    return !pageInfo.name ||
      (pageInfo.type === "template" && pageInfo.name === pageInfo.componentName)
      ? defaultName
      : pageInfo.name;
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pageInfo.name) {
          onSubmit(pageInfo);
        }
      }}
    >
      <Scrollbar
        className="studio-scrollbar"
        scrollX={false}
        style={{ maxHeight: "calc(100dvh - 160px)", minHeight: 0 }}
      >
        <Flex vertical gap={16} style={{ padding: 3 }}>
          <Flex vertical gap={6}>
            <label htmlFor={nameId}>{uiT("Name")}</label>
            <Textbox
              id={nameId}
              ref={nameRef}
              autoFocus
              isDelayedFocus
              styleType={["bordered"]}
              placeholder={uiT("New page name")}
              data-test-id="prompt"
              value={pageInfo.name}
              onChange={(event) =>
                setPageInfo({ ...pageInfo, name: event.target.value })
              }
            />
          </Flex>
          {showDefaultPageTemplates && (
            <Flex vertical gap={6}>
              <span id={typeId}>{uiT("Type")}</span>
              <Radio.Group
                aria-labelledby={typeId}
                value={pageInfo.type}
                options={[
                  { value: "blank", label: uiT("Empty page") },
                  { value: "dynamic", label: uiT("Dynamic page") },
                ]}
                onChange={({ target }) =>
                  setPageInfo({
                    type: target.value,
                    name: getNewPageName("NewPage"),
                  })
                }
              />
            </Flex>
          )}
          {pageTemplatesGroups.map((group, idx) => (
            <NewComponentSection
              title={group.name}
              key={`page-templates-section-${group.name}-${idx}`}
            >
              {(
                group.items.filter(
                  (c) => c.type === "insertable-templates-item",
                ) as InsertableTemplatesItem[]
              ).map((comp) => {
                return (
                  <NewComponentItem
                    key={`page-templates-item-${comp.projectId}-${comp.componentName}`}
                    isSelected={
                      pageInfo.type === "template" &&
                      comp.componentName === pageInfo.componentName &&
                      comp.projectId === pageInfo.projectId
                    }
                    title={
                      <span style={{ color: token.colorText }}>
                        {comp.displayName || comp.componentName}
                      </span>
                    }
                    imgUrl={comp.imageUrl}
                    onClick={() => {
                      setPageInfo({
                        type: "template",
                        componentName: comp.componentName,
                        projectId: comp.projectId,
                        name: getNewPageName(comp.componentName),
                      });
                      if (nameRef.current) {
                        nameRef.current.focus();
                      }
                    }}
                    controls={
                      <Tooltip title={uiT("Open page template in new window")}>
                        <Icon
                          icon={EyeIcon}
                          onClick={async () => {
                            const preview = isDesktop
                              ? undefined
                              : window.open("about:blank", "_blank");
                            if (!isDesktop && !preview) {
                              return;
                            }
                            if (preview) {
                              preview.opener = null;
                            }
                            let launched = false;
                            return await (async () => {
                              await studioCtx.projectDependencyManager.fetchInsertableTemplate(
                                comp.projectId,
                              );
                              const template =
                                studioCtx.projectDependencyManager.getInsertableTemplate(
                                  comp,
                                );
                              if (!template) {
                                return;
                              }
                              const { code } =
                                await studioCtx.appCtx.api.createPresentation(
                                  comp.projectId as ProjectId,
                                );
                              const component = template.component;
                              const page = component.pageMeta;
                              const pathname = page
                                ? formatBusinessHref({
                                    pathname: page.path,
                                    query: page.params,
                                  })
                                : "/";
                              const path = formatBusinessHref({
                                pathname,
                                query: page?.query,
                              });
                              const route =
                                APP_ROUTES.projectPresentation.fill(
                                  { code },
                                  page ? {} : { component: component.uuid },
                                ) + `#${path}`;
                              const studioUrl =
                                await studioCtx.appCtx.api.getStudioUrl();
                              const url = new URL(route, studioUrl).href;
                              if (isDesktop) {
                                await topFrameApi.openDesktopPreview(url);
                              } else {
                                preview?.location.replace(url);
                              }
                              launched = true;
                            })().finally(() => {
                              if (!launched) {
                                preview?.close();
                              }
                            });
                          }}
                        />
                      </Tooltip>
                    }
                    large
                    showControls
                  />
                );
              })}
            </NewComponentSection>
          ))}
        </Flex>
      </Scrollbar>
      <Flex justify="end" gap={8} style={{ marginTop: 20 }}>
        <Button onClick={onCancel}>{uiT("Cancel")}</Button>
        <Button
          type="primary"
          htmlType="submit"
          disabled={!pageInfo.name}
          data-test-id="prompt-submit"
        >
          {uiT("Create page")}
        </Button>
      </Flex>
    </form>
  );
}

export default NewPageModal;
