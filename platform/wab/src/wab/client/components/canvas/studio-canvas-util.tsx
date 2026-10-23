import { PublicLink } from "@/wab/client/components/PublicLink";
import { getComponentByPath } from "@/wab/client/components/live/PreviewCtx";
import { LinkButton } from "@/wab/client/components/widgets";
import * as domMod from "@/wab/client/dom";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { Fiber } from "@/wab/client/react-global-hook/fiber";
import {
  getMostRecentFiberVersion,
  globalHookCtx,
} from "@/wab/client/react-global-hook/globalHook";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isAbsoluteUrl } from "@/wab/commons/urls";
import { CustomError, hackyCast, unexpected } from "@/wab/shared/common";
import { PageComponent } from "@/wab/shared/core/components";
import { InteractionArgLoc, InteractionLoc } from "@/wab/shared/core/exprs";
import { getMatchingPagePathParams } from "@/wab/shared/utils/url-utils";
import { message, notification } from "antd";
import React from "react";
import { ok } from "neverthrow";

export function hasLinkedSelectable(x: JQuery, viewCtx: ViewCtx) {
  return x.toArray().some((elt) => {
    const key = Object.keys(elt).find(
      (k) =>
        k.startsWith("__reactInternalInstance$") ||
        k.startsWith("__reactFiber$"),
    );
    if (!key) {
      return false;
    }
    let fiber: Fiber | null = getMostRecentFiberVersion(elt[key] as Fiber);
    const hasSelectable = (node: Fiber) =>
      !!globalHookCtx.fiberToVal.get(node) ||
      !!globalHookCtx.fiberToSlotPlaceholderKeys.get(node);
    let hasInstance = hasSelectable(fiber);
    if (hasInstance) {
      return true;
    }
    // The ValNode might be passed to the enclosing component that rendered
    // this element, so go up in the Fiber tree.
    fiber = fiber.return;
    while (fiber) {
      fiber = getMostRecentFiberVersion(fiber);
      if (viewCtx.isElement(fiber.stateNode)) {
        // Exit if we hit another DOM node
        break;
      }
      hasInstance = hasSelectable(fiber);
      if (hasInstance) {
        return true;
      }
      fiber = fiber.return;
    }
    return false;
  });
}

// Nodes with `data-nonselectable` are ignored in closestTaggedNonTextDomElt
// when excludeNonSelectable opt is used. That is used to avoid hovering
// nodes inside rich text blocks that are being edited.
function isNonSelectable(x: JQuery) {
  return !!x[0].dataset.nonselectable;
}

export function closestTaggedNonTextDomElt(
  start: JQuery,
  viewCtx: ViewCtx,
  opts?: {
    dir?: "up" | "down";
    excludeNonSelectable?: boolean;
    excludeSelf?: boolean;
  },
): JQuery | null {
  opts = opts || {};
  const dir = opts.dir || "up";
  const excludeNonSelectable = opts.excludeNonSelectable || false;
  const gen = (() => {
    switch (dir) {
      case "up":
        return domMod.ancestors(start, opts.excludeSelf);
      case "down":
        return domMod.bfs(start, opts.excludeSelf);
      default:
        return unexpected();
    }
  })();
  for (const x of gen) {
    if (
      hasLinkedSelectable(x, viewCtx) &&
      (!excludeNonSelectable || !isNonSelectable(x))
    ) {
      return x;
    }
  }
  return null;
}

class NonValNodeError extends CustomError {}

export function closestNonText(x: JQuery<any>, viewCtx: ViewCtx) {
  let spanCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const isSpan = x.is("span");
    const isText =
      domMod.tag(x) === "" ||
      (spanCount === 0 && isSpan && x.hasClass("__wab_text"));
    if (isSpan) {
      spanCount += 1;
    }
    if (!isText) {
      break;
    }
    x = x.parent();
  }
  if (!hasLinkedSelectable(x, viewCtx)) {
    throw new NonValNodeError(
      "not a DOM element generated from a TplNode/ValNode",
    );
  }
  return x;
}

/**
 * Find nearest non-text-node
 */
export function closestTag(x: JQuery<any>) {
  while (domMod.tag(x) === "" || x.is("div.structure")) {
    x = x.parent();
  }
  return x;
}

export function absorbLinkClick(
  e: JQuery.UIEventBase | Event,
  onAnchorClick?: (href: string) => void,
) {
  let cur = e.target as HTMLElement | null;
  while (cur) {
    if (cur.tagName.toLowerCase() === "a" && cur.attributes["href"]?.value) {
      const href: string = cur.attributes["href"].value;
      e.preventDefault();
      // A bare "#" is a placeholder for a link driven by its onClick.
      if (href !== "#") {
        onAnchorClick?.(href);
        e.stopPropagation();
      }
      return;
    }
    cur = cur.parentElement;
  }
}

export function studioMode(studioCtx: StudioCtx) {
  // check preview and API explorer mode first since interactive mode might also be true even though preview mode is showing on top
  if (studioCtx.previewCtx?.isLive || studioCtx.previewCtx?.popup) {
    return "preview mode";
  } else if (studioCtx.isDocs) {
    return "API explorer";
  } else if (studioCtx.isInteractiveMode) {
    return "interactive mode";
  } else {
    unexpected("studio should be in interactive mode or preview mode");
  }
}

export function showCanvasPageNavigationNotification(
  studioCtx: StudioCtx,
  href: string,
) {
  const maybeFound = href ? getComponentByPath(studioCtx, href) : null;
  notification.info({
    key: "navigation-notification",
    message: translate(getUiLocale(), "Page navigation disabled"),
    description: (
      <div>
        <p>
          <UiText
            message={"The application tried to go to a different page{part1}."}
            values={{
              part1: href ? (
                <>
                  , <u>{href}</u>
                </>
              ) : null,
            }}
          />
        </p>
        {maybeFound ? (
          <p>
            <LinkButton
              onClick={async () => {
                await studioCtx.change(() => {
                  // Update the page param preview values on the page to match.
                  // TODO also handle query params
                  if (maybeFound.component.pageMeta) {
                    const pageComponent = hackyCast<PageComponent>(
                      maybeFound.component,
                    );
                    const paramValues = getMatchingPagePathParams(
                      pageComponent.pageMeta.path,
                      href,
                    );
                    if (paramValues) {
                      pageComponent.pageMeta.params = paramValues;
                    }
                  }

                  studioCtx.switchToComponentArena(maybeFound.component);
                  return ok();
                });
                notification.destroy("navigation-notification");
              }}
            >
              <UiText message={"Switch to editing that page"} />
            </LinkButton>
          </p>
        ) : null}
        {href && isAbsoluteUrl(href) && (
          <p>
            <PublicLink
              href={href}
              target={"_blank"}
              onClick={async () => {
                notification.destroy("navigation-notification");
              }}
            >
              <UiText message={"Open"} /> {href}{" "}
              <UiText message={"in a new tab"} />
            </PublicLink>
          </p>
        )}
      </div>
    ),
  });
}

export function showCanvasAuthNotification(
  mode: "preview mode" | "interactive mode",
) {
  notification.info({
    message: translate(
      getUiLocale(),
      mode === "preview mode"
        ? "Login and logout are not supported in preview mode"
        : "Login and logout are not supported in interactive mode",
    ),
    description: (
      <p>
        <UiText
          message={
            'Plasmic Studio detected and ignored a login or logout event. To view this artboard as a different user, click the "View as..." dropdown in the top bar.'
          }
        />
      </p>
    ),
  });
}

export function trapInteractionError(
  studioCtx: StudioCtx,
  loc: InteractionLoc | InteractionArgLoc,
  error: Error,
) {
  const found = studioCtx.tplMgr().findInteractionByUuid(loc.interactionUuid);
  console.error("Interaction failed", { location: loc, error });
  void message.error({
    key: "interaction-error",
    content: found
      ? translate(getUiLocale(), 'Could not run step "{step}".', {
          step: found.interaction.interactionName,
        })
      : translate(getUiLocale(), "Error in interaction"),
    duration: 4,
  });
}
