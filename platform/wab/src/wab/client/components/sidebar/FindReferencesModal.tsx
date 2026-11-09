import { ReferenceInputs, ReferenceInput } from "@/wab/client/components/sidebar/find-reference-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useContentEditorMode } from "@/wab/client/studio-ctx/content-editor-mode-state";
import ListSectionSeparator from "@/wab/client/components/ListSectionSeparator";
import { menuSection } from "@/wab/client/components/menu-builder";
import { MixinPopup } from "@/wab/client/components/sidebar/MixinControls";
import ReferenceItem from "@/wab/client/components/sidebar/ReferenceItem";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { TokenEditModal } from "@/wab/client/components/sidebar/TokenEditModal";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { VirtualListScrollbar } from "@/wab/client/components/widgets/VirtualListScrollbar";
import { UiText } from "@/wab/client/i18n/UiText";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import TokenIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Token";
import PlasmicFindReferencesModal from "@/wab/client/plasmic/plasmic_kit_find_references_modal/PlasmicFindReferencesModal";
import { DefaultReferenceItemProps } from "@/wab/client/plasmic/plasmic_kit_find_references_modal/PlasmicReferenceItem";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { assert, ensure, spawn, unexpected } from "@/wab/shared/common";
import {
  extractComponentUsages,
  getArenaFromFrame,
} from "@/wab/shared/core/sites";
import {
  DefaultStyle,
  extractMixinUsages,
  extractTokenUsages,
  getDefaultStyleTag,
} from "@/wab/shared/core/styles";
import {
  MutableToken,
  OverrideableToken,
  toFinalToken,
} from "@/wab/shared/core/tokens";
import {
  ArenaFrame,
  Component,
  Mixin,
  StyleToken,
  StyleTokenOverride,
  isKnownStyleToken,
  isKnownStyleTokenOverride,
} from "@/wab/shared/model/classes";
import { Menu } from "antd";
import L from "lodash";
import { ok } from "neverthrow";
import * as React from "react";
import { VariableSizeList } from "react-window";

type ItemType = DefaultReferenceItemProps["type"];

export interface UsageSummary {
  components: Component[];
  frames: ArenaFrame[];
  mixins?: Mixin[];
  styleTokens?: StyleToken[];
  styleTokenOverrides?: StyleTokenOverride[];
  themes?: DefaultStyle[];
}

type Item = {
  displayName: string;
  type: ItemType;
  onClick?: () => void;
  getUsageSummary?: () => UsageSummary;
  isSelected?: boolean;
};

function typeToIcon(type: ItemType) {
  if (type === "component") {
    return (
      <Icon
        icon={ComponentIcon}
        className="component-fg custom-svg-icon--lg monochrome-exempt"
      />
    );
  } else if (type === "mixin") {
    return (
      <Icon
        icon={MixinIcon}
        className="mixin-fg custom-svg-icon--lg monochrome-exempt"
      />
    );
  } else if (type === "token") {
    return (
      <Icon
        icon={TokenIcon}
        className="token-fg custom-svg-icon--lg monochrome-exempt"
      />
    );
  } else {
    throw new Error("Invalid item type to find references: " + type);
  }
}

export function FindReferencesModal(props: {
    displayName: string;
    icon: React.ReactNode;
    usageSummary: UsageSummary;
    studioCtx: StudioCtx;
    onClose: () => void;
  }) {
    const { usageSummary, studioCtx, icon, displayName } = props;
    const identity = usageSummary.components[0] ?? usageSummary.frames[0] ?? usageSummary.styleTokens?.[0] ?? usageSummary.styleTokenOverrides?.[0] ?? usageSummary.mixins?.[0] ?? usageSummary.themes?.[0]?.style ?? studioCtx;
    const world = useVariantModelWorld(studioCtx, identity);
    const contentEditorMode = useContentEditorMode(studioCtx);
    const source = React.useMemo(() => new ReferenceInputs(world, usageSummary, contentEditorMode), [world, usageSummary, contentEditorMode]);
    const inputs = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
    const currentArenaRef = useStudioArena(studioCtx, (state) => state.current);

    const [editToken, setEditToken] = React.useState<
      MutableToken<StyleToken> | OverrideableToken<StyleToken> | undefined
    >(undefined);
    const [editMixin, setEditMixin] = React.useState<Mixin | undefined>(
      undefined,
    );
    const [editDefaultStyle, setEditDefaultStyle] = React.useState<
      DefaultStyle | undefined
    >(undefined);

    const [findReferenceItem, setFindReferenceItem] = React.useState<
      Item | undefined
    >(undefined);

    const toItem = (input: ReferenceInput): Item => {
      const { type, target: item, displayName, arenaUid } = input;
      if (type === "component" || type === "page") {
        const component = item as Component;
        return {
          displayName,
          type: type,
          onClick: () => {
            if (!world.isCurrent()) { return; }
            spawn(
              studioCtx.change(() => {
                if (!world.isCurrent()) { return ok(); }
                studioCtx.switchToComponentArena(component);
                return ok();
              }),
            );
          },
          isSelected: currentArenaRef !== null && arenaUid === currentArenaRef.uid,
          getUsageSummary:
            type === "component"
              ? () => world.isCurrent() ? extractComponentUsages(world.site, component) : { components: [], frames: [] }
              : undefined,
        };
      } else if (type === "frame") {
        const frame = item as ArenaFrame;
        return {
          displayName,
          type: type,
          onClick: () => {
            if (!world.isCurrent()) { return; }
            spawn(
              studioCtx.change(() => {
                if (!world.isCurrent()) { return ok(); }
                studioCtx.switchToArena(getArenaFromFrame(world.site, frame));
                return ok();
              }),
            );
          },
          isSelected: currentArenaRef !== null && arenaUid === currentArenaRef.uid,
        };
      } else if (type === "token") {
        const getToken = () => {
          const token = isKnownStyleToken(item)
            ? toFinalToken(item, world.site)
            : isKnownStyleTokenOverride(item)
              ? toFinalToken(item.token, world.site)
              : unexpected();
          assert(token instanceof MutableToken || token instanceof OverrideableToken, "token must be editable");
          return token;
        };
        return {
          displayName,
          type,
          onClick: () => { if (world.isCurrent()) { setEditToken(getToken()); } },
          getUsageSummary: () => world.isCurrent() ? extractTokenUsages(world.site, getToken().base)[1] : { components: [], frames: [] },
        };
      } else if (type === "mixin") {
        const mixin = item as Mixin;
        return {
          displayName,
          type: type,
          onClick: () => { if (world.isCurrent()) { setEditMixin(mixin); } },
          getUsageSummary: () => world.isCurrent() ? extractMixinUsages(world.site, mixin)[1] : { components: [], frames: [] },
        };
      } else if (type === "theme") {
        const theme = item as DefaultStyle;
        return {
          displayName,
          type: type,
          onClick: () => {
            if (world.isCurrent()) { setEditDefaultStyle(theme); }
          },
        };
      } else {
        throw new Error("Invalid reference item type: " + type);
      }
    };

    const items: (Item | "separator")[] = [];
    for (const type of ["page", "component", "frame", "token", "mixin", "theme"] as const) {
      const section = inputs.filter((input) => input.type === type);
      if (section.length) { items.push("separator", ...section.map(toItem)); }
    }

    const itemSizer = (index: number) => {
      const item = items[index];
      if (item === "separator") {
        return 9;
      } else {
        return 32;
      }
    };

    const height = L.sum(L.range(items.length).map(itemSizer));

    return (
      <SidebarModal
        show={true}
        title={
          <>
            {icon}
            <div>
              <UiText
                message={"References to {part1}"}
                values={{ part1: displayName }}
              />
            </div>
          </>
        }
        onClose={() => props.onClose()}
      >
        <PlasmicFindReferencesModal root={{ style: { overflow: "hidden" } }}>
          <VariableSizeList
            outerElementType={VirtualListScrollbar}
            height={height}
            itemSize={itemSizer}
            itemData={items}
            layout="vertical"
            width="100%"
            overscanCount={2}
            itemCount={items.length}
          >
            {({ data, index, style }) => {
              if (index === 0) {
                return <></>;
              }
              if (data[index] === "separator") {
                return <ListSectionSeparator style={style} center />;
              }
              const item = data[index] as Item;
              return (
                <li style={style}>
                  <ReferenceItem
                    type={item.type}
                    onClick={item.onClick}
                    selected={item.isSelected}
                    menu={
                      item.getUsageSummary !== undefined
                        ? getReferenceItemMenuRenderer({
                            item,
                            setFindReferenceItem,
                          })
                        : undefined
                    }
                  >
                    {item.displayName}
                  </ReferenceItem>
                </li>
              );
            }}
          </VariableSizeList>
        </PlasmicFindReferencesModal>

        {editToken && (
          <TokenEditModal
            studioCtx={studioCtx}
            token={editToken}
            onClose={() => {
              setEditToken(undefined);
            }}
          />
        )}
        {editMixin && (
          <MixinPopup
            studioCtx={studioCtx}
            mixin={editMixin}
            themeTag={undefined}
            show={true}
            onClose={() => {
              setEditMixin(undefined);
            }}
          />
        )}
        {editDefaultStyle && (
          <MixinPopup
            studioCtx={studioCtx}
            mixin={editDefaultStyle.style}
            themeTag={getDefaultStyleTag(editDefaultStyle)}
            show={true}
            onClose={() => {
              setEditDefaultStyle(undefined);
            }}
          />
        )}
        {findReferenceItem && (
          <FindReferencesModal
            studioCtx={studioCtx}
            displayName={findReferenceItem.displayName}
            icon={typeToIcon(findReferenceItem.type)}
            usageSummary={ensure(
              findReferenceItem.getUsageSummary,
              "setFindReferenceItem should only be used for itens with getUsageSummary",
            )()}
            onClose={() => {
              setFindReferenceItem(undefined);
            }}
          />
        )}
      </SidebarModal>
    );
}

function getReferenceItemMenuRenderer({
  item,
  setFindReferenceItem,
}: {
  item: Item;
  setFindReferenceItem: (i: Item) => void;
}) {
  return () => {
    const onFindReferences = () => setFindReferenceItem(item);

    return (
      <Menu onClick={(e) => e.domEvent.stopPropagation()}>
        {menuSection(
          "references",
          <Menu.Item key="references" onClick={onFindReferences}>
            <UiText message={"Find all references"} />
          </Menu.Item>,
        )}
      </Menu>
    );
  };
}
