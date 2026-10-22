/**
 * DOM attribute set on an artboard canvas iframe's documentElement once its
 * initial render finished and no eval sync is pending. Desktop screenshot and
 * layout tools poll for it. It lives only on the editor iframe DOM, never in
 * the saved model.
 */
export const RENDER_READY_ATTR = "data-plasmic-render-ready";

export function setRenderReadyAttr(
  doc: Document | undefined,
  ready: boolean
) {
  const root = doc?.documentElement;
  if (!root) {
    return;
  }
  if (ready) {
    root.setAttribute(RENDER_READY_ATTR, "");
  } else {
    root.removeAttribute(RENDER_READY_ATTR);
  }
}

export function isRenderReady(state: {
  initialRenderReady: boolean;
  evalInProgress: boolean;
  pendingSyncs: number;
}) {
  return (
    state.initialRenderReady && !state.evalInProgress && state.pendingSyncs === 0
  );
}
