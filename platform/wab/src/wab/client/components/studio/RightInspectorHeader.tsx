import { COMMANDS } from "@/wab/client/commands/command";
import { MenuBuilder, TextAndShortcut } from "@/wab/client/components/menu-builder";
import { canRenderPrivateStyleVariants } from "@/wab/client/components/sidebar-tabs/Sections";
import {
  readVisibility,
  useVisibilityController,
} from "@/wab/client/components/sidebar-tabs/VisibilitySection";
import { createNodeIcon } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { SimpleTextbox } from "@/wab/client/components/widgets/SimpleTextbox";
import { useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import SlotIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Slot";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import ArrowUpRightsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ArrowUpRightSvg";
import ChevronDownsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import EyeOffsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__EyeOffSvg";
import EyesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__EyeSvg";
import InformationSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__InformationSvg";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useTargetedStylePanelValue } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { PRIVATE_STYLE_VARIANTS_CAP, VARIANTS_CAP } from "@/wab/shared/Labels";
import {
  findOrCreatePrivateStyleVariant,
  isBaseVariant,
  isPrivateStyleVariant,
  makeVariantName,
} from "@/wab/shared/Variants";
import {
  getComponentDisplayName,
  isCodeComponent,
  isFrameComponent,
  isPageComponent,
} from "@/wab/shared/core/components";
import { getApplicableSelectors } from "@/wab/shared/core/styles";
import {
  canToggleVisibility,
  isTplComponent,
  isTplSlot,
  isTplTag,
  summarizeUnnamedTpl,
} from "@/wab/shared/core/tpls";
import {
  Component,
  TplNode,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { getPlumeEditorPlugin } from "@/wab/shared/plume/plume-registry";
import { TplVisibility } from "@/wab/shared/visibility-utils";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { Button, Dropdown, Menu, Popover, Tooltip } from "antd";
import cx from "classnames";
import { ok } from "neverthrow";
import React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const FALLBACK_PERMISSIONS_STORE = createStore(() => ({
  componentSectionPermissions: {} as Record<string, boolean>,
}));

interface HeaderSubtitleMeta {
  componentLabel?: string;
  description?: string;
}

function getHeaderSubtitleMeta(
  tpl: TplNode | undefined,
  focusedComponent: Component | undefined,
  componentMode: boolean,
): HeaderSubtitleMeta {
  if (!componentMode && tpl) {
    if (isTplComponent(tpl)) {
      return {
        componentLabel: getComponentDisplayName(tpl.component),
        description:
          tpl.component.codeComponentMeta?.description ||
          getPlumeEditorPlugin(tpl.component)?.componentMeta.description ||
          undefined,
      };
    }
    if (isTplSlot(tpl)) {
      return {
        description: tpl.param.about || undefined,
      };
    }
    return {};
  }
  if (focusedComponent) {
    const plumePlugin = getPlumeEditorPlugin(focusedComponent);
    if (plumePlugin) {
      return {
        componentLabel: `${plumePlugin.componentMeta.name} Component`,
        description: plumePlugin.componentMeta.description || undefined,
      };
    }
    if (
      isCodeComponent(focusedComponent) &&
      focusedComponent.codeComponentMeta?.description
    ) {
      return {
        componentLabel: getComponentDisplayName(focusedComponent),
        description: focusedComponent.codeComponentMeta.description,
      };
    }
  }
  return {};
}

const ElementVisibilityQuickToggle = React.memo(
  function ElementVisibilityQuickToggle(props: {
    tpl: TplNode;
    viewCtx: ViewCtx;
  }) {
    const { tpl, viewCtx } = props;
    const { t: uiT } = useI18n();
    const expsProvider = React.useMemo(
      () => new TplExpsProvider(viewCtx, tpl),
      [viewCtx, tpl],
    );
    const select = React.useCallback(
      () => readVisibility(viewCtx, tpl, expsProvider),
      [viewCtx, tpl, expsProvider],
    );
    const source = useTargetedStylePanelValue(
      viewCtx.studioCtx,
      { kind: "visibility", view: viewCtx, tpl },
      select,
    );
    if (!source.active || !source.value) {
      return null;
    }
    return (
      <ElementVisibilityButton
        tpl={tpl}
        viewCtx={viewCtx}
        expsProvider={expsProvider}
        visibilityInput={source.value}
        label={uiT("Toggle visibility")}
      />
    );
  },
);

const ElementVisibilityButton = React.memo(function ElementVisibilityButton(props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
  expsProvider: TplExpsProvider;
  visibilityInput: ReturnType<typeof readVisibility>;
  label: string;
}) {
  const { tpl, viewCtx, expsProvider, visibilityInput, label } = props;
  const controller = useVisibilityController({
    tpl,
    viewCtx,
    expsProvider,
    visibilityInput,
  });
  const isHidden =
    controller.currentVisibility === TplVisibility.DisplayNone ||
    controller.currentVisibility === TplVisibility.NotRendered;
  const isOverridden =
    controller.visibilityDefinedIndicator.source === "set";
  const tooltip = controller.isDisabled
    ? typeof controller.disabledTooltip === "function"
      ? controller.disabledTooltip()
      : controller.disabledTooltip
    : label;

  return (
    <Tooltip title={tooltip}>
      <Button
        type="text"
        size="small"
        data-test-id="inspector-visibility-toggle"
        aria-label={label}
        aria-pressed={isHidden}
        disabled={controller.isDisabled}
        className={cx("editor-panel-header__icon-btn", {
          "editor-panel-header__icon-btn--active": isHidden || isOverridden,
        })}
        icon={<Icon icon={isHidden ? EyeOffsvgIcon : EyesvgIcon} />}
        onClick={controller.toggleQuickVisibility}
      />
    </Tooltip>
  );
});

const selectVariantFrames = (variantState: { frames: unknown }) =>
  variantState.frames;
const selectVariantGlobal = (variantState: { global: unknown }) =>
  variantState.global;

const VariantStateSwitcher = React.memo(function VariantStateSwitcher(props: {
  studioCtx: StudioCtx;
  viewCtx: ViewCtx;
  tpl: TplNode;
}) {
  const { studioCtx, viewCtx, tpl } = props;
  const { t: uiT } = useI18n();
  // Thread the variant snapshots directly into controller creation so React
  // Compiler tracks them as dependencies of `targetedVariants` and `activeLabel`.
  const variantFrames = useViewVariants(viewCtx, selectVariantFrames);
  const variantGlobal = useViewVariants(viewCtx, selectVariantGlobal);
  const component = viewCtx.currentTplComponent().component;
  const variantsSnapshot = useStore(
    studioCtx.modelSnapshots.field(component, "variants"),
  );
  const availableVariants = variantsSnapshot.map((ref) =>
    studioCtx.modelSnapshots.resolve(ref),
  );

  const vcontroller =
    variantFrames !== undefined && variantGlobal !== undefined
      ? makeVariantsController(studioCtx, viewCtx)
      : undefined;
  if (!vcontroller) {
    return null;
  }

  const targetedVariants = vcontroller
    .getTargetedVariants()
    .filter((v) => !isBaseVariant(v));
  const isRecordingNonBase = targetedVariants.length > 0;
  const activeLabel = isRecordingNonBase
    ? targetedVariants
        .map((variant) =>
          makeVariantName({
            variant,
            focusedTag: isTplTag(tpl) ? tpl : undefined,
            site: studioCtx.site,
          }),
        )
        .join(" + ")
    : uiT("Base");

  const componentVariants = availableVariants.filter(
    (v) => !isBaseVariant(v) && !isPrivateStyleVariant(v),
  );
  const canShowElementStates =
    isTplTag(tpl) && canRenderPrivateStyleVariants(tpl, viewCtx);
  const privateVariants = availableVariants
    .filter(isPrivateStyleVariant)
    .filter((v) => v.forTpl === tpl);
  const applicableSelectors = isKnownTplTag(tpl)
    ? getApplicableSelectors(tpl.tag, true, tpl === component.tplTree).filter(
        (s) => !s.displayName.toLowerCase().startsWith("not "),
      )
    : [];

  const hasStateChoices =
    isRecordingNonBase ||
    componentVariants.length > 0 ||
    (canShowElementStates &&
      (privateVariants.length > 0 || applicableSelectors.length > 0));

  if (!hasStateChoices) {
    return (
      <span
        className="editor-panel-state-pill editor-panel-state-pill--static"
        data-test-id="inspector-state-label"
      >
        <span className="editor-panel-state-dot" />
        <span className="editor-panel-state-label">{activeLabel}</span>
      </span>
    );
  }

  const buildMenu = () => {
    const builder = new MenuBuilder();
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item
          key="base"
          onClick={() =>
            studioCtx.changeUnsafe(() => {
              vcontroller.onClearVariants();
            })
          }
        >
          <span className={cx({ "text-set strong": !isRecordingNonBase })}>
            {uiT("Base")}
          </span>
        </Menu.Item>,
      );
    });

    if (componentVariants.length > 0) {
      builder.genSection(<UiLabel text={VARIANTS_CAP} />, (push) => {
        for (const variant of componentVariants) {
          const targeted = targetedVariants.includes(variant);
          push(
            <Menu.Item
              key={variant.uuid}
              onClick={() =>
                studioCtx.changeUnsafe(() => {
                  vcontroller.onClickVariant(variant);
                })
              }
            >
              <span className={cx({ "text-set strong": targeted })}>
                {makeVariantName({ variant, site: studioCtx.site })}
              </span>
            </Menu.Item>,
          );
        }
      });
    }

    if (canShowElementStates) {
      builder.genSection(<UiLabel text={PRIVATE_STYLE_VARIANTS_CAP} />, (push) => {
        for (const variant of privateVariants) {
          const targeted = targetedVariants.includes(variant);
          push(
            <Menu.Item
              key={variant.uuid}
              onClick={() =>
                studioCtx.changeUnsafe(() => {
                  vcontroller.onClickVariant(variant);
                })
              }
            >
              <span className={cx({ "text-set strong": targeted })}>
                {makeVariantName({
                  variant,
                  focusedTag: isTplTag(tpl) ? tpl : undefined,
                  site: studioCtx.site,
                })}
              </span>
            </Menu.Item>,
          );
        }
        const existingSelectors = new Set(
          privateVariants.flatMap((v) => v.selectors ?? []),
        );
        for (const selector of applicableSelectors) {
          if (existingSelectors.has(selector.cssSelector)) {
            continue;
          }
          push(
            <Menu.Item
              key={`selector:${selector.cssSelector}`}
              onClick={() =>
                studioCtx.changeUnsafe(() => {
                  const variant = findOrCreatePrivateStyleVariant(
                    component,
                    tpl,
                    selector.cssSelector,
                    (selectors) =>
                      studioCtx
                        .tplMgr()
                        .createPrivateStyleVariant(component, tpl, selectors),
                  );
                  vcontroller.onClickVariant(variant);
                })
              }
            >
              {selector.displayName}
            </Menu.Item>,
          );
        }
      });
    }

    return builder.build({ menuName: "variant-state-switcher" });
  };

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      popupRender={buildMenu}
    >
      <Button
        size="small"
        type="text"
        data-test-id="inspector-state-switcher"
        aria-label={activeLabel}
        className={cx("editor-panel-state-pill", {
          "editor-panel-state-pill--recording": isRecordingNonBase,
        })}
      >
        <span
          className={cx("editor-panel-state-dot", {
            "editor-panel-state-dot--recording": isRecordingNonBase,
          })}
        />
        <span className="editor-panel-state-label">{activeLabel}</span>
        <Icon icon={ChevronDownsvgIcon} size={14} />
      </Button>
    </Dropdown>
  );
});

const SINGLE_LINE_MARKDOWN_COMPONENTS = {
  p: "span",
  h1: "span",
  h2: "span",
  h3: "span",
  h4: "span",
  h5: "span",
  h6: "span",
  blockquote: "span",
  ul: "span",
  ol: "span",
  li: "span",
  pre: "span",
  br: () => <> </>,
} as const;

const ReadOnlyDescriptionStrip = React.memo(
  function ReadOnlyDescriptionStrip(props: {
    componentLabel?: string;
    description?: string;
  }) {
    const { componentLabel, description } = props;
    const { t: uiT } = useI18n();
    if (!componentLabel && !description) {
      return null;
    }

    if (componentLabel) {
      const labelEl = (
        <span
          className="editor-panel-subtitle-name"
          data-test-id="inspector-component-subtitle"
        >
          {componentLabel}
        </span>
      );
      if (!description) {
        return <div className="editor-panel-subtitle-group">{labelEl}</div>;
      }
      return (
        <Popover
          trigger={["hover", "click"]}
          placement="bottomLeft"
          content={
            <div style={{ maxWidth: 280 }}>
              <StandardMarkdown>{description}</StandardMarkdown>
            </div>
          }
        >
          <div className="editor-panel-subtitle-group editor-panel-subtitle-group--interactive">
            {labelEl}
            <button
              type="button"
              className="editor-panel-subtitle-info-btn"
              data-test-id="inspector-readonly-description"
              aria-label={uiT("Description")}
            >
              <Icon icon={InformationSvgIcon} />
            </button>
          </div>
        </Popover>
      );
    }

    const singleLineDescription = description!.replace(/\s*\n+\s*/g, " ").trim();
    return (
      <Popover
        trigger={["hover", "click"]}
        placement="bottomLeft"
        content={
          <div style={{ maxWidth: 280 }}>
            <StandardMarkdown>{description}</StandardMarkdown>
          </div>
        }
      >
        <div
          className="editor-panel-description"
          data-test-id="inspector-readonly-description"
        >
          <StandardMarkdown
            className="editor-panel-description__content"
            components={SINGLE_LINE_MARKDOWN_COMPONENTS}
          >
            {singleLineDescription}
          </StandardMarkdown>
        </div>
      </Popover>
    );
  },
);

export const RightInspectorHeader = React.memo(function RightInspectorHeader(props: {
  studioCtx: StudioCtx;
  focusedViewCtx: ViewCtx | undefined;
  selectedTpl: TplNode | undefined;
  focusedComponent: Component | undefined;
  isMultiSelection: boolean;
  isFrameSelection: boolean;
  selectionCount: number;
  inspectorTitle?: string;
  partDisplayName?: string;
  rightTabKey?: RightTabKey;
  contentOnly: boolean;
  onOpenComponentSettings?: () => void;
}) {
  const {
    studioCtx,
    focusedViewCtx,
    selectedTpl,
    focusedComponent,
    isMultiSelection,
    isFrameSelection,
    selectionCount,
    inspectorTitle = "",
    partDisplayName,
    rightTabKey,
    contentOnly,
    onOpenComponentSettings,
  } = props;
  const { t: uiT } = useI18n();

  const permissions = useStore(
    studioCtx.uiEnvironment?.store ?? FALLBACK_PERMISSIONS_STORE,
    (state) => state.componentSectionPermissions,
  );
  const componentNameStore = React.useMemo(
    () =>
      focusedComponent && studioCtx.modelSnapshots
        ? studioCtx.modelSnapshots.field(focusedComponent, "name")
        : createStore(() => ""),
    [focusedComponent, studioCtx.modelSnapshots],
  );
  const componentName = useStore(componentNameStore);
  const tplNameStore = React.useMemo(() => {
    if (!selectedTpl || !studioCtx.modelSnapshots) {
      return createStore(() => "");
    }
    if (isTplSlot(selectedTpl)) {
      return createStore(() => selectedTpl.param.variable.name);
    }
    return studioCtx.modelSnapshots.field(selectedTpl, "name");
  }, [selectedTpl, studioCtx.modelSnapshots]);
  const tplName = useStore(tplNameStore);

  if (isMultiSelection) {
    return (
      <div className="editor-inspector-header">
        <div className="editor-panel-header">
          <strong className="editor-panel-title">
            <UiText
              message={
                isFrameSelection
                  ? "{count} artboards selected"
                  : "{count} layers selected"
              }
              values={{ count: selectionCount }}
            />
          </strong>
          <PanelCloseButton onClick={() => studioCtx.collapseRightPanel()} />
        </div>
      </div>
    );
  }

  const isDataTab = rightTabKey === RightTabKey.component;
  const showElementHeader =
    !isDataTab &&
    !!focusedViewCtx &&
    !!selectedTpl &&
    (!focusedComponent || !isFrameComponent(focusedComponent));

  if (!showElementHeader) {
    const isPage = focusedComponent ? isPageComponent(focusedComponent) : false;
    const isRealComponent =
      !!focusedComponent && !isPage && !isFrameComponent(focusedComponent);
    const canShowSettings =
      (isPage && permissions[PublicStyleSection.PageMeta]) ||
      (isRealComponent &&
        permissions[PublicStyleSection.ComponentProps] &&
        !!onOpenComponentSettings);
    const { componentLabel, description } = getHeaderSubtitleMeta(
      undefined,
      focusedComponent,
      true,
    );

    const openSettings = () => {
      if (isPage && focusedComponent && isPageComponent(focusedComponent)) {
        studioCtx.changeUnsafe(() => {
          studioCtx.pageSettingsPage = focusedComponent;
          studioCtx.pageSettingsOpen = true;
        });
      } else {
        onOpenComponentSettings?.();
      }
    };

    return (
      <div className="editor-inspector-header">
        <div className="editor-panel-header">
          {focusedComponent && (isPage || isRealComponent) ? (
            <div className="editor-panel-header__title-group">
              <span className="editor-inspector-node-icon component-fg">
                <Icon icon={isPage ? PageIcon : ComponentIcon} />
              </span>
              <SimpleTextbox
                key={focusedComponent.uuid}
                defaultValue={componentName || ""}
                onValueChange={(nextName) => {
                  studioCtx.changeUnsafe(() => {
                    studioCtx.siteOps().tryRenameComponent(
                      focusedComponent,
                      nextName,
                    );
                  });
                }}
                placeholder={uiT(isPage ? "(unnamed page)" : "(unnamed component)")}
                fontSize="xlarge"
                fontStyle="bold"
                className="flex-fill"
                data-test-class="simple-text-box"
              />
            </div>
          ) : (
            <strong className="editor-panel-title" title={inspectorTitle}>
              {inspectorTitle}
            </strong>
          )}
          <div className="editor-panel-header__actions">
            {canShowSettings && (
              <>
                <Tooltip title={uiT(isPage ? "Page settings" : "Component settings")}>
                  <Button
                    type="text"
                    size="small"
                    data-test-id={isPage ? "page-settings-button" : "component-settings-button"}
                    aria-label={uiT(isPage ? "Page settings" : "Component settings")}
                    className="editor-panel-header__icon-btn"
                    icon={<Icon icon={GearIcon} />}
                    onClick={openSettings}
                  />
                </Tooltip>
                <span className="editor-panel-header__divider" />
              </>
            )}
            <PanelCloseButton onClick={() => studioCtx.collapseRightPanel()} />
          </div>
        </div>
        {(componentLabel || description) && (
          <div className="editor-panel-subheader">
            <ReadOnlyDescriptionStrip
              componentLabel={componentLabel}
              description={description}
            />
          </div>
        )}
      </div>
    );
  }

  const tpl = selectedTpl;
  const viewCtx = focusedViewCtx;
  const effective = viewCtx.variantTplMgr().effectiveVariantSetting(tpl);
  const currentValue = isTplSlot(tpl)
    ? tpl.param.variable.name
    : tplName ?? "";
  const placeholder = isTplSlot(tpl)
    ? uiT("(unnamed slot)")
    : summarizeUnnamedTpl(tpl, effective.rsh());
  const nodeIcon = isTplComponent(tpl) ? (
    <span className="editor-inspector-node-icon component-fg">
      <Icon icon={ComponentIcon} />
    </span>
  ) : isTplSlot(tpl) ? (
    <span className="editor-inspector-node-icon component-fg">
      <Icon icon={SlotIcon} />
    </span>
  ) : (
    <span className="editor-inspector-node-icon tag-fg">
      {createNodeIcon(tpl, effective)}
    </span>
  );

  const canShowVisibilityToggle =
    !contentOnly && !partDisplayName && canToggleVisibility(tpl, viewCtx);

  const { componentLabel, description } = getHeaderSubtitleMeta(
    tpl,
    focusedComponent,
    false,
  );
  const canGoToComponent =
    isTplComponent(tpl) &&
    viewCtx.tplMgr().isOwnedBySite(tpl.component) &&
    !isCodeComponent(tpl.component) &&
    studioCtx.canEditComponent(tpl.component);
  const canExtractComponent =
    !contentOnly &&
    !isTplComponent(tpl) &&
    viewCtx.tplMgr().canExtractComponent(tpl);
  const showStateSwitcher = !contentOnly;
  const showSubheader =
    Boolean(componentLabel) ||
    Boolean(description) ||
    canGoToComponent ||
    canExtractComponent ||
    showStateSwitcher;

  return (
    <div className="editor-inspector-header">
      <div className="editor-panel-header">
        <div className="editor-panel-header__title-group">
          {nodeIcon}
          <SimpleTextbox
            key={tpl.uuid}
            defaultValue={currentValue}
            onValueChange={(nextName) => {
              if (isTplSlot(tpl)) {
                viewCtx.change(() =>
                  viewCtx.getViewOps().tryRenameParam(nextName, tpl.param),
                );
              } else {
                COMMANDS.element.rename.execute(
                  studioCtx,
                  { name: nextName },
                  { tpl, viewCtx },
                );
              }
            }}
            placeholder={placeholder}
            fontSize="xlarge"
            fontStyle="bold"
            className="flex-fill"
            data-test-class="simple-text-box"
            data-test-id="inspector-element-name"
          />
          {partDisplayName && (
            <span className="editor-inspector-part-badge" title={partDisplayName}>
              › {partDisplayName}
            </span>
          )}
        </div>
        <div className="editor-panel-header__actions">
          {canShowVisibilityToggle && (
            <>
              <ElementVisibilityQuickToggle tpl={tpl} viewCtx={viewCtx} />
              <span className="editor-panel-header__divider" />
            </>
          )}
          <PanelCloseButton onClick={() => studioCtx.collapseRightPanel()} />
        </div>
      </div>
      {showSubheader && (
        <div className="editor-panel-subheader">
          <ReadOnlyDescriptionStrip
            componentLabel={componentLabel}
            description={description}
          />
          <div className="editor-panel-subheader__actions">
            {canGoToComponent && isTplComponent(tpl) && (
              <Tooltip
                title={
                  <TextAndShortcut
                    children={uiT("Go to component")}
                    shortcut={getComboForAction("GO_TO_COMPONENT_ARENA")}
                  />
                }
              >
                <Button
                  type="text"
                  size="small"
                  data-test-id="header-go-to-component-btn"
                  aria-label={uiT("Go to component")}
                  className="editor-panel-subheader__icon-btn"
                  icon={<Icon icon={ArrowUpRightsvgIcon} />}
                  onClick={() =>
                    studioCtx.change(() => {
                      studioCtx.switchToComponentArena(tpl.component);
                      return ok();
                    })
                  }
                />
              </Tooltip>
            )}
            {canExtractComponent && (
              <Tooltip
                title={
                  <TextAndShortcut
                    children={uiT("Create component")}
                    shortcut={getComboForAction("EXTRACT_COMPONENT")}
                  />
                }
              >
                <Button
                  type="text"
                  size="small"
                  data-test-id="header-create-component-btn"
                  aria-label={uiT("Create component")}
                  className="editor-panel-subheader__icon-btn"
                  icon={<Icon icon={ComponentIcon} />}
                  onClick={() => viewCtx.getViewOps().extractComponent(tpl)}
                />
              </Tooltip>
            )}
            {showStateSwitcher && (
              <VariantStateSwitcher
                studioCtx={studioCtx}
                viewCtx={viewCtx}
                tpl={tpl}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
});
