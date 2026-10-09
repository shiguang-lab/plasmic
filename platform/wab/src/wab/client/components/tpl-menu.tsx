import { openNewTab } from "@/wab/client/cli-routes";
import { WritableClipboard } from "@/wab/client/clipboard/WritableClipboard";
import { isStyleClip } from "@/wab/client/clipboard/local";
import { makeFrameMenu } from "@/wab/client/components/frame-menu";
import {
  MenuBuilder,
  MenuItemContent,
} from "@/wab/client/components/menu-builder";
import {
  makeTplTextMenu,
  makeTplTextOps,
} from "@/wab/client/components/tpl-text-ops";
import { SlotsTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getVisibilityChoicesForTpl } from "@/wab/client/utils/tpl-client-utils";
import { MainBranchId } from "@/wab/shared/ApiSchema";
import { isMixedArena } from "@/wab/shared/Arenas";
import { HORIZ_CONTAINER_CAP, VERT_CONTAINER_CAP } from "@/wab/shared/Labels";
import {
  getAncestorSlotArg,
  isCodeComponentSlot,
  revertToDefaultSlotContents,
} from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import {
  asOne,
  ensure,
  ensureInstance,
  filterMapTruthy,
} from "@/wab/shared/common";
import {
  getAllowedWrapperComponents,
  isCodeComponent,
  isFrameComponent,
} from "@/wab/shared/core/components";
import { Selectable } from "@/wab/shared/core/selection";
import { SlotSelection } from "@/wab/shared/core/slots";
import {
  areSiblings,
  canConvertToSlot,
  canToggleVisibility,
  hasTextAncestor,
  isCodeComponentRoot,
  isTplColumn,
  isTplColumns,
  isTplComponent,
  isTplContainer,
  isTplNamable,
  isTplPicture,
  isTplSlot,
  isTplTag,
  isTplTagOrComponent,
  isTplTextBlock,
  tplChildrenOnly,
} from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import {
  PositionLayoutType,
  getContainerTypeName,
} from "@/wab/shared/layoututils";
import {
  TplNode,
  isKnownRenderExpr,
  isKnownTplSlot,
  isKnownVirtualRenderExpr,
} from "@/wab/shared/model/classes";
import { mkProjectLocation } from "@/wab/shared/route/app-routes";
import {
  isTplAutoSizable,
  isTplDefaultSized,
  resetTplSize,
} from "@/wab/shared/sizingutils";
import { canInsertAlias } from "@/wab/shared/ui-config-utils";
import {
  clearTplVisibility,
  getVisibilityLabel,
  hasVisibilitySetting,
} from "@/wab/shared/visibility-utils";
import { Menu, Tooltip, notification } from "antd";
import { ok } from "neverthrow";
import React from "react";

export function makeSelectableMenu(viewCtx: ViewCtx, node: Selectable) {
  if (node instanceof SlotSelection) {
    return makeSlotSelectionMenu(viewCtx, node);
  } else {
    return makeTplMenu(viewCtx, node.tpl);
  }
}

export function getContextMenuForFocusedTpl(viewCtx: ViewCtx) {
  const selectable = viewCtx.focusedSelectable();
  const hasMultiSelection = viewCtx.focusedSelectables().length > 1;
  if (
    !selectable ||
    (!hasMultiSelection &&
      viewCtx.getViewOps().isFocusedOnRootOfStretchFrame() &&
      isMixedArena(viewCtx.studioCtx.currentArena))
  ) {
    return makeFrameMenu({ viewCtx });
  } else {
    return makeSelectableMenu(viewCtx, selectable);
  }
}

export function makeTreeNodeMenu(
  viewCtx: ViewCtx,
  node: TplNode | SlotSelection,
  onMenuClick?: () => void,
) {
  if (!viewCtx.studioCtx.viewCtxs.includes(viewCtx)) {
    // This viewCtx has already been removed, so don't bother
    // creating the menu.  See https://app.clubhouse.io/plasmic/story/16260/type-error-after-deleting-frame
    // Can happen if we click on a menu item to delete the viewCtx.
    return <Menu />;
  }
  if (node instanceof SlotSelection) {
    return makeSlotSelectionMenu(viewCtx, node, onMenuClick);
  } else {
    return makeTplMenu(viewCtx, node, onMenuClick, {
      fromTplTreePanel: true,
    });
  }
}

export function makeSlotSelectionMenu(
  viewCtx: ViewCtx,
  node: SlotSelection,
  onMenuClick?: () => void,
) {
  const builder = new MenuBuilder();

  builder.genSection(undefined, (push) => {
    pushSlotSelectionMenu(viewCtx, node, push);
  });

  if (
    isAdminTeamEmail(
      viewCtx.appCtx.selfInfo?.email,
      viewCtx.studioCtx.appCtx.appConfig,
    )
  ) {
    builder.genSection(<UiText message={"Debug"} />, (push) => {
      const dom = viewCtx.renderState.sel2dom(
        node,
        viewCtx.canvasCtx,
        viewCtx.focusedCloneKey(),
      );
      push(
        <Menu.Item
          key="log"
          onClick={() => {
            console.log("SlotSelection", {
              component: viewCtx.currentComponent(),
              node,
              dom: dom ? dom[0] : undefined,
            });
          }}
        >
          <UiText message={"Log to console"} />
        </Menu.Item>,
      );
    });
  }

  return builder.build({ onMenuClick, menuName: "slot-selection-menu" });
}

function pushSlotSelectionMenu(
  viewCtx: ViewCtx,
  node: SlotSelection,
  push: (x: React.ReactNode) => void,
) {
  const tpl = ensure(
    node.toTplSlotSelection().tpl,
    "node to tpl slot selection must have a tpl",
  );
  const param = node.slotParam;
  const arg = viewCtx.variantTplMgr().getArg(tpl, param.variable);
  if (arg && isKnownRenderExpr(arg.expr) && arg.expr.tpl.length > 0) {
    push(
      <Menu.Item
        key="clear-slot"
        onClick={async () =>
          await viewCtx.getViewOps().tryDelete({ tpl: node })
        }
      >
        <UiText message={"Clear slot content"} />
      </Menu.Item>,
    );
  }

  if (
    !arg ||
    (isKnownRenderExpr(arg.expr) && !isKnownVirtualRenderExpr(arg.expr))
  ) {
    push(
      <Menu.Item
        key="restore-slot"
        onClick={() =>
          viewCtx.change(() => {
            revertToDefaultSlotContents(viewCtx.tplMgr(), tpl, param.variable);
          })
        }
      >
        <UiText message={"Revert to default slot content"} />
      </Menu.Item>,
    );
  }
}

export function makeTplMenu(
  viewCtx: ViewCtx,
  tpl: TplNode,
  onMenuClick?: () => void,
  opts?: {
    fromTplTreePanel?: boolean;
  },
) {
  if (isCodeComponentRoot(tpl) || isCodeComponentSlot(tpl)) {
    return null;
  }

  const focusedTpls = filterMapTruthy(viewCtx.focusedTpls(), (t) => t);
  const forMultipleTpls =
    focusedTpls.length > 1 && focusedTpls.some((ftpl) => ftpl === tpl);
  const tpls = forMultipleTpls ? focusedTpls : [tpl];

  const tryGetValNode = () => {
    const valNodes = viewCtx.maybeTpl2ValsInContext(tpl);
    return valNodes ? valNodes[0] : undefined;
  };

  const studioCtx = viewCtx.studioCtx;
  const arena = ensure(
    studioCtx.currentArena,
    "if you're making a tpl menu, you must be on an arena",
  );

  const builder = new MenuBuilder();
  const commentsCtx = viewCtx.studioCtx.commentsCtx;
  const component = viewCtx.currentComponent();
  const hasSiblings =
    tpl.parent && $$$(tpl.parent).children().toArray().length > 1;
  const isMarkerTpl = isTplTextBlock(tpl.parent);
  const isInsideRichText = hasTextAncestor(tpl);
  const positionType = isTplTag(tpl)
    ? viewCtx.getViewOps().getPositionType(tpl)
    : undefined;
  const contentEditorMode = studioCtx.contentEditorMode;
  const uiConfig = studioCtx.getCurrentUiConfig();
  const canInsertContext = { isContentCreator: contentEditorMode };

  if (
    hasSiblings &&
    positionType !== PositionLayoutType.fixed &&
    !isMarkerTpl &&
    !forMultipleTpls
  ) {
    builder.genSection(<UiText message={"Ordering"} />, (push) => {
      push(
        <Menu.Item
          key="MOVE_HOME"
          onClick={() => viewCtx.getViewOps().moveStart(tpl)}
        >
          <MenuItemContent shortcut={getComboForAction("MOVE_HOME")}>
            <UiText message={"Move to beginning of container"} />
          </MenuItemContent>
        </Menu.Item>,
      );
      push(
        <Menu.Item
          key="MOVE_LEFT"
          onClick={() => viewCtx.getViewOps().moveBackward(tpl)}
        >
          <MenuItemContent shortcut={getComboForAction("MOVE_LEFT")}>
            <UiText message={"Move to previous position in container"} />
          </MenuItemContent>
        </Menu.Item>,
      );
      push(
        <Menu.Item
          key="MOVE_RIGHT"
          onClick={() => viewCtx.getViewOps().moveForward(tpl)}
        >
          <MenuItemContent shortcut={getComboForAction("MOVE_RIGHT")}>
            <UiText message={"Move to next position in container"} />
          </MenuItemContent>
        </Menu.Item>,
      );
      push(
        <Menu.Item
          key="MOVE_END"
          onClick={() => viewCtx.getViewOps().moveEnd(tpl)}
        >
          <MenuItemContent shortcut={getComboForAction("MOVE_END")}>
            <UiText message={"Move to end of container"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    });
  }

  builder.genSection(<UiText message={"Edit"} />, (pushEdit) => {
    if (
      tpls.every(
        (_tpl) => isTplTag(_tpl) || isTplComponent(_tpl) || isTplSlot(tpl),
      ) &&
      areSiblings(tpls as TplNode[]) &&
      !isInsideRichText
    ) {
      const canWrapHStack = canInsertAlias(
        uiConfig,
        "hstack",
        canInsertContext,
      );
      const canWrapVStack = canInsertAlias(
        uiConfig,
        "vstack",
        canInsertContext,
      );
      if (canWrapHStack || canWrapVStack) {
        builder.genSub(<UiText message={"Wrap in container..."} />, (push3) => {
          if (canWrapHStack) {
            push3(
              <Menu.Item
                key="wrap-hstack"
                onClick={async () =>
                  await viewCtx.getViewOps().wrapInContainer("flex-row", tpls)
                }
              >
                <MenuItemContent shortcut={getComboForAction("WRAP_HSTACK")}>
                  {<UiLabel text={HORIZ_CONTAINER_CAP} />}
                </MenuItemContent>
              </Menu.Item>,
            );
          }
          if (canWrapVStack) {
            push3(
              <Menu.Item
                key="wrap-vstack"
                onClick={async () =>
                  await viewCtx
                    .getViewOps()
                    .wrapInContainer("flex-column", tpls)
                }
              >
                <MenuItemContent shortcut={getComboForAction("WRAP_VSTACK")}>
                  {<UiLabel text={VERT_CONTAINER_CAP} />}
                </MenuItemContent>
              </Menu.Item>,
            );
          }
        });
      }
    }

    const hasWrappableComponents =
      getAllowedWrapperComponents(studioCtx, component).length > 0;
    if (
      hasWrappableComponents &&
      tpls.every(
        (_tpl) => isTplTag(_tpl) || isTplComponent(_tpl) || isTplSlot(tpl),
      ) &&
      areSiblings(tpls as TplNode[]) &&
      !isInsideRichText
    ) {
      pushEdit(
        <Menu.Item
          key="wrap-component"
          onClick={async () => await viewCtx.getViewOps().wrapInComponent(tpls)}
        >
          <MenuItemContent>
            <UiText message={"Wrap in component"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    }

    // "Ungroup" may only be performed on a TplTag or TplComponent with children.
    const children =
      isTplTag(tpl) || isTplComponent(tpl) ? tplChildrenOnly(tpl) : false;
    if (
      children &&
      children.length > 0 &&
      !isTplColumns(tpl) &&
      !isTplColumn(tpl) &&
      !isInsideRichText
    ) {
      // Ungroup is disabled if the tpl is the root and has more than 1 child.
      // If the only child is a known slot, it is also disabled, because slots can't
      // be at the root of the component.
      const ungroupDisabled =
        !tpl.parent &&
        (children.length !== 1 ||
          (children.length === 1 && isKnownTplSlot(children[0])));
      pushEdit(
        <Menu.Item
          key="ungroup"
          onClick={() => viewCtx.getViewOps().ungroup(tpl)}
          disabled={ungroupDisabled}
        >
          <Tooltip
            open={
              ungroupDisabled
                ? undefined /* uncontrolled (show tooltip) */
                : false
            }
            title={
              <UiText
                message={
                  "Root element can only be ungrouped if it contains a single element"
                }
              />
            }
          >
            <UiText message={"Ungroup"} />
          </Tooltip>
        </Menu.Item>,
      );
    }

    if (
      isTplComponent(tpl) &&
      !isCodeComponent(tpl.component) &&
      studioCtx.canEditComponent(tpl.component) &&
      !forMultipleTpls
    ) {
      if (viewCtx.tplMgr().isOwnedBySite(tpl.component)) {
        pushEdit(
          <Menu.Item
            key="edit-component"
            onClick={() =>
              viewCtx.change(() => {
                const valNode = tryGetValNode();
                if (!valNode) {
                  notification.warning({
                    message:
                      "Cannot edit component in place when the component instance is invisible",
                  });
                  return;
                }
                viewCtx.enterComponentCtxForVal(
                  ensureInstance(valNode, ValComponent),
                  "menu",
                );
              })
            }
          >
            <MenuItemContent shortcut={getComboForAction("ENTER_EDIT")}>
              <UiText
                message="Edit component {name} in place"
                values={{ name: tpl.component.name }}
              />
            </MenuItemContent>
          </Menu.Item>,
        );

        if (isMixedArena(arena) && !contentEditorMode) {
          pushEdit(
            <Menu.Item
              key="edit-component-frame"
              onClick={() =>
                viewCtx.change(() =>
                  viewCtx.studioCtx
                    .siteOps()
                    .createNewFrameForMixedArena(tpl.component),
                )
              }
            >
              <MenuItemContent shortcut={getComboForAction("ENTER_EDIT_FRAME")}>
                <UiText message="Edit component in new artboard" />
              </MenuItemContent>
            </Menu.Item>,
          );
        }

        pushEdit(
          <Menu.Item
            key="open-dedicated-arena"
            onClick={() =>
              studioCtx.change(() => {
                studioCtx.switchToComponentArena(tpl.component);
                return ok();
              })
            }
          >
            <MenuItemContent
              shortcut={getComboForAction("GO_TO_COMPONENT_ARENA")}
            >
              <UiText message={"Go to component"} />{" "}
              <strong>{tpl.component.name}</strong>
            </MenuItemContent>
          </Menu.Item>,
        );
      } else {
        const dep = viewCtx.tplMgr().findProjectDepOwner(tpl.component);
        if (dep) {
          pushEdit(
            <Menu.Item
              key="open-imported-component"
              onClick={() => {
                openNewTab(
                  mkProjectLocation({
                    projectId: dep.projectId,
                    slug: tpl.component.name,
                    branchName: MainBranchId,
                    branchVersion: "latest",
                    branchRevision: undefined,
                    arenaType: "component",
                    arenaUuidOrNameOrPath: tpl.component.uuid,
                  }),
                );
              }}
            >
              <UiText
                message="Open component {name} in new tab"
                values={{ name: tpl.component.name }}
              />
            </Menu.Item>,
          );
        }
      }
    }

    if (!forMultipleTpls && isTplTextBlock(tpl)) {
      pushEdit(makeTplTextMenu(makeTplTextOps(viewCtx, tpl), viewCtx));
    }

    if (!forMultipleTpls && isTplContainer(tpl) && !contentEditorMode) {
      const { nextAutoLayoutType } = viewCtx
        .getViewOps()
        .getNextAutoLayoutInfo(tpl);
      pushEdit(
        <Menu.Item
          key="TOGGLE_AUTOLAYOUT"
          onClick={() =>
            viewCtx.change(() => viewCtx.getViewOps().toggleAutoLayout(tpl))
          }
        >
          <MenuItemContent shortcut={getComboForAction("TOGGLE_AUTOLAYOUT")}>
            <UiLabel
              text={`Change to ${getContainerTypeName(nextAutoLayoutType)}`}
            />
          </MenuItemContent>
        </Menu.Item>,
      );

      if (!(
        positionType === PositionLayoutType.fixed ||
        positionType === PositionLayoutType.sticky
      )) {
        pushEdit(
          <Menu.Item
            key="CONVERT_TO_RCOLUMNS"
            onClick={() =>
              viewCtx.change(() =>
                viewCtx.getViewOps().convertToResponsiveColumns(tpl),
              )
            }
          >
            <MenuItemContent>
              <UiText message={"Convert to Responsive Columns"} />
            </MenuItemContent>
          </Menu.Item>,
        );
      }
    }
    if (!forMultipleTpls && isTplTagOrComponent(tpl) && !contentEditorMode) {
      if (
        !isTplDefaultSized(tpl, viewCtx.variantTplMgr()) &&
        isTplAutoSizable(tpl, viewCtx.variantTplMgr())
      ) {
        pushEdit(
          <Menu.Item
            key="autosize"
            onClick={() =>
              viewCtx.change(() => {
                resetTplSize(tpl, viewCtx.variantTplMgr());
              })
            }
          >
            <MenuItemContent shortcut={getComboForAction("AUTOSIZE")}>
              <UiText message={"Auto-size"} />
            </MenuItemContent>
          </Menu.Item>,
        );
      }
    }

    if (
      !forMultipleTpls &&
      canToggleVisibility(tpl, viewCtx) &&
      !contentEditorMode
    ) {
      builder.genSub(<UiText message={"Set visibility..."} />, (push3) => {
        const choices = getVisibilityChoicesForTpl(viewCtx, tpl);
        choices.forEach((choice) => {
          push3(
            <Menu.Item
              onClick={() => {
                viewCtx.change(() => {
                  viewCtx.getViewOps().setTplVisibility(tpl, choice);
                });
              }}
            >
              <MenuItemContent>
                <UiLabel text={getVisibilityLabel(choice)} />
              </MenuItemContent>
            </Menu.Item>,
          );
        });
        const vs = viewCtx.variantTplMgr().tryGetTargetVariantSetting(tpl);
        if (vs && hasVisibilitySetting(vs)) {
          builder.genSection(undefined, (push4) => {
            push4(
              <Menu.Item
                key="clear-visibility"
                onClick={() =>
                  viewCtx.change(() =>
                    clearTplVisibility(
                      tpl,
                      viewCtx
                        .variantTplMgr()
                        .getTargetVariantComboForNode(tpl, {
                          forVisibility: true,
                        }),
                    ),
                  )
                }
              >
                <MenuItemContent>
                  <UiText message={"Unset"} />
                </MenuItemContent>
              </Menu.Item>,
            );
          });
        }
      });
    }

    if (
      !forMultipleTpls &&
      (isTplTag(tpl) || isTplComponent(tpl) || isTplSlot(tpl))
    ) {
      pushEdit(
        <Menu.Item
          key="convert-link"
          onClick={() => {
            viewCtx.change(() => {
              viewCtx.getViewOps().convertToLink(tpl);
            });
          }}
        >
          <MenuItemContent shortcut={getComboForAction("CONVERT_LINK")}>
            <UiText message={"Convert to a link"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    }
  });

  if (
    !forMultipleTpls &&
    viewCtx.tplMgr().canExtractComponent(tpl) &&
    !contentEditorMode
  ) {
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item
          key="extract-component"
          onClick={() => viewCtx.getViewOps().extractComponent(tpl)}
        >
          <MenuItemContent shortcut={getComboForAction("EXTRACT_COMPONENT")}>
            <UiText message={"Create component"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    });
  }

  if (
    !forMultipleTpls &&
    !isFrameComponent(component) &&
    !isCodeComponent(component) &&
    !contentEditorMode
  ) {
    builder.genSection(
      <>
        <UiText message={"Component"} /> <code>{component.name}</code>
      </>,
      (push) => {
        if (canConvertToSlot(tpl)) {
          push(
            <Menu.Item
              key="make-slot"
              onClick={() =>
                viewCtx.change(() => viewCtx.getViewOps().convertToSlot(tpl))
              }
            >
              <LabelWithDetailedTooltip tooltip={<SlotsTooltip />}>
                <UiText message={"Convert to a slot target"} />
              </LabelWithDetailedTooltip>
            </Menu.Item>,
          );
        }

        if (isTplSlot(tpl)) {
          push(
            <Menu.Item
              key="de-slot"
              onClick={() => {
                viewCtx.change(() => {
                  $$$(tpl).replaceWithMultiple(tpl.defaultContents);
                });
              }}
            >
              <MenuItemContent>
                <UiText message={"De-slot"} />
              </MenuItemContent>
            </Menu.Item>,
          );
        }
      },
    );
  }

  if (!forMultipleTpls && !contentEditorMode) {
    builder.genSection(undefined, (_push) => {
      builder.genSub(<UiText message={"Convert to..."} />, (push2) => {
        if (isTplPicture(tpl)) {
          push2(
            <Menu.Item
              key="convert-to-image-container"
              onClick={() =>
                viewCtx.change(() =>
                  viewCtx.getViewOps().convertPictureToContainer(tpl),
                )
              }
            >
              <UiText message={"A container with this background image"} />
            </Menu.Item>,
          );
        }

        if (isTplTextBlock(tpl) && !isInsideRichText) {
          push2(
            <Menu.Item
              key="make-container"
              onClick={() =>
                viewCtx.change(() =>
                  viewCtx.getViewOps().convertTextBlockToContainer(tpl, true),
                )
              }
            >
              <UiText message={"A container with this text"} />
            </Menu.Item>,
          );
        }
      });
    });
  }

  builder.genSection(undefined, (_push) => {
    if (
      !forMultipleTpls &&
      (isTplTag(tpl) || (isTplComponent(tpl) && isCodeComponent(tpl.component)))
    ) {
      const exp = viewCtx.effectiveCurrentVariantSetting(tpl).rsh();
      builder.genSub(<UiText message={"Copy..."} />, (push2) => {
        if (exp.has("background") && exp.get("background") !== "none") {
          push2(
            <Menu.Item
              key="copy-image"
              onClick={() =>
                viewCtx.change(() => viewCtx.getViewOps().copyBgImageStyle(tpl))
              }
            >
              <UiText message={"Copy image as background"} />
            </Menu.Item>,
          );
        }
        push2(
          <Menu.Item
            key="copy"
            onClick={async () =>
              viewCtx.studioCtx.copy(
                WritableClipboard.fromNavigatorClipboard(),
                viewCtx,
              )
            }
          >
            <MenuItemContent shortcut={getComboForAction("COPY")}>
              <UiText message={"Copy"} />
            </MenuItemContent>
          </Menu.Item>,
        );
        if (tpl.parent) {
          push2(
            <Menu.Item
              key="cut"
              onClick={async () =>
                viewCtx.studioCtx.cut(
                  WritableClipboard.fromNavigatorClipboard(),
                  viewCtx,
                )
              }
            >
              <MenuItemContent shortcut={getComboForAction("CUT")}>
                <UiText message={"Cut"} />
              </MenuItemContent>
            </Menu.Item>,
          );
        }
        push2(
          <Menu.Item
            key="paste"
            onClick={async () => {
              const clipboard = await viewCtx.studioCtx.readClipboardForPaste();
              await viewCtx.studioCtx.paste(clipboard);
            }}
          >
            <MenuItemContent shortcut={getComboForAction("PASTE")}>
              <UiText message={"Paste"} />
            </MenuItemContent>
          </Menu.Item>,
        );
        push2(
          <Menu.Item
            key="paste-as-sibling"
            onClick={async () => {
              await viewCtx.studioCtx.pasteAsSibling();
            }}
          >
            <MenuItemContent shortcut={getComboForAction("PASTE_AS_SIBLING")}>
              <UiText message={"Paste as sibling"} />
            </MenuItemContent>
          </Menu.Item>,
        );
        push2(
          <Menu.Item
            key="copy-style"
            onClick={() =>
              viewCtx.change(() => viewCtx.getViewOps().copyStyle(tpl))
            }
          >
            <MenuItemContent shortcut={getComboForAction("COPY_ELEMENT_STYLE")}>
              <UiText message={"Copy style"} />
            </MenuItemContent>
          </Menu.Item>,
        );
      });
      builder.genSub(<UiText message={"Paste..."} />, (push2) => {
        const clip = viewCtx.getViewOps().clipboard().contents();
        if (clip && isStyleClip(clip)) {
          if (
            asOne(clip.cssProps["background"]) &&
            asOne(clip.cssProps["background"]) !== "none"
          ) {
            push2(
              <Menu.Item
                key="paste-image"
                onClick={async () => {
                  const styleProps = await viewCtx
                    .getViewOps()
                    .getPasteStylePropsFromClipboard(tpl, ["background"]);

                  viewCtx.change(() =>
                    viewCtx.getViewOps().pasteStyleClip(styleProps),
                  );
                }}
              >
                <UiText message={"Paste background image"} />
              </Menu.Item>,
            );
          }
          push2(
            <Menu.Item
              key="paste-style"
              onClick={async () => {
                const styleProps = await viewCtx
                  .getViewOps()
                  .getPasteStylePropsFromClipboard(tpl);
                viewCtx.change(() =>
                  viewCtx.getViewOps().pasteStyleClip(styleProps),
                );
              }}
            >
              <MenuItemContent
                shortcut={getComboForAction("PASTE_ELEMENT_STYLE")}
              >
                <UiText message={"Paste style"} />
              </MenuItemContent>
            </Menu.Item>,
          );
        }
      });
    }
  });

  const ancestorSlotArg = getAncestorSlotArg(tpl);
  if (!forMultipleTpls && ancestorSlotArg) {
    const { tplComponent, arg } = ancestorSlotArg;
    const slotSelection = new SlotSelection({
      tpl: tplComponent,
      slotParam: arg.param,
    });
    builder.genSection(
      <>
        <UiText message={"Prop"} /> <code>{tplComponent.component.name}</code>.
        <code>{arg.param.variable.name}</code>
      </>,
      (push) => {
        pushSlotSelectionMenu(viewCtx, slotSelection, push);
      },
    );
  }

  builder.genSection(undefined, (push) => {
    if (!forMultipleTpls && isTplNamable(tpl)) {
      const isFromTplTreePanel = opts?.fromTplTreePanel;
      push(
        <Menu.Item
          key="rename-element"
          onClick={() => {
            viewCtx.change(() => viewCtx.setStudioFocusByTpl(tpl));
            if (isFromTplTreePanel) {
              viewCtx.studioCtx.startRenamingOnPanel();
            } else {
              viewCtx.studioCtx.tryStartRenamingFocused();
            }
          }}
        >
          <MenuItemContent
            shortcut={
              isFromTplTreePanel
                ? undefined
                : getComboForAction("RENAME_ELEMENT")
            }
          >
            <UiText message={"Rename"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    }
  });

  // "Delete" may only be performed on a non-root element.
  if (tpl.parent) {
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item
          key="delete"
          onClick={async () =>
            await viewCtx.getViewOps().tryDelete({
              tpl: tpls,
              forceDelete: true,
            })
          }
        >
          <MenuItemContent shortcut={getComboForAction("DELETE")}>
            <UiText message={"Delete"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    });
  }

  builder.genSection(undefined, (push) => {
    push(
      <Menu.Item
        key="zoom-to-fit-selection"
        onClick={() => studioCtx.tryZoomToFitTpl(tpl)}
      >
        <MenuItemContent shortcut={getComboForAction("ZOOM_TO_SELECTION")}>
          <UiText message={"Zoom to fit"} />
        </MenuItemContent>
      </Menu.Item>,
    );
  });

  if (studioCtx.showComments() && isTplNamable(tpl)) {
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item
          key="add-comment"
          onClick={() => commentsCtx.openNewCommentDialog(viewCtx, tpl)}
        >
          <MenuItemContent>
            <UiText message={"Add comment"} />
          </MenuItemContent>
        </Menu.Item>,
      );
    });
  }

  if (
    isAdminTeamEmail(
      viewCtx.appCtx.selfInfo?.email,
      viewCtx.studioCtx.appCtx.appConfig,
    )
  ) {
    builder.genSection(<UiText message={"Debug"} />, (push) => {
      const maybeVal = viewCtx.renderState.tpl2bestVal(
        tpl,
        viewCtx.focusedCloneKey(),
      );
      const dom = maybeVal
        ? viewCtx.renderState.sel2dom(maybeVal, viewCtx.canvasCtx)
        : undefined;
      push(
        <Menu.Item
          key="logTpl"
          onClick={() => {
            console.log("TPL", {
              component: viewCtx.currentComponent(),
              tpl,
              dom: dom ? dom[0] : undefined,
              val: maybeVal,
            });
          }}
        >
          <UiText message={"Log to console"} />
        </Menu.Item>,
      );
    });
  }

  return builder.build({ onMenuClick, menuName: "tpl-menu" });
}
