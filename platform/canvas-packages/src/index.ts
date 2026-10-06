// This package is for bundling packages that should run in the canvas frames.
// Those packages need to use the same React as the code components, provided by
// artboardWindow.__Sub.React, so we bundle all those packages here taking
// __Sub.React and __Sub.ReactDOM globals as parameters with rollup, and
// evaluate the generated javascript when each frame loads (but we can fetch the
// code only once when the project loads and store it as a string).

import {
  nativeAntd6,
  nativeAntd6EnUS,
  nativeAntd6ZhCN,
  StudioControlsProvider,
} from "@shiguang-lab/plasmic-antd6";
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

// Types copied from subdeps.ts to verify compatibility
// TODO: wab should depend on canvas-packages
interface CanvasPkgs {
  StudioControlsProvider: typeof StudioControlsProvider;
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
  ) => (restProps: Omit<ModalProps, InternalModalProps>) => JSX.Element;
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
  StudioControlsProvider,
  Antd6: (window as any).__Sub.Antd6 ?? {
    ...nativeAntd6,
    localeZhCN: nativeAntd6ZhCN,
    localeEnUS: nativeAntd6EnUS,
  },
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
