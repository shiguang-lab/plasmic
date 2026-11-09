import { usePropExpressionInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useElementPropInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/element-prop-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { useModelSelector, useModelRevisions } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { useShallow } from "zustand/react/shallow";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useCurrentAppUserToken } from "@/wab/client/studio-ctx/studio-mode-state";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import {
  DataSourceOpExprSummary,
  DataSourceOpValuePreview,
  useDataSourceOpExprBottomModal,
} from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { LinkButton } from "@/wab/client/components/widgets";
import {
  DataQueriesDeprecatedTooltip,
  DataQueriesTooltip,
} from "@/wab/client/components/widgets/DetailedTooltips";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { LabeledListItem } from "@/wab/client/components/widgets/LabeledListItem";
import { useDataSource } from "@/wab/client/contexts/AppContexts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  makeAllLegacyQueriesMigrationPrompt,
  makeLegacyQueryMigrationPrompt,
} from "@/wab/client/copilot/query-migration";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { translateUiLabel } from "@/wab/client/i18n/locales";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { SparklesSvgIcon } from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SparklesSvg";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  CONFIGURE_ACTION,
  DATA_QUERY_LOWER,
  DATA_QUERY_PLURAL_CAP,
  DELETE_ACTION,
} from "@/wab/shared/Labels";
import { addEmptyQuery } from "@/wab/shared/TplMgr";
import { flattenComponent, getTplComponentFetchers } from "@/wab/shared/cached-selectors";
import { toVarName } from "@/wab/shared/codegen/util";
import { arrayEq, spawn } from "@/wab/shared/common";
import { isPageComponent } from "@/wab/shared/core/components";
import { ExprCtx, asCode } from "@/wab/shared/core/exprs";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { checkLegacyQueryMigratable } from "@/wab/shared/data-sources-meta/legacy-query-migration";
import {
  Component,
  ComponentDataQuery,
  DataSourceOpExpr,
  TplComponent,
  isKnownDataSourceOpExpr,
  isKnownTplComponent,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import {
  findLegacyQueriesReadByOp,
  findQueryInvalidationRefs,
  renameQueryAndFixExprs,
} from "@/wab/shared/refactoring";
import { PlasmicDataSourceContextProvider } from "@plasmicapp/react-web";
import { Button, Menu, Tooltip } from "antd";
import { ok } from "neverthrow";
import React from "react";
import { useStore } from "zustand";

// Opens Chat Copilot and sends the migration prompt right away.
function startQueryMigrationChat(studioCtx: StudioCtx, prompt: string) {
  studioCtx.openCopilotChat({ prompt, mode: "query-migration" });
}

function useQueryMigrationEnabled(studio: StudioCtx) {
  const canEdit = useStore(studio.uiEnvironment.store, (state) => state.canEditProject);
  const subscribe = React.useCallback((listener: () => void) => studio.appCtx.subscribeUiEnvironmentInputs(listener), [studio]);
  const enabled = React.useSyncExternalStore(subscribe, () => !!studio.appCtx.appConfig.enableQueryMigrationCopilot, () => !!studio.appCtx.appConfig.enableQueryMigrationCopilot);
  return canEdit && enabled;
}
const DataQueryRow = React.memo(function DataQueryRow(props: React.ComponentProps<typeof DataQueryRowContent>) {
  const world = useVariantModelWorld(props.viewCtx.studioCtx, props.query, props.viewCtx);
  return world.alive ? <DataQueryRowContent {...props} /> : null;
});
const DataQueryRowContent = React.memo(
  ({
    query,
    viewCtx,
    component,
    isDeprecated,
  }: {
    component: Component;
    query: ComponentDataQuery;
    viewCtx: ViewCtx;
    isDeprecated: boolean;
  }) => {
  useViewSelection(viewCtx, (state) => state.context);
    const { t: uiT } = useI18n();

    const studioCtx = viewCtx.studioCtx;
    const world = useVariantModelWorld(studioCtx, query, viewCtx);
    usePropExpressionInputs(studioCtx, query, query, component);
    usePropExpressionInputs(studioCtx, component, component.dataQueries, component);
    const migrationEnabled = useQueryMigrationEnabled(studioCtx);
    const isNewlyAdded = useStore(studioCtx.newlyAddedQueryStore, (ref) => ref?.uid === query.uid);
    const userAuthToken = useCurrentAppUserToken(studioCtx);
    const showMigrateItem =
      isDeprecated && migrationEnabled;
    // The integration is only needed for the migrate menu item; don't fetch
    // (and on 403, retry) it otherwise.
    const {
      data: dataSource,
      error: dataSourceError,
      isLoading: isLoadingDataSource,
    } = useDataSource(showMigrateItem ? query.op?.sourceId : undefined);
    useModelRevisions(studioCtx.modelRevisions, showMigrateItem ? [modelKeys.site] : []);
    const invalidationRefCount = showMigrateItem
      ? findQueryInvalidationRefs(studioCtx.site).filter(
          ({ ref }) => ref === query,
        ).length
      : 0;
    const migration = checkLegacyQueryMigratable(
      query.op,
      dataSource,
      invalidationRefCount,
      showMigrateItem
        ? findLegacyQueriesReadByOp(query, component.dataQueries).map(
            (q) => q.name,
          )
        : [],
      dataSourceError,
    );
    const canMigrate = !isLoadingDataSource && migration.migratable;
    const exprCtx: ExprCtx = {
      projectFlags: studioCtx.projectFlags(),
      component,
      inStudio: true,
    };

    const handleDataSourceOpChange = async (
      newOp: DataSourceOpExpr,
      opExprName?: string,
    ) => {
      if (!world.isCurrent()) { return; }
      await studioCtx.change(() => {
        if (!world.isCurrent()) { return ok(); }
        query.op = newOp;
        if (opExprName && opExprName !== query.name) {
          renameQueryAndFixExprs(component, query, opExprName);
        }
        return ok();
      });
      if (world.isCurrent()) { dataSourceModal.close(); }
    };

    const dataSourceModal = useDataSourceOpExprBottomModal(query.uuid);
    const openDataSourceModal = () => {
      if (!world.isCurrent()) { return; }
      dataSourceModal.open({
        parent: query,
        value: query.op ?? undefined,
        onSave: handleDataSourceOpChange,
        onCancel: () => { if (world.isCurrent()) { dataSourceModal.close(); } },
        env,
        schema,
        readOpsOnly: true,
        exprCtx,
      });
    };

    const menu = () => {
      return (
        <Menu>
          <Menu.Item onClick={() => openDataSourceModal()}>
            {<UiLabel text={CONFIGURE_ACTION} />}
          </Menu.Item>
          {showMigrateItem && (
            <Menu.Item
              disabled={!canMigrate}
              title={
                isLoadingDataSource
                  ? undefined
                  : [...migration.blockers, ...migration.warnings].join(" ")
              }
              onClick={() => { if (world.isCurrent()) { startQueryMigrationChat(studioCtx, makeLegacyQueryMigrationPrompt(component, query)); } }}
            >
              <span className="inline-flex flex-vcenter gap-xsm">
                <SparklesSvgIcon />
                <UiText message={"Migrate"} />
              </span>
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            onClick={() => {
              if (!world.isCurrent()) { return; }
              return studioCtx.siteOps().removeComponentQuery(component, query);
            }}
          >
            {<UiLabel text={DELETE_ACTION} />}
          </Menu.Item>
        </Menu>
      );
    };

    // For some reason calling `omit` tries to read from the query data,
    // throwing `PlasmicUndefinedDataError`
    const currentRoot = viewCtx.currentCtxTplRoot();
    const canvasEnv = useInspectorCanvasEnv(viewCtx, currentRoot, { forDataRepCollection: true });
    const env = { ...canvasEnv };
    if (env.$queries) {
      env.$queries = { ...env.$queries };
      delete env.$queries[toVarName(query.name)];
    }
    const schema = useCustomFunctionsSchema(viewCtx.studioCtx);

    React.useEffect(() => {
      if (world.isCurrent() && studioCtx.newlyAddedQuery === query) {
        studioCtx.setNewlyAddedQuery(undefined);
        openDataSourceModal();
      }
    }, [studioCtx, query, isNewlyAdded, openDataSourceModal]);

    return (
      <WithContextMenu overlay={menu}>
        <LabeledListItem
          uiId={mkModelUiId(query)}
          label={query.name}
          menu={menu}
          onClick={() => openDataSourceModal()}
        >
          {query.op ? (
            <div className="flex flex-col fill-width">
              <PlasmicDataSourceContextProvider
                value={{
                  userAuthToken,
                }}
              >
                <DataSourceOpExprSummary expr={query.op} />
                <DataSourceOpValuePreview
                  expr={query.op}
                  env={env}
                  title={uiT('Query data results for "{part1}"', {
                    part1: query.name,
                  })}
                  exprCtx={exprCtx}
                />
              </PlasmicDataSourceContextProvider>
            </div>
          ) : (
            <div className="dimfg">
              <UiText message={"Click to configure..."} />
            </div>
          )}
        </LabeledListItem>
      </WithContextMenu>
    );
  },
);

function ComponentQueriesSection_(props: {
  component: Component;
  viewCtx: ViewCtx;
  isDeprecated: boolean;
}) {
  const { t: uiT } = useI18n();

  const { component, viewCtx, isDeprecated } = props;
  const studioCtx = useStudioCtx();

  const world = useVariantModelWorld(studioCtx, component, viewCtx);
  usePropExpressionInputs(studioCtx, component, component.dataQueries, component);
  const queryRefs = useStore(studioCtx.modelSnapshots.field(component, "dataQueries"));
  const queries = queryRefs.map((ref) => studioCtx.modelSnapshots.resolve(ref));
  useStore(studioCtx.modelSnapshots.field(component, "type"));
  const migrationEnabled = useQueryMigrationEnabled(studioCtx);
  // Fetchers are found by scanning this component's whole document structure.
  const nodes = flattenComponent(component);
  const tplFetchers = useModelSelector(studioCtx.modelRevisions, [modelKeys.component(component.uuid), ...nodes.filter(isKnownTplComponent).map((tpl) => modelKeys.component(tpl.component.uuid))], () => getTplComponentFetchers(component), arrayEq);

  const componentType = uiT(isPageComponent(component) ? "page" : "component");

  const showMigrate =
    isDeprecated &&
    migrationEnabled &&
    queries.length > 0;

  const handleAddDataQuery = () => {
    spawn(
      studioCtx.change(() => {
        if (!world.isCurrent()) { return ok(); }
        const query = addEmptyQuery(component);
        studioCtx.setNewlyAddedQuery(query);
        return ok();
      }),
    );
  };

  const handleMigrateAll = () => { if (world.isCurrent()) { startQueryMigrationChat(studioCtx, makeAllLegacyQueriesMigrationPrompt(component, component.dataQueries)); } };

  return (
    <SidebarSection
      id="data-queries-section"
      title={
        <LabelWithDetailedTooltip
          tooltip={
            isDeprecated ? (
              <DataQueriesDeprecatedTooltip showMigrate={showMigrate} />
            ) : (
              DataQueriesTooltip
            )
          }
        >
          {<UiLabel text={DATA_QUERY_PLURAL_CAP} />}
          {isDeprecated ? " " + uiT("(legacy)") : ""}
        </LabelWithDetailedTooltip>
      }
      emptyBody={queries.length === 0 && tplFetchers.length === 0}
      emptyDescription={uiT("Fetch data from an integration.")}
      zeroBodyPadding
      controls={
        <div className="inline-flex flex-vcenter gap-m">
          {showMigrate && (
            <LinkButton
              className="inline-flex flex-vcenter gap-xsm"
              onClick={handleMigrateAll}
            >
              <SparklesSvgIcon />
              <UiText message={"Migrate all"} />
            </LinkButton>
          )}
          <Tooltip
            title={uiT("Add {part1} to {part2}", {
              part1: translateUiLabel(getUiLocale(), DATA_QUERY_LOWER),
              part2: componentType,
            })}
          >
            <Button
              type="text"
              size="small"
              id="data-queries-add-btn"
              aria-label={uiT("Add {part1} to {part2}", {
                part1: translateUiLabel(getUiLocale(), DATA_QUERY_LOWER),
                part2: componentType,
              })}
              onClick={handleAddDataQuery}
              icon={<Icon icon={PlusIcon} />}
            />
          </Tooltip>
        </div>
      }
    >
      {queries.map((query) => (
        <DataQueryRow
          key={query.uid}
          component={component}
          query={query}
          viewCtx={viewCtx}
          isDeprecated={isDeprecated}
        />
      ))}
      {tplFetchers.map((tpl) => {
        return <TplFetcherRow tpl={tpl} viewCtx={viewCtx} />;
      })}
    </SidebarSection>
  );
}

const TplFetcherRow = React.memo(function TplFetcherRow(props: React.ComponentProps<typeof TplFetcherRowContent>) {
  const world = useVariantModelWorld(props.viewCtx.studioCtx, props.tpl, props.viewCtx);
  return world.alive ? <TplFetcherRowContent {...props} /> : null;
});
const TplFetcherRowContent = React.memo(function TplFetcherRow_(props: {
  tpl: TplComponent;
  viewCtx: ViewCtx;
}) {
  const { t: uiT } = useI18n();

  const { tpl, viewCtx } = props;
  const world = useVariantModelWorld(viewCtx.studioCtx, tpl, viewCtx);
  useElementPropInputs(viewCtx, tpl);
  useViewSelection(viewCtx, (state) => state.context);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const component = tryGetTplOwnerComponent(tpl) ?? null;
  const exprCtx: ExprCtx = {
    projectFlags: viewCtx.projectFlags(),
    component,
    inStudio: true,
  };

  const effectiveVs = viewCtx.variantTplMgr().effectiveVariantSetting(tpl);

  const nameExpr = effectiveVs.args.find(
    (arg) => arg.param.variable.name === "name",
  )?.expr;

  const name = !nameExpr
    ? uiT("Unnamed query")
    : isKnownTemplatedString(nameExpr)
      ? asCode(nameExpr, exprCtx).code.slice(1, -1)
      : JSON.parse(asCode(nameExpr, exprCtx).code);

  const dataOpExpr = effectiveVs.args.find(
    (arg) => arg.param.variable.name === "dataOp",
  )?.expr;

  const env = useInspectorCanvasEnv(viewCtx, tpl);

  return (
    <LabeledListItem
      label={name}
      subtitle={<UiText message="Fetcher" />}
      withSubtitle
      onClick={() => {
        if (!world.isCurrent()) { return; }
        viewCtx.setStudioFocusByTpl(tpl);
        viewCtx.studioCtx.switchRightTab(RightTabKey.style);
      }}
    >
      {isKnownDataSourceOpExpr(dataOpExpr) ? (
        env ? (
          <div className="flex flex-col fill-width">
            <DataSourceOpExprSummary expr={dataOpExpr} />
            <DataSourceOpValuePreview
              expr={dataOpExpr}
              env={env}
              title={uiT('Query data results for fetcher "{part1}"', {
                part1: name,
              })}
              exprCtx={exprCtx}
            />
          </div>
        ) : (
          <div className="dimfg">
            <UiText message={"Not visible"} />
          </div>
        )
      ) : (
        <div className="dimfg">
          <UiText message={"Click to configure..."} />
        </div>
      )}
    </LabeledListItem>
  );
});

const ComponentDataQueriesSectionContent = React.memo(ComponentQueriesSection_);
export const ComponentDataQueriesSection = React.memo(function ComponentDataQueriesSection(props: Parameters<typeof ComponentQueriesSection_>[0]) {
  const studio = useStudioCtx(), world = useVariantModelWorld(studio, props.component, props.viewCtx);
  return world.alive ? <ComponentDataQueriesSectionContent {...props} /> : null;
});
