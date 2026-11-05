import { ensure } from "@/wab/shared/common";

/** The built-in editor owns its Host runtime; custom Hosts own their parent. */
export function isBuiltinStudioDocument() {
  return document.documentElement.getAttribute("data-plasmic-host") === "self";
}

export function getHostWindow(): Window {
  return isBuiltinStudioDocument()
    ? window
    : ensure(window.parent, "Missing Host window");
}

export function getTopFrameWindow(): Window {
  return ensure(getHostWindow().parent, "Missing top frame");
}
