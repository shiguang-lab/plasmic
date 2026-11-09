import { useServerQueryInputs, useServerQueryList, useServerFunctionMetadata, useServerFunctionRegistration } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import {
  CustomCodePreview,
  CustomFunctionExprPreview,
  ServerQueryOpSummary,
} from "@/wab/client/components/sidebar-tabs/ServerQuery/QueryResultPreview";
import {
  omitQueryFromEnv,
  useServerQueryBottomModal,
} from "@/wab/client/components/sidebar-tabs/ServerQuery/ServerQueryBottomModal";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { ServerQueriesTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import LabeledListItem from "@/wab/client/components/widgets/LabeledListItem";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { translateUiLabel } from "@/wab/client/i18n/locales";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  CONFIGURE_ACTION,
  DELETE_ACTION,
  DUPLICATE_ACTION,
  SERVER_QUERY_LOWER,
  SERVER_QUERY_PLURAL_CAP,
} from "@/wab/shared/Labels";
import {
  ServerQueryOp,
} from "@/wab/shared/codegen/react-p/server-queries/utils";
import { mkShortId, spawn } from "@/wab/shared/common";
import { clone, ExprCtx } from "@/wab/shared/core/exprs";
import {
  Component,
  ComponentServerQuery,
  isKnownCustomCode,
  isKnownCustomFunctionExpr,
} from "@/wab/shared/model/classes";
import { Button, Menu, Tooltip, notification } from "antd";
import { ok } from "neverthrow";
import React from "react";

const ServerQueryRow = React.memo((props: {
    component: Component;
    query: ComponentServerQuery;
    viewCtx: ViewCtx;
  }) => {
    const { t: studioUiT } = useI18n();

    const { component, query, viewCtx } = props;
  useViewSelection(viewCtx, (state) => state.context);
    const studioCtx = viewCtx.studioCtx;
    const projectFlags = studioCtx.projectFlags();
    // Identity-stable for useServerQueryOp's memo deps.
    const exprCtx: ExprCtx = React.useMemo(
      () => ({
        projectFlags,
        component,
        inStudio: true,
      }),
      [projectFlags, component],
    );
    const schema = useCustomFunctionsSchema(studioCtx);
    const tpl = viewCtx.currentCtxTplRoot();
    const {snapshot, source} = useServerQueryInputs(studioCtx, query, viewCtx);
    const originalOp = snapshot.op ? source.resolve(snapshot.op) : undefined;
    const func = isKnownCustomFunctionExpr(originalOp) ? originalOp.func : undefined;
    const functionVersion = useServerFunctionMetadata(studioCtx, func);
    const registration = useServerFunctionRegistration(viewCtx, func);
    const op = React.useMemo(() => originalOp ? clone(originalOp) : undefined, [originalOp, snapshot.version, functionVersion, registration]);
    const canvasEnv = useInspectorCanvasEnv(viewCtx, tpl, {forDataRepCollection: true});
    const renderCount = useCanvasRenderCount(viewCtx);

    const serverQueryModal = useServerQueryBottomModal(query.uuid);
    const openServerQueryModal = () => {
      // Pass viewCtx and tpl instead of a static env so the modal can reactively
      // compute the environment, including newly created data tokens
      serverQueryModal.open({
        value: query,
        onSave: handleCustomFunctionExprChange,
        onCancel: serverQueryModal.close,
        viewCtx,
        tpl,
        schema,
        exprCtx,
      });
    };

    const handleCustomFunctionExprChange = async (
      newOp: ServerQueryOp,
      opExprName?: string,
    ) => {
      await studioCtx.siteOps().updateComponentServerQuery(component, query, {
        op: newOp,
        name: opExprName,
      });
      serverQueryModal.close();
    };

    const menu = () => {
      return (
        <Menu>
          <Menu.Item onClick={() => openServerQueryModal()}>
            {<UiLabel text={CONFIGURE_ACTION} />}
          </Menu.Item>
          <Menu.Item
            onClick={() =>
              spawn(
                studioCtx.change(() => {
                  studioCtx
                    .tplMgr()
                    .duplicateComponentServerQuery(component, query);
                  return ok();
                }),
              )
            }
          >
            {<UiLabel text={DUPLICATE_ACTION} />}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            onClick={() =>
              studioCtx.siteOps().removeComponentServerQuery(component, query)
            }
          >
            {<UiLabel text={DELETE_ACTION} />}
          </Menu.Item>
        </Menu>
      );
    };
    const title = studioUiT('Query data results for "{part1}"', {
      part1: snapshot.name,
    });
    const env = React.useMemo(() => canvasEnv ? omitQueryFromEnv({...canvasEnv}, {name: snapshot.name}) : undefined,
      [canvasEnv, snapshot.name, renderCount]);
    const currGlobalThis = viewCtx.canvasCtx.win();

    return (
      <WithContextMenu overlay={menu}>
        <LabeledListItem
          uiId={mkModelUiId(query)}
          label={snapshot.name}
          menu={menu}
          onClick={() => openServerQueryModal()}
        >
          {op ? (
            <div className="flex flex-col fill-width">
              <ServerQueryOpSummary expr={op} />
              {isKnownCustomFunctionExpr(op) ? (
                <CustomFunctionExprPreview
                  expr={op}
                  env={env}
                  title={title}
                  exprCtx={exprCtx}
                  currGlobalThis={currGlobalThis}
                />
              ) : isKnownCustomCode(op) ? (
                <CustomCodePreview
                  queryUuid={query.uuid}
                  expr={op}
                  env={env}
                  title={title}
                />
              ) : null}
            </div>
          ) : (
            <div className="dimfg">
              <UiText message={"Click to configure..."} />
            </div>
          )}
        </LabeledListItem>
      </WithContextMenu>
    );
  });

function ServerQueriesSection_(props: {
  component: Component;
  viewCtx: ViewCtx;
}) {
  const { t: uiT } = useI18n();
  const { component, viewCtx } = props;
  const studioCtx = useStudioCtx();

  const {snapshot, source} = useServerQueryList(studioCtx, component, viewCtx);
  const componentType = uiT(snapshot.isPage ? "page" : "component");

  const handleAddBlankQuery = () => {
    spawn(
      studioCtx.change(() => {
        const serverQuery = new ComponentServerQuery({
          uuid: mkShortId(),
          name: studioCtx.tplMgr().getUniqueServerQueryName(component, "Query"),
          op: undefined,
        });

        component.serverQueries.push(serverQuery);
        return ok();
      }),
    );
  };

  const handleCopyFromQuery = (
    sourceComponent: Component,
    sourceQuery: ComponentServerQuery,
  ) => {
    spawn(
      studioCtx.change(() => {
        const { copied, componentVarRefs } = studioCtx
          .tplMgr()
          .copyServerQueryWithDependencies(
            component,
            sourceComponent,
            sourceQuery,
          );
        const names = copied.map((q) => q.name);
        const varLabels: Record<string, string> = {
          $state: "state",
          $props: "props",
          $ctx: "context",
        };
        const warnings = Object.keys(componentVarRefs).map(
          (varType) =>
            `${varLabels[varType] ?? varType} (${Array.from(
              componentVarRefs[varType],
            ).join(", ")})`,
        );
        notification.success({
          message: uiT(
            names.length === 1
              ? "Copied query: {names}"
              : "Copied queries: {names}",
            {
              names: names.join(", "),
            },
          ),
          description:
            warnings.length > 0
              ? uiT(
                  "References component {names} that may not exist or differ in this component.",
                  { names: warnings.join(", ") },
                )
              : undefined,
        });
        return ok();
      }),
    );
  };

  const otherComponentsWithQueries = snapshot.other;

  const addMenu = (onMenuClicked: () => void) => (
    <Menu>
      <Menu.Item
        key="new"
        onClick={() => {
          handleAddBlankQuery();
          onMenuClicked();
        }}
      >
        <UiText message={"New"} />
      </Menu.Item>
      {otherComponentsWithQueries.length > 0 && (
        <>
          <Menu.Divider />
          <Menu.SubMenu key="copy-from" title={uiT("Copy from...")}>
            {otherComponentsWithQueries.map((c) => (
              <Menu.SubMenu key={c.component.uid} title={c.label}>
                {c.queries.map((q) => (
                  <Menu.Item
                    key={q.query.uid}
                    // the minwidth ensures the innermost submenu popup is wide enough
                    // so it doesn't flip and overlap its parent menu
                    style={{ minWidth: 130 }}
                    onClick={() => {
                      handleCopyFromQuery(source.resolve(c.component), source.resolve(q.query));
                      onMenuClicked();
                    }}
                  >
                    {q.name}
                  </Menu.Item>
                ))}
              </Menu.SubMenu>
            ))}
          </Menu.SubMenu>
        </>
      )}
    </Menu>
  );

  return (
    <SidebarSection
      id="server-queries-section"
      title={
        <LabelWithDetailedTooltip tooltip={ServerQueriesTooltip}>
          {<UiLabel text={SERVER_QUERY_PLURAL_CAP} />}
        </LabelWithDetailedTooltip>
      }
      emptyBody={snapshot.queries.length === 0}
      emptyDescription={uiT("Fetch data from external sources.")}
      zeroBodyPadding
      controls={
        otherComponentsWithQueries.length > 0 ? (
          <IFrameAwareDropdownMenu menu={addMenu}>
            <Tooltip
              title={uiT("Add {part1} to {part2}", {
                part1: translateUiLabel(getUiLocale(), SERVER_QUERY_LOWER),
                part2: componentType,
              })}
            >
              <Button
                type="text"
                size="small"
                id="server-queries-add-btn"
                aria-label={uiT("Add data query")}
                icon={<Icon icon={PlusIcon} />}
              />
            </Tooltip>
          </IFrameAwareDropdownMenu>
        ) : (
          <Tooltip
            title={uiT("Add {part1} to {part2}", {
              part1: translateUiLabel(getUiLocale(), SERVER_QUERY_LOWER),
              part2: componentType,
            })}
          >
            <Button
              type="text"
              size="small"
              id="server-queries-add-btn"
              aria-label={uiT("Add data query")}
              onClick={handleAddBlankQuery}
              icon={<Icon icon={PlusIcon} />}
            />
          </Tooltip>
        )
      }
    >
      {snapshot.queries.map((queryRef) => (
        <ServerQueryRow
          key={queryRef.uid}
          component={component}
          viewCtx={viewCtx}
          query={source.resolve(queryRef)}
        />
      ))}
    </SidebarSection>
  );
}

export const ServerQueriesSection = React.memo(ServerQueriesSection_);
