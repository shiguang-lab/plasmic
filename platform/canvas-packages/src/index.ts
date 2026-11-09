import { createCanvasComponentType, CanvasWrapper, CanvasIcon } from "./canvas-component-type";
// This package is for bundling packages that should run in the canvas frames.
// Those packages need to use the same React as the code components, provided by
// artboardWindow.__Sub.React, so we bundle all those packages here taking
// __Sub.React and __Sub.ReactDOM globals as parameters with rollup, and
// evaluate the generated javascript when each frame loads (but we can fetch the
// code only once when the project loads and store it as a string).

import type {
  nativeAntd6,
  nativeAntd6EnUS,
  nativeAntd6ZhCN,
} from "@shiguang-lab/plasmic-antd6/native";
import type { ThemeConfig } from "antd";
import type domAlign from "dom-align";
import { toPng } from "html-to-image";
import type React from "react";
import ResizeObserver from "resize-observer-polyfill";
import * as slate from "slate";
import * as slateDom from "slate-dom";
import * as slateHistory from "slate-history";
import * as slateReact from "slate-react";
import { GenericErrorBoundary } from "./error-boundary";
import { createModal } from "./modals";
import { SlateString } from "./slate-string";
import { CanvasFrame } from "./canvas-frame";
import { CanvasRoot } from "./canvas-root";
import { CanvasRenderSlot } from "./canvas-render-slot";
import { CanvasRichTextFrame, CanvasPlaceholder } from "./canvas-rich-text-frame";
import { CanvasTextEditor, CanvasSlateChildren, CanvasStoreProjection } from "./canvas-text";
import { CanvasObserver } from "./canvas-observer";
import { CanvasErrorBoundary, CanvasErrorDisplay } from "./canvas-error";
import { CustomPropValueEcho } from "./custom-prop-value-echo";

// Types copied from subdeps.ts to verify compatibility
// TODO: wab should depend on canvas-packages
interface CanvasPkgs {
  SlateString: typeof SlateString;
  CanvasFrame: typeof CanvasFrame;
  createCanvasComponentType: typeof createCanvasComponentType;
  CanvasWrapper: typeof CanvasWrapper;
  CanvasIcon: typeof CanvasIcon;
  CanvasRoot: typeof CanvasRoot;
  CanvasRenderSlot: typeof CanvasRenderSlot;
  CanvasRichTextFrame: typeof CanvasRichTextFrame;
  CanvasPlaceholder: typeof CanvasPlaceholder;
  CanvasTextEditor: typeof CanvasTextEditor;
  CanvasSlateChildren: typeof CanvasSlateChildren;
  CanvasStoreProjection: typeof CanvasStoreProjection;
  CanvasObserver: typeof CanvasObserver;
  CanvasErrorBoundary: typeof CanvasErrorBoundary;
  CanvasErrorDisplay: typeof CanvasErrorDisplay;
  CustomPropValueEcho: typeof CustomPropValueEcho;
  StudioControlsProvider: React.ComponentType<{ studioDocument: Document; theme: ThemeConfig | undefined; children?: React.ReactNode }>;
  Antd6: typeof nativeAntd6 & {
    localeZhCN: typeof nativeAntd6ZhCN;
    localeEnUS: typeof nativeAntd6EnUS;
  };
  ResizeObserver: typeof ResizeObserver;
  GenericErrorBoundary: React.ComponentType<{ className?: string }>;
  slate: typeof slate;
  slateDom: typeof slateDom;
  slateHistory: typeof slateHistory;
  slateReact: typeof slateReact;
  localElement?: typeof Element;
  createModal: (
    props: Pick<ModalProps, InternalModalProps>,
  ) => (restProps: Omit<ModalProps, InternalModalProps>) => React.JSX.Element;
  createThumbnail: (
    element: HTMLElement,
    opts?: {
      canvasWidth?: number;
      canvasHeight?: number;
      quality?: number;
      filter?: (elem: HTMLElement) => boolean;
      includeQueryParams?: boolean;
    },
  ) => Promise<string>;
}

type InternalModalProps =
  | "title"
  | "$"
  | "containerSelector"
  | "studioDocument"
  | "domAlign"
  | "popupWidth";

interface ModalProps {
  children?: React.ReactNode;
  title: string;
  containerSelector: string;
  $: typeof $;
  studioDocument: Document;
  onClose: () => void;
  show?: boolean;
  domAlign: typeof domAlign;
  popupWidth?: number;
}

const __CanvasPkgs: CanvasPkgs = {
  SlateString,
  CanvasFrame,
  createCanvasComponentType,
  CanvasWrapper,
  CanvasIcon,
  CanvasRoot,
  CanvasRenderSlot,
  CanvasRichTextFrame,
  CanvasPlaceholder,
  CanvasTextEditor, CanvasSlateChildren, CanvasStoreProjection,
  CanvasObserver,
  CanvasErrorBoundary,
  CanvasErrorDisplay,
  CustomPropValueEcho,
  StudioControlsProvider: (window as any).__Sub.StudioControlsProvider,
  Antd6: (window as any).__Sub.Antd6,
  ResizeObserver,
  GenericErrorBoundary,
  slate,
  slateDom,
  slateHistory,
  slateReact,
  localElement: typeof window !== "undefined" ? Element : undefined,
  createModal,
  createThumbnail: toPng,
};

(window as any).__CanvasPkgs = __CanvasPkgs;
