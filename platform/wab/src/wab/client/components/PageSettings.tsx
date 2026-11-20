import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import { usePageSettingsModelInputs } from "@/wab/client/components/page-settings-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import ContextMenuIndicator from "@/wab/client/components/ContextMenuIndicator/ContextMenuIndicator";
import styles from "@/wab/client/components/PageSettings.module.css";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import {
  convertExprToPageMetaString,
  convertPageMetaStringToExpr,
} from "@/wab/client/components/sidebar-tabs/PageMetaPanel";
import {
  InnerPropEditorRow,
  PropValueEditorContext,
} from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { LegacyComponentParamsSection } from "@/wab/client/components/sidebar-tabs/legacy-component-params-section";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { ImageAssetPreviewAndPicker } from "@/wab/client/components/style-controls/ImageSelector";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { cx, nullToUndefined, spawn } from "@/wab/shared/common";
import { PageComponent } from "@/wab/shared/core/components";
import {
  ExprCtx,
  asCode,
  codeLit,
  createExprForDataPickerValue,
  extractValueSavedFromDataPicker,
  getLastDynExprFromTemplatedString,
  hasDynamicParts,
  isDynamicExpr,
  mkTemplatedStringOfOneDynExpr,
} from "@/wab/shared/core/exprs";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { tryEvalExpr } from "@/wab/shared/eval";
import {
  ImageAsset,
  ImageAssetRef,
  ObjectPath,
  TemplatedString,
  TplTag,
  isKnownExpr,
  isKnownImageAsset,
  isKnownImageAssetRef,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import { Collapse, Input, Menu, Typography } from "antd";
import * as React from "react";

interface PageSettingsProps {
  page: PageComponent;
  viewCtx?: ViewCtx;
  className?: string;
}

const ImageAssetPickerWithDynamicValue = React.memo(function ImageAssetPickerWithDynamicValue({
    page,
    viewCtx,
    exprCtx,
    pageMetaEnv,
  }: {
    page: PageComponent;
    viewCtx?: ViewCtx;
    exprCtx: ExprCtx;
    pageMetaEnv;
  }) {
    const sc = useStudioCtx();
    const metadataInputs = usePageSettingsModelInputs(sc, page);
    const functionsSchema = useCustomFunctionsSchema(sc);
    const pageMeta = metadataInputs.meta;

    const [isDataPickerVisible, setIsDataPickerVisible] = React.useState(false);

    const openGraphImage = pageMeta.openGraphImage;

    const imageValue = isKnownImageAssetRef(openGraphImage)
      ? openGraphImage.asset
      : openGraphImage;
    const isDynamic =
      isKnownTemplatedString(openGraphImage) && hasDynamicParts(openGraphImage);

    const evaluatedImage = React.useMemo(() => {
      if (isDynamic && isKnownExpr(openGraphImage) && pageMetaEnv) {
        const evaluated = tryEvalExpr(
          asCode(openGraphImage, exprCtx).code,
          pageMetaEnv,
        );
        return evaluated?.val;
      }
      return undefined;
    }, [isDynamic, openGraphImage, pageMetaEnv, exprCtx, metadataInputs]);

    const updateOpenGraphImage = (
      raw: TemplatedString | ImageAsset | string | null,
    ) => {
      const value =
        raw && isKnownImageAsset(raw) ? new ImageAssetRef({ asset: raw }) : raw;
      spawn(sc.tryChangePageMetaImage(page, value));
    };

    const switchToDynamicValue = () => {
      spawn(
        sc.changeUnsafe(() => {
          page.pageMeta.openGraphImage = mkTemplatedStringOfOneDynExpr(
            new ObjectPath({
              path: ["undefined"],
              fallback: codeLit(undefined),
            }),
          );
        }),
      );
      setIsDataPickerVisible(true);
    };

    const contextMenu = (
      <Menu>
        {openGraphImage && (
          <Menu.Item
            key={"remove"}
            onClick={() => {
              updateOpenGraphImage(null);
            }}
          >
            <UiText message={"Clear image"} />
          </Menu.Item>
        )}
        {!isDynamic && (
          <Menu.Item
            key={"openGraphImageDynamic"}
            onClick={switchToDynamicValue}
          >
            <UiText message={"Use dynamic value"} />
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <ContextMenuIndicator
        menu={contextMenu}
        showDynamicValueButton={!isDynamic}
        onIndicatorClickDefault={switchToDynamicValue}
        className="qb-custom-widget"
        fullWidth={true}
      >
        {isDynamic ? (
          <div className="flex-col">
            <DataPickerEditor
              viewCtx={viewCtx}
              value={extractValueSavedFromDataPicker(
                getLastDynExprFromTemplatedString(
                  openGraphImage as TemplatedString,
                ),
                exprCtx,
              )}
              onChange={(val) => {
                if (!val) {
                  return;
                }
                const dynExpr = createExprForDataPickerValue(val, undefined);
                const templatedString = mkTemplatedStringOfOneDynExpr(dynExpr);
                updateOpenGraphImage(templatedString);
              }}
              onUnlink={() => {
                updateOpenGraphImage(null);
              }}
              visible={isDataPickerVisible}
              setVisible={setIsDataPickerVisible}
              data={pageMetaEnv}
              schema={functionsSchema}
            />
            {evaluatedImage && (
              <ImageAssetPreviewAndPicker
                studioCtx={sc}
                type={ImageAssetType.Picture}
                value={
                  typeof evaluatedImage === "string"
                    ? evaluatedImage
                    : undefined
                }
                keepOpen={false}
                onPicked={(picked) => {
                  updateOpenGraphImage(picked);
                }}
              />
            )}
          </div>
        ) : (
          <ImageAssetPreviewAndPicker
            studioCtx={sc}
            type={ImageAssetType.Picture}
            value={nullToUndefined(
              !isDynamic &&
                (isKnownImageAsset(imageValue) ||
                  typeof imageValue === "string")
                ? imageValue
                : undefined,
            )}
            keepOpen={true}
            onPicked={(picked) => {
              updateOpenGraphImage(picked);
            }}
          />
        )}
      </ContextMenuIndicator>
    );
  });

const PageSettings = React.memo(function PageSettings(props: PageSettingsProps) {
  const studio = useStudioCtx();
  const world = useVariantModelWorld(studio, props.page);
  return world.alive ? <PageSettingsContent {...props} /> : null;
});
const PageSettingsContent = React.memo(function PageSettingsContent({
  page,
  viewCtx,
  className,
}: PageSettingsProps) {
  const { t: uiT } = useI18n();
  const sc = useStudioCtx();
  const metadataInputs = usePageSettingsModelInputs(sc, page);
  const functionsSchema = useCustomFunctionsSchema(sc);
  const exprCtx = React.useMemo<ExprCtx>(() => ({
    projectFlags: metadataInputs.projectFlags,
    component: page,
    inStudio: true,
  }), [metadataInputs.projectFlags, page]);
  const pageMeta = metadataInputs.meta;
  const routeId = React.useId();
  const [route, setRoute] = React.useState(pageMeta.path);
  React.useEffect(() => { setRoute(pageMeta.path); }, [page, pageMeta, pageMeta.path]);

  const title = React.useMemo(
    () => convertPageMetaStringToExpr(pageMeta.title),
    [pageMeta.title, metadataInputs],
  );
  const description = React.useMemo(
    () => convertPageMetaStringToExpr(pageMeta.description),
    [pageMeta.description, metadataInputs],
  );
  const canonical = React.useMemo(
    () => convertPageMetaStringToExpr(pageMeta.canonical),
    [pageMeta.canonical, metadataInputs],
  );

  const env = useInspectorCanvasEnv(viewCtx, metadataInputs.root);

  const pageMetaEnv = React.useMemo(() => {
    if (!env) {
      return undefined;
    }
    const { $queries, $$: _$, $state: _s, ...rest } = env;
    rest.$queries = {};
    for (const queryName of Object.keys($queries ?? {})) {
      if (metadataInputs.queryNames.includes(queryName)) {
        rest.$queries[queryName] = $queries[queryName];
      }
    }
    return rest;
  }, [env, page, metadataInputs]);

  const inspecting = React.useContext(InspectorReadOnly);
  const descriptionLength = React.useMemo(() => {
    const desc = pageMeta.description;
    if (typeof desc === "string") {
      return desc.length;
    } else if (viewCtx && pageMetaEnv && isDynamicExpr(desc)) {
      const evaluated = tryEvalExpr(asCode(desc, exprCtx).code, pageMetaEnv);
      return evaluated?.val?.toString()?.length ?? 0;
    }
    return 0;
  }, [pageMeta.description, pageMetaEnv, viewCtx, metadataInputs, exprCtx]);

  return (
    <div className={cx(styles.pageSettingsContainer, className)}>
      <PropValueEditorContext.Provider
        value={{
          componentPropValues: {},
          ccContextData: {},
          paramOwnerNames: [metadataInputs.name],
          tpl: metadataInputs.root as TplTag,
          viewCtx,
          env: pageMetaEnv,
          schema: functionsSchema,
        }}
      >
        <LabeledItemRow
          label={uiT("URL Path")}
          labelAriaProps={{ htmlFor: routeId }}
          layout="vertical"
          noMenuButton
        >
          {inspecting ? <span id={routeId}>{pageMeta.path}</span> : <Input
            id={routeId}
            placeholder="/some-route"
            value={route}
            onChange={(event) => setRoute(event.target.value)}
            onBlur={async () => {
              if (route !== pageMeta.path) {
                await sc.tryChangePath(page, route);
                setRoute(page.pageMeta.path);
              }
            }}
          />}
        </LabeledItemRow>
        <InnerPropEditorRow
          attr="title"
          label={uiT("Title")}
          layout="vertical"
          propType={{ type: "string", defaultValueHint: uiT("Title") }}
          expr={title}
          onChange={(expr) => {
            const newTitle = convertExprToPageMetaString(expr);
            spawn(sc.tryChangePageMeta(page, "title", newTitle));
          }}
          disableLinkToProp
        />
        <div className={styles.field}>
          <InnerPropEditorRow
            attr="description"
            label={uiT("Description")}
            layout="vertical"
            propType={{
              type: "string",
              control: "multiLine",
              defaultValueHint: uiT("Description"),
            }}
            expr={description}
            onChange={(expr) => {
              const newDesc = convertExprToPageMetaString(expr) ?? "";
              spawn(sc.tryChangePageMetaDescription(page, newDesc));
            }}
            disableLinkToProp
          />
          <Typography.Text type="secondary" className={styles.descriptionCount}>
            {uiT("{count} characters · 160 recommended", {
              count: descriptionLength,
            })}
          </Typography.Text>
        </div>
        <Collapse
          size="small"
          className={styles.sections}
          items={[
            {
              key: "sharing",
              label: uiT("Search and sharing"),
              children: (
                <div className={styles.sectionFields}>
                  <InnerPropEditorRow
                    attr="canonical"
                    label={uiT("Canonical URL")}
                    layout="vertical"
                    propType={{ type: "string", defaultValueHint: "https://" }}
                    expr={canonical}
                    onChange={(expr) => {
                      const newCanonical = convertExprToPageMetaString(expr);
                      spawn(sc.tryChangePageMeta(page, "canonical", newCanonical));
                    }}
                    disableLinkToProp
                  />
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      {uiT("Open Graph image")}
                    </div>
                    <Typography.Text
                      type="secondary"
                      className={styles.fieldHelp}
                    >
                      {uiT("(Recommended: 1200 x 630 pixels)")}
                    </Typography.Text>
                    <ImageAssetPickerWithDynamicValue
                      page={page}
                      viewCtx={viewCtx}
                      exprCtx={exprCtx}
                      pageMetaEnv={pageMetaEnv}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "advanced",
              label: uiT("Advanced settings"),
              children: (
                <LegacyComponentParamsSection studioCtx={sc} component={page} />
              ),
            },
          ]}
        />
      </PropValueEditorContext.Provider>
    </div>
  );
});
export default PageSettings;
