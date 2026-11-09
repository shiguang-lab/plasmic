import { useStore } from "zustand";
import ListItem from "@/wab/client/components/ListItem";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { EffectsPanelSection } from "@/wab/client/components/sidebar-tabs/EffectsSection";
import { LayoutSection } from "@/wab/client/components/sidebar-tabs/LayoutSection";
import { ListStyleSection } from "@/wab/client/components/sidebar-tabs/ListStyleSection";
import { PositioningPanelSection } from "@/wab/client/components/sidebar-tabs/PositioningSection";
import { ShadowsPanelSection } from "@/wab/client/components/sidebar-tabs/ShadowsSection";
import { SizeSection } from "@/wab/client/components/sidebar-tabs/SizeSection";
import { SpacingSection } from "@/wab/client/components/sidebar-tabs/SpacingSection";
import { TransformPanelSection } from "@/wab/client/components/sidebar-tabs/TransformPanelSection";
import { TransitionsPanelSection } from "@/wab/client/components/sidebar-tabs/TransitionsSection";
import { TypographySection } from "@/wab/client/components/sidebar-tabs/TypographySection";
import { BackgroundSection } from "@/wab/client/components/sidebar-tabs/background-section";
import { FindReferencesModal } from "@/wab/client/components/sidebar/FindReferencesModal";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import {
  ItemOrGroup,
  VirtualGroupedList,
} from "@/wab/client/components/sidebar/VirtualGroupedList";
import { useDepFilterButton } from "@/wab/client/components/sidebar/left-panel-utils";
import {
  BorderPanelSection,
  BorderRadiusSection,
} from "@/wab/client/components/style-controls/BorderControls";
import { OutlinePanelSection } from "@/wab/client/components/style-controls/OutlineControls";
import {
  SingleRsExpsProvider,
  createStyleTarget,
  providesStyleTarget,
} from "@/wab/client/components/style-controls/StyleComponent";
import { Matcher } from "@/wab/client/components/view-common";
import { StylePreviewTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { SimpleTextbox } from "@/wab/client/components/widgets/SimpleTextbox";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translateUiLabel } from "@/wab/client/i18n/locales";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import ThemeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Theme";
import PlasmicLeftMixinsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftMixinsPanel";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { isTokenRef } from "@/wab/commons/StyleToken";
import { MIXIN_LOWER } from "@/wab/shared/Labels";
import {
  RuleSetHelpers,
  VariantedRuleSetHelpers,
} from "@/wab/shared/RuleSetHelpers";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure, spawn, tuple } from "@/wab/shared/common";
import { extractTransitiveDepsFromMixins } from "@/wab/shared/core/project-deps";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import {
  extractMixinUsages,
  makeDefaultStylesRuleBodyFor,
} from "@/wab/shared/core/styles";
import { getTagsWithCssOverrides } from "@/wab/shared/css";
import {
  BASE_THEMABLE_TAG,
  TagName,
  ThemableTag,
  isTagListContainer,
} from "@/wab/shared/html";
import {
  Mixin,
  ProjectDependency,
  Theme,
  Variant,
} from "@/wab/shared/model/classes";
import { naturalSort } from "@/wab/shared/sort";
import { Menu, notification } from "antd";
import cn from "classnames";
import L from "lodash";
import { MixinPanelInputs, useMixinCatalog, useMixinUsage, useMixinModelInputs } from "@/wab/client/components/sidebar/mixin-panel-inputs";
import { useLibraryAppInputs } from "@/wab/client/components/sidebar/library-inputs";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import React from "react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

function MixinPreviewContent(props: {
  sc: StudioCtx;
  mixin: Mixin;
  vsh: VariantedStylesHelper;
  /** Render the preview text as this tag, so the tag's default styles apply. */
  tag: TagName;
}) {
  const { sc, mixin, vsh, tag } = props;
  const inputs = useMixinModelInputs(sc, mixin, tag);
  const active = inputs.alive;
  const isList = isTagListContainer(tag);
  const { text, elementValues, baseValues, listValues, wrapperValues } = inputs.preview;
  const references = [baseValues, elementValues, listValues, wrapperValues].flatMap((values) => Object.entries(values ?? {}).filter(([key, value]) => !["left", "right", "top", "bottom"].includes(key) && isTokenRef(value)).map(([, value]) => value));
  const tokens = useStyleTokenRefs(sc, references, vsh, "allLastHead", (state) => state.rows);
  if (!active) { return null; }
  const tokenRefResolver = (value: string) => tokens.selected.find((row) => row.input === value)?.resolved?.value;
  // We ignore the positioning properties for the preview
  const resolveStyle = (values: Record<string, string> | undefined) =>
    Object.fromEntries(
      Object.entries(values ?? {})
        .filter(([r]) => !["left", "right", "top", "bottom"].includes(r))
        .map(([r, val]) =>
          tuple(
            L.camelCase(r),
            isTokenRef(val) ? tokenRefResolver(val) : val,
          ),
        ),
    ) as React.CSSProperties;

  // The theme's base default style is applied to a wrapper, not the previewed
  // element itself, so that relative values (e.g. font-size: 2em) and browser
  // default styles (e.g. bold <b>) resolve against it the same way they do on
  // a real page, where the base style is inherited from component roots.
  const baseStyle = {
    whiteSpace: "pre-wrap",
    ...resolveStyle(baseValues),
  };
  const style = resolveStyle(elementValues);

  return (
    <>
      <style>{PREVIEW_RESET_CSS}</style>
      <div
        className={cn(
          "style__assets__typography__preview",
          !isList && "pointer",
        )}
      >
        <div style={baseStyle}>
          {isList ? (
            React.createElement(
              tag,
              { style },
              defaultPreviewList(
                resolveStyle(listValues),
              ),
            )
          ) : (
            <EditableLabel
              value={text}
              defaultEditing={false}
              onEdit={(newValue) =>
                spawn(sc.changeUnsafe(() => { if (inputs.isActive()) { mixin.preview = newValue; } }))
              }
            >
              {tag === "li" ? (
                <ul style={resolveStyle(wrapperValues)}>
                  <li style={style}>{text}</li>
                </ul>
              ) : (
                React.createElement(tag, { style }, text)
              )}
            </EditableLabel>
          )}
        </div>
      </div>
    </>
  );
}

export const MixinPreview = React.memo(MixinPreviewContent);

export interface MixinPanelSelection {
  // Each boolean below defines whether to show the corresponding panel or not.
  visibility?: boolean;
  typography?: boolean;
  container?: boolean;
  spacing?: boolean;
  background?: boolean;
  effect?: boolean;
  border?: boolean;
  sizing?: boolean;
  outline?: boolean;
  shadow?: boolean;
  position?: boolean;
  transition?: boolean;
  transform?: boolean;
  list?: boolean;
}

export interface MixinPopupProps {
  studioCtx: StudioCtx;
  mixin: Mixin;
  themeTag: ThemableTag | undefined;
  show: boolean;
  onClose: () => void;
  autoFocusTitle?: boolean;
}

const iconClass = "mixin-fg custom-svg-icon--lg monochrome-exempt";

export const MixinPopup = React.memo(function MixinPopup(props: MixinPopupProps) {
  const { t: uiT } = useI18n();

  const { studioCtx, mixin, themeTag } = props;
  const inputs = useMixinModelInputs(studioCtx, mixin);
  if (!inputs.alive) { return null; }
  // Only the default typography style (no specific tag) is restricted to
  // typography-only props; tag styles (e.g. ul/ol) keep all their panels.
  const isDefaultThemeStyle = inputs.forTheme && themeTag === BASE_THEMABLE_TAG;
  return (
    <SidebarModal
      title={
        inputs.forTheme ? (
          <>
            <Icon icon={ThemeIcon} className={iconClass} />
            <div> {inputs.name} </div>
          </>
        ) : (
          <>
            <Icon icon={MixinIcon} className={iconClass} />
            <SimpleTextbox
              defaultValue={inputs.name}
              onValueChange={(name) =>
                studioCtx.changeUnsafe(() => {
                  if (inputs.isActive()) { studioCtx.tplMgr().renameMixin(mixin, name); }
                })
              }
              placeholder={uiT("(unnamed {part1})", {
                part1: translateUiLabel(getUiLocale(), MIXIN_LOWER),
              })}
              autoFocus={props.autoFocusTitle}
              selectAllOnFocus={true}
              fontSize="xlarge"
              fontStyle="bold"
            />
          </>
        )
      }
      show={props.show}
      onClose={() => props.onClose()}
    >
      <MixinFormContent
        studioCtx={studioCtx}
        mixin={mixin}
        themeTag={themeTag}
        panelSelection={isDefaultThemeStyle ? { typography: true } : undefined}
        inheritableTypographyPropsOnly={isDefaultThemeStyle}
      />
    </SidebarModal>
  );
});

export const MixinFormContent = React.memo(function MixinFormContent(props: {
  studioCtx: StudioCtx;
  mixin: Mixin;
  themeTag: ThemableTag | undefined;
  /** If not defined, show all panels. **/
  panelSelection?: MixinPanelSelection;
  inheritableTypographyPropsOnly: boolean;
  warnOnRelativeFontUnits?: boolean;
  targetGlobalVariants?: Variant[];
}) {
  const {
    studioCtx,
    mixin,
    panelSelection,
    themeTag,
    inheritableTypographyPropsOnly,
    targetGlobalVariants,
    warnOnRelativeFontUnits,
  } = props;

  const inputs = useMixinModelInputs(studioCtx, mixin);
  if (!inputs.alive) { return null; }
  const vsh = new VariantedStylesHelper(
    studioCtx.site,
    targetGlobalVariants,
    targetGlobalVariants,
  );

  const rsh =
    themeTag !== undefined
      ? new VariantedRuleSetHelpers(mixin, themeTag, vsh)
      : new RuleSetHelpers(inputs.rs, "div");

  const expsProvider = new SingleRsExpsProvider(
    inputs.rs,
    rsh,
    studioCtx,
    /*unremovableProps=*/ [],
    themeTag !== undefined
      ? { kind: "mixin", site: studioCtx.site, mixin, activeGlobalVariants: targetGlobalVariants ?? [], forTag: themeTag }
      : { kind: "ruleSet", rs: mixin.rs, forTag: "div" },
    themeTag,
  );

  const styleComponent = createStyleTarget({ expsProvider });
  const s = panelSelection;

  return providesStyleTarget(styleComponent)(
    <>
      <SidebarSection
        title={
          <LabelWithDetailedTooltip tooltip={<StylePreviewTooltip />}>
            <UiText message={"Preview"} />
          </LabelWithDetailedTooltip>
        }
      >
        <MixinPreview
          sc={studioCtx}
          mixin={mixin}
          vsh={vsh}
          tag={themeTag || "div"}
        />
      </SidebarSection>

      {(!s || s.typography) && (
        <TypographySection
          expsProvider={expsProvider}
          inheritableOnly={inheritableTypographyPropsOnly}
          warnOnRelativeUnits={warnOnRelativeFontUnits}
          vsh={vsh}
        />
      )}

      {themeTag && isTagListContainer(themeTag) && (!s || s.list) && (
        <ListStyleSection expsProvider={expsProvider} />
      )}

      {(!s || s.sizing) && (
        <SizeSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.position) && (
        <PositioningPanelSection expsProvider={expsProvider} />
      )}

      {(!s || s.spacing) && (
        <SpacingSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.container) && (
        <LayoutSection expsProvider={expsProvider} vsh={vsh} allowConvert />
      )}

      {(!s || s.background) && (
        <BackgroundSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.border) && (
        <BorderPanelSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.border) && (
        <BorderRadiusSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.outline) && <OutlinePanelSection />}

      {(!s || s.shadow) && (
        <ShadowsPanelSection expsProvider={expsProvider} vsh={vsh} />
      )}

      {(!s || s.effect) && <EffectsPanelSection expsProvider={expsProvider} />}

      {(!s || s.transition) && (
        <TransitionsPanelSection expsProvider={expsProvider} />
      )}

      {(!s || s.transform) && (
        <TransformPanelSection expsProvider={expsProvider} />
      )}
    </>,
  );
});

function MixinsPanelContent({ inputs }: { inputs: NonNullable<ReturnType<typeof useMixinCatalog>> }) {
  const { t: studioUiT } = useI18n();

  const sc = useStudioCtx();
  const [query, setQuery] = React.useState("");
  const { filterDeps, filterProps } = useDepFilterButton({
    studioCtx: sc,
    deps: inputs.dependencies.filter((row) => row.mixins.length > 0).map((row) => row.dependency),
  });
  const readOnly = useStore(sc.uiEnvironment.store, (state) => state.leftTabPermissions.mixins === "readable");
  const matcher = new Matcher(query);

  const [editMixin, setEditMixin] = React.useState<Mixin | undefined>(
    undefined,
  );

  const [justAdded, setJustAdded] = React.useState<Mixin | undefined>(
    undefined,
  );

  const [findReferenceMixin, setFindReferenceMixin] = React.useState<
    Mixin | undefined
  >(undefined);

  const usage = useMixinUsage(sc, findReferenceMixin);
  const onDuplicate = async (mixin: Mixin) => {
    const transitiveDeps = extractTransitiveDepsFromMixins(sc.site, [mixin]);

    const badTransitiveDeps = transitiveDeps.filter((dep) =>
      sc.projectDependencyManager.getDependencyData(dep.pkgId),
    );

    if (badTransitiveDeps.length > 0) {
      notification.error({
        message: studioUiT(
          "Before duplicating this {part1} you have to update your imported projects: {part2}",
          {
            part1: translateUiLabel(getUiLocale(), MIXIN_LOWER),
            part2: badTransitiveDeps.map((dep) => dep.name).join(", "),
          },
        ),
      });
      return;
    }

    if (
      !(await sc.siteOps().maybePromptForTransitiveImports(
        <>
          <UiText
            message={
              "The mixin you are cloning uses tokens from the following projects. To clone this mixin, you will also need to import these projects. Are you sure you want to continue?"
            }
          />
        </>,
        transitiveDeps,
      ))
    ) {
      return;
    }
    await sc.changeUnsafe(() => {
      if (!inputs.isActive()) { return; }
      for (const dep of transitiveDeps) {
        sc.projectDependencyManager.addTransitiveDepAsDirectDep(dep);
      }
      const newMixin = sc.tplMgr().duplicateMixin(mixin);
      setEditMixin(newMixin);
      setJustAdded(newMixin);
    });
  };

  const onDelete = async (mixin: Mixin) => {
    if (inputs.isActive()) { await sc.siteOps().tryDeleteMixins([mixin]); }
  };

  const addMixin = async () => {
    return sc.changeUnsafe(() => {
      if (!inputs.isActive()) { return; }
      const mixin = sc.tplMgr().addMixin();
      setJustAdded(mixin);
      setEditMixin(mixin);
    });
  };

  const onSelect = (mixin: Mixin) => setEditMixin(mixin);

  const onFindReferences = (mixin: Mixin) => {
    setFindReferenceMixin(mixin);
  };

  const makeMixinsItems = (mixins: (typeof inputs)["local"]) => {
    mixins = mixins.filter(
      (mixin) => matcher.matches(mixin.name) || justAdded === mixin.mixin,
    );
    mixins = naturalSort(mixins, (mixin) => mixin.name);
    return mixins.map((mixin) => ({
      type: "item" as const,
      item: mixin.mixin,
      key: mixin.key,
    }));
  };

  const makeDepsItems = (deps: (typeof inputs)["dependencies"]) => {
    deps = deps.filter(
      (dep) => filterDeps.length === 0 || filterDeps.includes(dep.dependency),
    );
    deps = naturalSort(deps, (dep) =>
      dep.name,
    );
    return deps.map((dep) => ({
      type: "group" as const,
      key: dep.dependency.uuid,
      group: dep.dependency,
      items: makeMixinsItems(dep.mixins),
      defaultCollapsed: true,
    }));
  };

  const items: ItemOrGroup<ProjectDependency, Mixin>[] = [
    ...(filterDeps.length === 0 ? [...makeMixinsItems(inputs.local)] : []),
    ...makeDepsItems(
      inputs.dependencies.filter((d) => !d.hostless),
    ),
    ...makeDepsItems(
      inputs.dependencies.filter((d) => d.hostless),
    ),
  ];

  const editableMixins = new Set(inputs.local.map((row) => row.mixin));

  return (
    <>
      <PlasmicLeftMixinsPanel
        leftSearchPanel={{
          searchboxProps: {
            value: query,
            onChange: (e) => setQuery(e.target.value),
            autoFocus: true,
          },
          filterProps,
        }}
        newMixinButton={
          readOnly
            ? { render: () => null }
            : {
                onClick: () => addMixin(),
              }
        }
        content={
          <>
            <VirtualGroupedList
              items={items}
              renderItem={(mixin) => (
                <MixinRow
                  mixin={mixin}
                  sc={sc}
                  matcher={matcher}
                  onDuplicate={readOnly ? undefined : () => onDuplicate(mixin)}
                  onFindReferences={() => onFindReferences(mixin)}
                  readOnly={readOnly || !editableMixins.has(mixin)}
                  onDelete={
                    !readOnly && editableMixins.has(mixin)
                      ? () => onDelete(mixin)
                      : undefined
                  }
                  onClick={
                    !readOnly && editableMixins.has(mixin)
                      ? () => onSelect(mixin)
                      : undefined
                  }
                />
              )}
              itemHeight={32}
              renderGroupHeader={(dep) => `Imported from "${inputs.dependencies.find((row) => row.dependency === dep)?.name ?? ""}"`}
              headerHeight={50}
              hideEmptyGroups
              forceExpandAll={matcher.hasQuery() || filterDeps.length > 0}
            />
          </>
        }
      />

      {editMixin && (
        <MixinPopup
          studioCtx={sc}
          mixin={editMixin}
          themeTag={undefined}
          show={true}
          onClose={() => {
            setEditMixin(undefined);
            setJustAdded(undefined);
          }}
          autoFocusTitle={editMixin === justAdded}
        />
      )}

      {findReferenceMixin && usage && (
        <FindReferencesModal
          studioCtx={sc}
          displayName={usage.name}
          icon={<Icon icon={MixinIcon} className={iconClass} />}
          usageSummary={usage.summary}
          onClose={() => {
            setFindReferenceMixin(undefined);
          }}
        />
      )}
    </>
  );
}

export const MixinsPanel = React.memo(function MixinsPanel() {
  const studio = useStudioCtx();
  useLibraryAppInputs(studio);
  const inputs = useMixinCatalog(studio);
  return inputs ? <MixinsPanelContent key={inputs.key} inputs={inputs} /> : null;
});

export const MixinRow = function MixinRow(props: {
  mixin: Mixin;
  sc: StudioCtx;
  onDuplicate?: () => void;
  onFindReferences: () => void;
  onDelete?: () => void;
  matcher: Matcher;
  readOnly?: boolean;
  onClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
}) {
  const { mixin, matcher, readOnly, onClick, isDragging, dragHandleProps } =
    props;
  const name = useStore(props.sc.modelSnapshots.field(mixin, "name"));

  const renderMenu = () => {
    const builder = new MenuBuilder();
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item key="references" onClick={() => props.onFindReferences()}>
          <UiText message={"Find all references"} />
        </Menu.Item>,
      );
      if (props.onDuplicate) {
        push(
          <Menu.Item key="clone" onClick={() => props.onDuplicate!()}>
            <UiText message={"Duplicate"} />
          </Menu.Item>,
        );
      }

      if (!readOnly && props.onDelete) {
        push(
          <Menu.Item
            key="delete"
            onClick={() =>
              ensure(
                props.onDelete,
                `props.onDelete must exist for this menu item to exist`,
              )()
            }
          >
            <UiText message={"Delete"} />
          </Menu.Item>,
        );
      }
    });
    return builder.build({
      onMenuClick: (e) => e.domEvent.stopPropagation(),
      menuName: "mixin-item-menu",
    });
  };
  return (
    <ListItem
      menu={renderMenu}
      onClick={onClick}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
      isDraggable={!readOnly}
      icon={<Icon icon={MixinIcon} />}
    >
      {matcher.boldSnippets(name)}
    </ListItem>
  );
};

export const EditMixinButton = function EditMixinButton(props: {
  mixin: Mixin;
  themeTag: ThemableTag | undefined;
  className?: string;
  children?: React.ReactNode;
  onShowPopup?: (editing: boolean) => void;
}) {
  const { mixin, className, children, themeTag } = props;
  const studioCtx = useStudioCtx();
  const [editing, setEditing] = React.useState(false);

  return (
    <>
      <button
        className={className}
        onClick={() => {
          setEditing(true);
          props.onShowPopup && props.onShowPopup(true);
        }}
      >
        {children}
      </button>
      {editing && (
        <MixinPopup
          studioCtx={studioCtx}
          mixin={mixin}
          themeTag={themeTag}
          show={true}
          onClose={() => {
            setEditing(false);
            props.onShowPopup && props.onShowPopup(false);
          }}
        />
      )}
    </>
  );
};

function defaultPreviewList(liStyle: React.CSSProperties) {
  return [1, 2, 3].map((i) => (
    <li key={i} style={liStyle}>
      {<UiText message={"Item {part1}"} values={{ part1: String(i) }} />}
    </li>
  ));
}

/**
 * The same tag resets that canvas and codegen apply to Plasmic-generated
 * elements (see makeDefaultStylesRules), scoped to the preview container so
 * unset properties render as they would on a real page rather than as
 * user-agent defaults. Tag selectors out-rank the `all: revert` shield on
 * the container by specificity, and inline theme styles out-rank both.
 */
const PREVIEW_RESET_CSS = getTagsWithCssOverrides()
  .map(
    (tag) =>
      `.style__assets__typography__preview ${tag} { ${makeDefaultStylesRuleBodyFor(
        tag,
      )} }`,
  )
  .join("\n");
