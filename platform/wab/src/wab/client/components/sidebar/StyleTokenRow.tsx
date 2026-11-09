import { MenuBuilder } from "@/wab/client/components/menu-builder";
import ColorTokenControl from "@/wab/client/components/sidebar/ColorTokenControl";
import GeneralTokenControl from "@/wab/client/components/sidebar/GeneralTokenControl";
import { useStyleTokenControls } from "@/wab/client/components/sidebar/LeftGeneralTokensPanel";
import { useMultiAssetsActions } from "@/wab/client/components/sidebar/MultiAssetsActions";
import {
  TOKEN_ROW_HEIGHT,
  getLeftPadding,
} from "@/wab/client/components/sidebar/token-utils";
import ColorSwatch from "@/wab/client/components/style-controls/ColorSwatch";
import { Matcher } from "@/wab/client/components/view-common";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { UiActionsOverlay } from "@/wab/client/studio-ctx/ui/studio-ui-actions";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import {
  StyleTokenValue,
  isStyleTokenEditable,
} from "@/wab/commons/StyleToken";
import { spawn } from "@/wab/shared/common";
import {
  finalStyleTokensForDep,
  siteFinalStyleTokensOfType,
} from "@/wab/shared/core/site-style-tokens";
import {
  FinalToken,
  MutableToken,
  OverrideableToken,
} from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import { sortBy } from "lodash";
import { getStyleTokenScope, useStyleTokenInputs } from "@/wab/client/studio-ctx/style-token-inputs";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { ok } from "neverthrow";
import React from "react";

const StyleTokenRow = React.memo(function StyleTokenRowContent(props: {
  token: FinalToken<StyleToken>;
  tokenValue: StyleTokenValue;
  matcher: Matcher;
  indentMultiplier: number;
}) {
  const { token, tokenValue, matcher, indentMultiplier } = props;
  const studioCtx = useStudioCtx();
  const multiAssetsActions = useMultiAssetsActions();
  const { vsh, resolver, onDuplicate, onSelect, onDeleteOverride } =
    useStyleTokenControls();

  const helper = React.useMemo(() => vsh ?? new VariantedStylesHelper(), [vsh]);
  const snapshot = useStyleTokenInputs(studioCtx, token, helper, (value) => value);
  const scope = getStyleTokenScope(studioCtx, token);
  const isActive = () => !scope.owner.isDisposed && !scope.lifetime.aborted && scope.models === studioCtx.modelSnapshots;
  const { tokenPanelReadOnly, ...tokenUiConfig } = useStore(studioCtx.uiEnvironment.store, useShallow((state) => ({
    tokenPanelReadOnly: state.tokenPanelReadOnly,
    canOverrideImportedTokens: state.canOverrideImportedTokens,
    canOverrideRegisteredTokens: state.canOverrideRegisteredTokens,
  })));

  const onFindReferences = () => {
    spawn(
      studioCtx.change(() => {
                    if (!isActive()) { return ok(); }
        studioCtx.findReferencesStyleToken = token.base;
        return ok();
      }),
    );
  };

  const overlay = () => {
    const builder = new MenuBuilder();

    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item key="references" onClick={() => onFindReferences()}>
          <UiText message={"Find all references"} />
        </Menu.Item>,
      );
      if (
        !tokenPanelReadOnly &&
        isStyleTokenEditable(token, vsh, tokenUiConfig) &&
        token instanceof OverrideableToken
      ) {
        if (vsh && !vsh.isTargetBaseVariant()) {
          push(
            <Menu.Item key="varianted-override" onClick={() => { if (isActive()) { onSelect(token); } }}>
              <UiText message={"Override global variant value"} />
            </Menu.Item>,
          );
          if (snapshot?.hasOverride && !snapshot.styleInherited) {
            push(
              <Menu.Item
                key="remove-global-variant-value"
                onClick={async () => {
                  return studioCtx.change(() => {
                    if (!isActive()) { return ok(); }
                    vsh.removeVariantedValue(token);
                    return ok();
                  });
                }}
              >
                <UiText message={"Remove global variant override"} />
              </Menu.Item>,
            );
          }
        } else {
          push(
            <Menu.Item key="override" onClick={() => { if (isActive()) { onSelect(token); } }}>
              <UiText message={"Override value"} />
            </Menu.Item>,
          );
          if (snapshot?.hasOverrideValue) {
            push(
              <Menu.Item
                key="remove-override"
                onClick={() => { if (isActive()) { onDeleteOverride(token); } }}
              >
                <UiText message={"Remove override"} />
              </Menu.Item>,
            );
          }
        }
      }

      if (!tokenPanelReadOnly && token.isLocal) {
        push(
          <Menu.Item key="clone" onClick={() => { if (isActive()) { void onDuplicate(token.base); } }}>
            <UiText message={"Duplicate"} />
          </Menu.Item>,
        );
      }

      if (
        !tokenPanelReadOnly &&
        token instanceof MutableToken &&
        vsh &&
        !vsh.isTargetBaseVariant() &&
        !snapshot?.styleInherited
      ) {
        push(
          <Menu.Item
            key="remove-global-variant-value"
            onClick={async () => {
              return studioCtx.change(() => {
                    if (!isActive()) { return ok(); }
                vsh.removeVariantedValue(token);
                return ok();
              });
            }}
          >
            <UiText message={"Remove global variant value"} />
          </Menu.Item>,
        );
      }

      builder.genSection(undefined, () => {
        const pushTokens = (
          tokens: ReadonlyArray<FinalToken<StyleToken>>,
          push_: (x: React.ReactElement) => void,
        ) => {
          for (const tok of sortBy(tokens, (t) => t.name)) {
            if (tok.uuid !== token.uuid) {
              push_(
                <Menu.Item
                  key={tok.uuid}
                  onClick={() => {
                    if (isActive()) { spawn(studioCtx.siteOps().swapTokens(token.base, tok.base)); }
                  }}
                >
                  <div className="flex-row flex-vcenter gap-sm">
                    {tok.type === "Color" && (
                      <ColorSwatch color={resolver(tok, vsh)} />
                    )}
                    <div>{tok.name}</div>
                    <div className="flex-push-right">
                      <code className="text-ellipsis ml-ch">
                        {resolver(tok, vsh)}
                      </code>
                    </div>
                  </div>
                </Menu.Item>,
              );
            }
          }
        };
        builder.genSub(
          <UiText message={"Replace all usages of this token with..."} />,
          (push2) => {
            pushTokens(
              siteFinalStyleTokensOfType(studioCtx.site, token.type),
              push2,
            );
            for (const dep of studioCtx.site.projectDependencies) {
              builder.genSection(`Imported from "${dep.name}"`, (push3) => {
                pushTokens(
                  finalStyleTokensForDep(studioCtx.site, dep.site).filter(
                    (t) => t.type === token.type,
                  ),
                  push3,
                );
              });
            }
          },
        );
      });

      if (
        !tokenPanelReadOnly &&
        token instanceof MutableToken &&
        !multiAssetsActions.isSelecting
      ) {
        builder.genSection(undefined, (push2) => {
          push2(
            <Menu.Item
              key="bulk-select"
              onClick={() => {
                multiAssetsActions.onAssetSelected(token.uuid, true);
              }}
            >
              <UiText message={"Start bulk selection"} />
            </Menu.Item>,
          );
          push2(
            <Menu.Item
              key="delete"
              onClick={async () => {
                if (isActive()) { await studioCtx.siteOps().tryDeleteTokens([token.base]); }
              }}
            >
              <UiText message={"Delete"} />
            </Menu.Item>,
          );
        });
      }
    });
    return builder.build({
      onMenuClick: (e) => e.domEvent.stopPropagation(),
      menuName: "token-item-menu",
    });
  };

  const onToggle = React.useCallback(() => {
    if (multiAssetsActions.isSelecting) {
      const uuid = token.uuid;
      multiAssetsActions.onAssetSelected(
        uuid,
        !multiAssetsActions.isAssetSelected(uuid),
      );
    }
  }, [multiAssetsActions, token.uuid]);

  const indicatorType = snapshot?.indicatorType;

  const onClickHandler = (() => {
    if (multiAssetsActions.isSelecting) {
      return onToggle;
    }

    const isEditable =
      !tokenPanelReadOnly &&
      isStyleTokenEditable(token, vsh, tokenUiConfig);

    if (!isEditable) {
      // not editable, clicking should do nothing
      return undefined;
    }

    if (token instanceof OverrideableToken && indicatorType === "inherited") {
      // New overrides can only be created from context menu, so do nothing on direct click
      return undefined;
    }

    return () => { if (isActive()) { onSelect(token); } };
  })();

  if (!isActive() || !snapshot) { return null; }

  return (
    <>
      {token.type === "Color" && (
        <ColorTokenControl
          style={{
            height: TOKEN_ROW_HEIGHT,
            paddingLeft: getLeftPadding(indentMultiplier),
            cursor: onClickHandler ? "pointer" : "default",
          }}
          token={token}
          tokenValue={tokenValue}
          matcher={matcher}
          menu={overlay}
          onClick={onClickHandler}
          vsh={vsh}
          indicatorType={indicatorType}
        />
      )}

      {token.type !== "Color" && (
        <GeneralTokenControl
          style={{
            height: TOKEN_ROW_HEIGHT,
            paddingLeft: getLeftPadding(indentMultiplier),
            cursor: onClickHandler ? "pointer" : "default",
          }}
          token={token}
          tokenValue={tokenValue}
          menu={overlay}
          matcher={matcher}
          onClick={onClickHandler}
          vsh={vsh}
          indicatorType={indicatorType}
        />
      )}
      <UiActionsOverlay uiId={mkModelUiId(token.base)} />
    </>
  );
});

export default StyleTokenRow;
