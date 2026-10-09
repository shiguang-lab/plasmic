import { menuSection } from "@/wab/client/components/menu-builder";
import { promptDeleteComponent } from "@/wab/client/components/modals/componentDeletionModal";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  AnyArena,
  getArenaName,
  isComponentArena,
  isDedicatedArena,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { componentsReferencerToPageHref } from "@/wab/shared/cached-selectors";
import { assert, spawn } from "@/wab/shared/common";
import {
  PageComponent,
  isPageComponent,
  isReusableComponent,
} from "@/wab/shared/core/components";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { Component } from "@/wab/shared/model/classes";
import { naturalSort } from "@/wab/shared/sort";
import { Menu } from "antd";
import { ok } from "neverthrow";
import * as React from "react";

export const deleteArenas = async (
  studioCtx: StudioCtx,
  arenas: AnyArena[],
) => {
  const allRefs = arenas.flatMap((arena) =>
    isDedicatedArena(arena) && isPageComponent(arena.component)
      ? Array.from(
          componentsReferencerToPageHref(studioCtx.site, arena.component),
        )
      : [],
  );

  await studioCtx.changeObserved(
    () => allRefs,
    () => {
      for (const arena of arenas) {
        if (isDedicatedArena(arena)) {
          studioCtx.siteOps().tryRemoveComponent(arena.component);
        } else if (isMixedArena(arena)) {
          studioCtx.siteOps().removeMixedArena(arena);
        }
      }
      return ok();
    },
  );
};

/**
 * Context menu shown when right-clicking an arena row.
 *
 * @param onClose callback when context menu should close itself
 * @param onSelectRename callback when rename is clicked
 * Rename option will only be shown if `onClickRename` is set
 */
export function ArenaContextMenu({
  studioCtx,
  arena,
  onSelectRename,
  onClose,
}: {
  studioCtx: StudioCtx;
  arena: AnyArena;
  onSelectRename?: () => void;
  onClose?: () => void;
}) {
  const { t: uiT } = useI18n();
  const currentArena = studioCtx.currentArena;
  const component = isDedicatedArena(arena) ? arena.component : undefined;

  const isSubComp = !!component && !!component.superComp;
  const isSuperComp = !!component && component.subComps.length > 0;
  const isAdmin = isAdminTeamEmail(
    studioCtx.appCtx.selfInfo?.email,
    studioCtx.appCtx.appConfig,
  );

  const doReplaceAllInstances = (toComp: Component) => {
    spawn(studioCtx.siteOps().swapComponents(component!, toComp));
  };

  const doReplaceAllLinks = (toPage: PageComponent) => {
    if (component && isPageComponent(component)) {
      spawn(studioCtx.siteOps().swapPagesLinks(component, toPage));
    }
  };

  const componentToReplaceAllInstancesItem = (comp: Component) => {
    return (
      <Menu.Item
        key={comp.uuid}
        hidden={!isReusableComponent(comp) || comp === component}
        onClick={() => doReplaceAllInstances(comp)}
      >
        {comp.name}
      </Menu.Item>
    );
  };

  const pageToReplaceAllLinksItem = (page: PageComponent) => {
    return (
      <Menu.Item key={page.uuid} onClick={() => doReplaceAllLinks(page)}>
        {page.name}
      </Menu.Item>
    );
  };

  const replaceAllInstancesMenuItems = [
    ...menuSection(
      "local",
      ...naturalSort(studioCtx.site.components, (c) => c.name).map((comp) =>
        componentToReplaceAllInstancesItem(comp),
      ),
    ),
    ...studioCtx.site.projectDependencies.flatMap((dep) =>
      menuSection(
        "imported",
        ...naturalSort(dep.site.components, (c) => c.name).map((comp) =>
          componentToReplaceAllInstancesItem(comp),
        ),
      ),
    ),
  ];

  const replaceAllLinksMenuItems = naturalSort(
    studioCtx.tplMgr().getPageComponents(),
    (c) => c.name,
  )
    .filter((c) => c !== component)
    .map((comp) => pageToReplaceAllLinksItem(comp));

  const contentEditorMode = studioCtx.contentEditorMode;

  const shouldShowItem = {
    duplicate:
      isDedicatedArena(arena) &&
      !isSubComp &&
      (!contentEditorMode || (component && isPageComponent(component))),
    editInNewArtboard:
      isMixedArena(currentArena) &&
      isDedicatedArena(arena) &&
      !contentEditorMode,
    convertToComponent:
      component && isPageComponent(component) && !contentEditorMode,
    convertToPage:
      component &&
      isReusableComponent(component) &&
      !isSubComp &&
      !isSuperComp &&
      !contentEditorMode,
    delete:
      !isSubComp &&
      (!contentEditorMode || (component && isPageComponent(component))),
    findReferences: component && isReusableComponent(component),
    replaceAllInstances:
      component &&
      isReusableComponent(component) &&
      replaceAllInstancesMenuItems.length !== 0 &&
      !contentEditorMode,
    replaceAllLinks: component && isPageComponent(component),
  };

  const onDuplicate = () =>
    studioCtx.siteOps().tryDuplicatingComponent(component!, {
      focusNewComponent: true,
    });

  const onRequestEditingInNewArtboard = () =>
    studioCtx.changeUnsafe(() =>
      studioCtx.siteOps().createNewFrameForMixedArena(component!),
    );

  const onConvertToComponent = () => {
    assert(
      component && isPageComponent(component),
      "Can only convert Page to component if it exists",
    );
    return studioCtx.siteOps().convertPageToComponent(component);
  };

  const onConvertToPage = () =>
    studioCtx.changeObserved(
      () => [component!],
      () => {
        studioCtx.siteOps().convertComponentToPage(component!);
        return ok();
      },
    );

  const onFindReferences = () => {
    studioCtx.findReferencesComponent = component;
    onClose?.();
  };

  const onDelete = async () => {
    const confirmation = await promptDeleteComponent(
      getSiteItemTypeName(arena),
      getArenaName(arena),
      isDedicatedArena(arena)
        ? studioCtx.commentsCtx
            .computedData()
            .commentStatsByComponent.get(arena.component.uuid)?.commentCount
        : undefined,
    );
    if (!confirmation) {
      return;
    }
    await deleteArenas(studioCtx, [arena]);
  };

  return (
    <Menu id="proj-item-menu">
      {menuSection(
        "references",
        <Menu.Item
          key="references"
          hidden={!shouldShowItem.findReferences}
          onClick={onFindReferences}
        >
          <UiText
            message="{part1} all references"
            values={{
              part1: (
                <strong>
                  <UiText message={"Find"} />
                </strong>
              ),
            }}
          />
        </Menu.Item>,
      )}
      {menuSection(
        "component-actions",
        onSelectRename ? (
          <Menu.Item
            key="rename"
            onClick={(e) => {
              e.domEvent.stopPropagation();
              onSelectRename();
            }}
          >
            <strong>
              <UiText message={"Rename"} />
            </strong>{" "}
            {getSiteItemTypeName(arena)}
          </Menu.Item>
        ) : null,
        <Menu.Item
          key="duplicate"
          hidden={!shouldShowItem.duplicate}
          onClick={onDuplicate}
        >
          <strong>
            <UiText message={"Duplicate"} />
          </strong>{" "}
          {getSiteItemTypeName(arena)}
        </Menu.Item>,
      )}
      {menuSection(
        "artboard-actions",
        <Menu.Item
          key="editInNewArtboard"
          hidden={!shouldShowItem.editInNewArtboard}
          onClick={onRequestEditingInNewArtboard}
        >
          <UiText
            message="{part1} in new artboard"
            values={{
              part1: (
                <strong>
                  <UiText message={"Edit"} />
                </strong>
              ),
            }}
          />
        </Menu.Item>,
        <Menu.Item
          key="convertToComponent"
          hidden={!shouldShowItem.convertToComponent}
          onClick={onConvertToComponent}
        >
          <UiText
            message="{part1} to reusable component"
            values={{
              part1: (
                <strong>
                  <UiText message={"Convert"} />
                </strong>
              ),
            }}
          />
        </Menu.Item>,
        <Menu.Item
          key="convertToPage"
          hidden={!shouldShowItem.convertToPage}
          onClick={onConvertToPage}
        >
          <UiText
            message="{part1} to page component"
            values={{
              part1: (
                <strong>
                  <UiText message={"Convert"} />
                </strong>
              ),
            }}
          />
        </Menu.Item>,
      )}
      {shouldShowItem.replaceAllInstances &&
        menuSection(
          "replace",
          <Menu.SubMenu
            key="replaceAllInstances"
            title={
              <span>
                <UiText
                  message="{part1} all instances of this component with..."
                  values={{
                    part1: (
                      <strong>
                        <UiText message={"Replace"} />
                      </strong>
                    ),
                  }}
                />
              </span>
            }
          >
            {replaceAllInstancesMenuItems}
          </Menu.SubMenu>,
        )}
      {shouldShowItem.replaceAllLinks &&
        menuSection(
          "replace",
          <Menu.SubMenu
            key="replaceAllLinks"
            title={
              <span>
                <UiText
                  message="{part1} all links to this page with..."
                  values={{
                    part1: (
                      <strong>
                        <UiText message={"Replace"} />
                      </strong>
                    ),
                  }}
                />
              </span>
            }
          >
            {replaceAllLinksMenuItems}
          </Menu.SubMenu>,
        )}
      {menuSection(
        "delete",
        <Menu.Item
          key="delete"
          onClick={onDelete}
          hidden={!shouldShowItem.delete}
        >
          <strong>
            <UiText message={"Delete"} />
          </strong>{" "}
          {getSiteItemTypeName(arena)}
        </Menu.Item>,
      )}
      {isAdmin &&
        menuSection(
          "debug",
          <Menu.SubMenu key="debug" title={uiT("Debug")}>
            {component && (
              <Menu.SubMenu
                key="site-splitting"
                title={uiT("Site-splitting utilities")}
              >
                {isPageComponent(component) && (
                  <Menu.Item
                    key="delete-preserve-links"
                    onClick={async () =>
                      studioCtx.changeObserved(
                        () => [
                          component,
                          ...componentsReferencerToPageHref(
                            studioCtx.site,
                            component,
                          ),
                        ],
                        () => {
                          studioCtx.tplMgr().removeComponentGroup([component], {
                            convertPageHrefToCode: true,
                          });
                          return ok();
                        },
                      )
                    }
                  >
                    <UiText
                      message="{part1} page, but convert PageHref to links"
                      values={{
                        part1: (
                          <strong>
                            <UiText message={"Delete"} />
                          </strong>
                        ),
                      }}
                    />
                  </Menu.Item>
                )}
              </Menu.SubMenu>
            )}
          </Menu.SubMenu>,
        )}
    </Menu>
  );
}

function getSiteItemTypeName(item: AnyArena) {
  if (isMixedArena(item)) {
    return "arena";
  } else if (isComponentArena(item)) {
    return "component";
  } else if (isPageArena(item)) {
    return "page";
  } else {
    return "folder";
  }
}
