import { useComponentParamValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useInspectorCanvasEnv, useInspectorStateValue } from "@/wab/client/studio-ctx/inspector-state";
import type { State } from "@/wab/shared/model/classes";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import RowGroup from "@/wab/client/components/RowGroup";
import { ComponentPropModal } from "@/wab/client/components/modals/ComponentPropModal";
import { confirm } from "@/wab/client/components/quick-modals";
import { ValuePreview } from "@/wab/client/components/sidebar-tabs/data-tab";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { PropsTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { LabeledListItem } from "@/wab/client/components/widgets/LabeledListItem";
import { SimpleReorderableList } from "@/wab/client/components/widgets/SimpleReorderableList";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  mkModelUiId,
  parseUiId,
} from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  COMPONENT_PROP_LOWER,
  COMPONENT_PROP_PLURAL_CAP,
  CONFIGURE_ACTION,
  DELETE_ACTION,
} from "@/wab/shared/Labels";
import { getSlotParams } from "@/wab/shared/SlotUtils";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensure, spawn } from "@/wab/shared/common";
import {
  canChangeParamExportType,
  canDeleteParam,
  canRenameParam,
  findPropUsages,
  getParamDisplayName,
  getRealParams,
  isCodeComponent,
  removeComponentParam,
} from "@/wab/shared/core/components";
import { ParamExportType } from "@/wab/shared/core/lang";
import {
  getAncestorFolderPaths,
  getFolderDisplayName,
  parseFolderSegments,
  renameFolderLeaf,
} from "@/wab/shared/folders/folders-util";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import {
  collectPropTreeParams,
  type PropTreeFolderInput,
  type PropTreeInputNode,
  usePropTreeInputs,
} from "@/wab/client/studio-ctx/prop-tree-inputs";
import { reorderLevelWithParams } from "@/wab/shared/folders/prop-tree";
import { Component, Param, isKnownPropParam } from "@/wab/shared/model/classes";
import { Menu, Tooltip } from "antd";
import { ok } from "neverthrow";
import React from "react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { FaCheck } from "react-icons/fa";

type PropsTreeCtxValue = {
  openNewPropModal: (prefix: string) => void;
  expandedFolders: Set<string>;
  toggleFolderExpanded: (path: string) => void;
  expandAncestorsOf: (param: Param) => void;
};
const PropsTreeCtx = React.createContext<PropsTreeCtxValue | null>(null);
const usePropsTreeCtx = () =>
  ensure(React.useContext(PropsTreeCtx), "PropsTreeCtx missing");

/**
 * The sidebar section for prop definitions. Delegates rendering to `PropsDefinitionSection`
 */
interface ComponentPropsDefinitionProps { studioCtx: StudioCtx; component: Component; viewCtx: ViewCtx; justOneSection?: "variants" | "slots" | "meta"; }
export const ComponentPropsDefinitionSection = React.memo(function ComponentPropsDefinitionSection(props: ComponentPropsDefinitionProps) {
  const world = useVariantModelWorld(props.studioCtx, props.component, props.viewCtx);
  return world.alive ? <ComponentPropsDefinitionContent {...props} /> : null;
});
const ComponentPropsDefinitionContent = React.memo(function ComponentPropsDefinitionContent(props: ComponentPropsDefinitionProps) {
    const { t: studioUiT } = useI18n();

    const { studioCtx, component, viewCtx } = props;
    const selectParams = React.useCallback(() => Object.freeze({ slots: getSlotParams(component), real: getRealParams(component) }), [component]);
    const { slots: slotParams, real: realParams } = useComponentParamValue(studioCtx, component, selectParams);
    const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);
    const [newPropPrefix, setNewPropPrefix] = React.useState<string | null>(
      null,
    );
    const [expandedFolders, setExpandedFolders] = React.useState(
      new Set<string>(),
    );

    const expandAncestorsOf = (param: Param) => {
      const ancestors = getAncestorFolderPaths(
        getParamDisplayName(component, param),
      );
      setExpandedFolders((prev) => new Set([...prev, ...ancestors]));
    };

    // Props may be inside collapsed folders, so listen for UI actions
    // and expand the target param's ancestor folders so its row mounts.
    React.useEffect(() => {
      const { dispose } = studioCtx.uiActionBus.registerListener(
        (uiId, _type) => {
          if (!world.isCurrent(viewCtx)) { return; }
          const parsed = parseUiId(uiId);
          if (parsed.type === "Model") {
            const param = component.params.find((p) => p.uuid === parsed.uuid);
            if (param) {
              expandAncestorsOf(param);
            }
          }
        },
      );
      return dispose;
    }, [studioCtx, component, viewCtx]);


    return (
      <PropsTreeCtx.Provider
        value={{
          openNewPropModal: setNewPropPrefix,
          expandedFolders,
          toggleFolderExpanded: (path) =>
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              next.has(path) ? next.delete(path) : next.add(path);
              return next;
            }),
          expandAncestorsOf,
        }}
      >
        <SidebarSection
          title={
            <LabelWithDetailedTooltip tooltip={PropsTooltip}>
              {<UiLabel text={COMPONENT_PROP_PLURAL_CAP} />}
            </LabelWithDetailedTooltip>
          }
          controls={
            <IconLinkButton
              onClick={() => setNewPropPrefix("")}
              data-test-id="add-prop-btn"
            >
              <Icon icon={PlusIcon} />
            </IconLinkButton>
          }
          zeroBodyPadding
          emptyBody={!slotParams.length && !realParams.length}
          emptyDescription={studioUiT(
            "Customize each instance of this component.",
          )}
          data-test-id="props-section"
        >
          {realParams.length > 0 && (
            <PropsDefinitionSection
              studioCtx={studioCtx}
              component={component}
              viewCtx={viewCtx}
              params={realParams}
              draggable
            />
          )}
        </SidebarSection>
        {newPropPrefix !== null && (
          <ComponentPropModal
            studioCtx={studioCtx}
            component={component}
            visible
            suggestedName={newPropPrefix}
            onFinish={(newParam) => {
              if (!world.isCurrent(viewCtx)) { return; }
              if (newParam) {
                expandAncestorsOf(newParam);
              }
              setNewPropPrefix(null);
            }}
          />
        )}
      </PropsTreeCtx.Provider>
    );
  }
);

/**
 * Renders the props section content.
 */
function PropsDefinitionSection(props: {
  studioCtx: StudioCtx;
  component: Component;
  viewCtx: ViewCtx;
  params: Param[];
  draggable?: boolean;
}) {
  const { studioCtx, component, viewCtx, params, draggable } = props;
  const { models, tree } = usePropTreeInputs(studioCtx, component, params);
  return (
    <div className="mb-xlg">
      <PropsLevel
        studioCtx={studioCtx}
        component={component}
        viewCtx={viewCtx}
        siblings={tree}
        models={models}
        draggable={draggable}
      />
    </div>
  );
}

/**
 * Renders one level (siblings) of the folder tree as a reorderable list.
 */
const PropsLevel = function PropsLevel(props: {
  studioCtx: StudioCtx;
  component: Component;
  viewCtx: ViewCtx;
  siblings: readonly PropTreeInputNode[];
  models: ModelSnapshots;
  draggable?: boolean;
}) {
  const { studioCtx, component, viewCtx, siblings, models, draggable } = props;
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);
  return (
    <SimpleReorderableList
      onReordered={(fromIndex, toIndex) =>
        studioCtx.change(() => {
          if (!world.isCurrent(viewCtx) || models !== studioCtx.modelSnapshots) { return ok(); }
          reorderLevelWithParams(
            component,
            siblings,
            (node) =>
              collectPropTreeParams(node).map((param) =>
                models.resolve(param),
              ),
            fromIndex,
            toIndex,
          );
          return ok();
        })
      }
      customDragHandle
    >
      {siblings.map((node) =>
        node.kind === "param" ? (
          <PropRow
            key={`param-${node.param.uid}`}
            studioCtx={studioCtx}
            component={component}
            viewCtx={viewCtx}
            param={models.resolve(node.param)}
            draggable={draggable}
          />
        ) : (
          <PropFolderRow
            key={`folder-${node.path}`}
            studioCtx={studioCtx}
            component={component}
            viewCtx={viewCtx}
            node={node}
            models={models}
            draggable={draggable}
          />
        ),
      )}
    </SimpleReorderableList>
  );
};

/**
 * Renders a prop folder, i.e. the folder header, and its children (delegated to `PropsLevel`)
 */
const PropFolderRow = function PropFolderRow(props: {
  studioCtx: StudioCtx;
  component: Component;
  viewCtx: ViewCtx;
  node: PropTreeFolderInput;
  models: ModelSnapshots;
  draggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
}) {
  const { t: uiT } = useI18n();

  const {
    studioCtx,
    component,
    viewCtx,
    node,
    models,
    draggable,
    dragHandleProps,
  } = props;
  const { openNewPropModal, expandedFolders, toggleFolderExpanded } =
    usePropsTreeCtx();
  const isOpen = expandedFolders.has(node.path);
  const leafCount = collectPropTreeParams(node).length;
  return (
    <>
      <RowGroup
        isOpen={isOpen}
        onClick={() => toggleFolderExpanded(node.path)}
        groupSize={leafCount}
        draggable={draggable}
        dragHandleProps={dragHandleProps}
        showActions
        actions={
          <Tooltip
            title={uiT("Add {part1} to folder", {
              part1: translateUiLabel(getUiLocale(), COMPONENT_PROP_LOWER),
            })}
          >
            <IconLinkButton
              onClick={(e) => {
                e.stopPropagation();
                openNewPropModal(
                  `${parseFolderSegments(node.path).join(" / ")} / `,
                );
              }}
              data-test-id="add-prop-to-folder-btn"
            >
              <Icon icon={PlusIcon} />
            </IconLinkButton>
          </Tooltip>
        }
      >
        {node.name}
      </RowGroup>
      {isOpen && (
        <div className="pl-lg">
          <PropsLevel
            studioCtx={studioCtx}
            component={component}
            viewCtx={viewCtx}
            siblings={node.children}
            models={models}
            draggable={draggable}
          />
        </div>
      )}
    </>
  );
};

/**
 * A leaf prop row
 */
const PropRow = React.memo(function ParamRow(props: {
  studioCtx: StudioCtx;
  component: Component;
  viewCtx: ViewCtx;
  param: Param;
  children?: React.ReactNode;
  draggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
}) {
  const { studioCtx, component, viewCtx, param, draggable } = props;
  const selectRow = React.useCallback(() => Object.freeze({
    name: getFolderDisplayName(getParamDisplayName(component, param)),
    state: component.states.find((state) => state.param === param),
    canRename: canRenameParam(component, param), advanced: isKnownPropParam(param) && param.advanced,
  }), [component, param]);
  const row = useComponentParamValue(studioCtx, component, selectRow, param);
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);
  const { expandAncestorsOf } = usePropsTreeCtx();


  const [showModal, setShowModal] = React.useState(false);
  const overlay = () =>
    !world.isCurrent(viewCtx) ? <></> : makeParamMenu(studioCtx, component, param, {
      onConfigureParam: () => setShowModal(true),
    });

  return (
    <>
      <WithContextMenu overlay={overlay}>
        <LabeledListItem
          uiId={mkModelUiId(param)}
          draggable={draggable}
          dragHandleProps={props.dragHandleProps}
          onClick={() => setShowModal(true)}
          label={
            <div>
              <EditableLabel
                value={row.name}
                onEdit={(val) =>
                  spawn(
                    studioCtx.change(() => {
                      if (!world.isCurrent(viewCtx)) { return ok(); }
                      if (val) {
                        const newName = renameFolderLeaf(
                          getParamDisplayName(component, param),
                          val,
                        );
                        studioCtx
                          .tplMgr()
                          .renameParam(component, param, newName);
                        expandAncestorsOf(param);
                      }
                      return ok();
                    }),
                  )
                }
                disabled={!row.canRename}
              />
              {row.advanced && (
                <div className="text-xsm dimfg">
                  <UiText message={"(advanced)"} />
                </div>
              )}
            </div>
          }
          menu={overlay}
        >
          <ParamCurrentValue viewCtx={viewCtx} component={component} param={param} state={row.state} />
        </LabeledListItem>
      </WithContextMenu>
      {showModal && (
        <ComponentPropModal
          visible
          studioCtx={studioCtx}
          component={component}
          existingParam={param}
          onFinish={(updatedParam) => {
            if (!world.isCurrent(viewCtx)) { return; }
            if (updatedParam) {
              expandAncestorsOf(updatedParam);
            }
            setShowModal(false);
          }}
        />
      )}
    </>
  );
});

function makeParamMenu(
  studioCtx: StudioCtx,
  component: Component,
  param: Param,
  opts: { onConfigureParam: () => void },
) {
  const world = captureVariantModelWorld(studioCtx);
  return (
    <Menu>
      <Menu.Item onClick={() => opts.onConfigureParam()}>
        {<UiLabel text={CONFIGURE_ACTION} />}
      </Menu.Item>
      {canChangeParamExportType(component, param) && (
        <Menu.SubMenu title={<UiText message="Set code export type to" />}>
          {[
            ParamExportType.External,
            ParamExportType.Internal,
            ParamExportType.ToolsOnly,
          ].map((exportType) => (
            <Menu.Item
              key={exportType}
              onClick={() =>
                studioCtx.changeUnsafe(() => { if (world.isCurrent()) { param.exportType = exportType; } })
              }
            >
              {exportType}{" "}
              {param.exportType === exportType ? <FaCheck /> : null}
            </Menu.Item>
          ))}
        </Menu.SubMenu>
      )}
      {!isCodeComponent(component) && canDeleteParam(component, param) && (
        <Menu.Item
          onClick={async () => {
            if (!world.isCurrent()) { return; }
            const usages = findPropUsages(component, param);
            if (usages?.length > 0) {
              const confirmed = await confirm({
                title: translate(getUiLocale(), "Confirm deletion"),
                message: translate(
                  getUiLocale(),
                  usages.length === 1
                    ? 'Prop "{name}" is still being used by {component} in {count} location. Are you sure you want to delete it?'
                    : 'Prop "{name}" is still being used by {component} in {count} locations. Are you sure you want to delete it?',
                  {
                    name: param.displayName ?? param.variable.name,
                    component: component.name,
                    count: usages.length,
                  },
                ),
                confirmLabel: translate(getUiLocale(), "Delete"),
              });
              if (!confirmed) {
                return;
              }
            }

            await studioCtx.changeUnsafe(() => {
              if (!world.isCurrent()) { return; }
              removeComponentParam(studioCtx.site, component, param);
            });
          }}
        >
          {<UiLabel text={DELETE_ACTION} />}
        </Menu.Item>
      )}
    </Menu>
  );
}

function ParamCurrentValue(props: { viewCtx: ViewCtx; component: Component; param: Param; state?: State }) {
  return props.state ? <StateParamCurrentValue viewCtx={props.viewCtx} state={props.state} /> : <OrdinaryParamCurrentValue {...props} />;
}
function StateParamCurrentValue({ viewCtx, state }: { viewCtx: ViewCtx; state: State }) {
  const value = useInspectorStateValue(viewCtx, state);
  return <ValuePreview val={value.value} />;
}
function OrdinaryParamCurrentValue({ viewCtx, component, param }: { viewCtx: ViewCtx; component: Component; param: Param }) {
  const env = useInspectorCanvasEnv(viewCtx, component.tplTree);
  return <ValuePreview val={env?.$props?.[toVarName(param.variable.name)]} />;
}
