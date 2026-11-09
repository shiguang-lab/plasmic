import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useProjectData } from "@/wab/client/studio-ctx/project-data-react";
import { useShallow } from "zustand/react/shallow";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { useStudioOps } from "@/wab/client/components/sidebar-tabs/ComponentActionsSection";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { getRootSub } from "@/wab/client/frame-ctx/windows";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplComponent } from "@/wab/shared/model/classes";
import type {
  CustomControl,
  StudioOps,
} from "@plasmicapp/host/dist/prop-types";
import { ConfigProvider } from "antd";
import domAlign from "dom-align";
import $ from "jquery";
import React from "react";
import { Root } from "react-dom/client";

interface CustomPropEditorProps {
  viewCtx?: ViewCtx;
  tpl: TplComponent;
  value: any;
  onChange: (v: any) => void;
  impl: CustomControl<any>;
  componentPropValues: any;
  ccContextData: any;
  propName: string;
}

export function CustomPropEditor(props: CustomPropEditorProps) {
  const { viewCtx } = props;
  const InnerComp = viewCtx ? (
    <InnerCustomPropEditorWithViewCtx {...props} viewCtx={viewCtx} />
  ) : (
    <InnerCustomPropEditor {...props} />
  );
  return InnerComp;
}

function InnerCustomPropEditorWithViewCtx({
  impl,
  tpl,
  onChange,
  value,
  viewCtx,
  componentPropValues,
  ccContextData,
  propName,
}: CustomPropEditorProps & { viewCtx: ViewCtx }) {
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const [actionElement, setActionElement] = React.useState<HTMLDivElement | null>(null);
  const [propElement, setPropElement] = React.useState<HTMLDivElement | null>(null);
  const expsProvider = new TplExpsProvider(viewCtx, tpl);
  const sub = viewCtx.canvasCtx.Sub;
  const studioOps = useStudioOps(viewCtx, actionElement, tpl, expsProvider);
  useCustomPropEditor(
    sub,
    propElement,
    studioOps,
    value,
    onChange,
    impl,
    componentPropValues,
    ccContextData,
    propName,
  );

  return (
    <>
      <div ref={setActionElement} style={{ display: "contents" }} />
      <div ref={setPropElement} style={{ display: "contents" }} />
    </>
  );
}

function InnerCustomPropEditor({
  impl,
  onChange,
  value,
  componentPropValues,
  ccContextData,
  propName,
}: CustomPropEditorProps) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const sub = getRootSub();
  useCustomPropEditor(
    sub,
    container,
    null,
    value,
    onChange,
    impl,
    componentPropValues,
    ccContextData,
    propName,
  );

  return <div ref={setContainer} style={{ display: "contents" }} />;
}

// updateValue round trips asynchronously through the studio model before `value`
// reflects it, so rendering the control directly from `value` clobbers controlled
// inputs mid-flight. ValueEcho instead drives the control from local state, echoes
// of pending writes are ignored, while external `value` changes reset it.
function useCustomPropEditor(
  sub: SubDeps,
  container: HTMLDivElement | null,
  studioOps: StudioOps | null,
  value: any,
  onChange: (v: any) => void,
  impl: CustomControl<any>,
  componentPropValues: any,
  ccContextData: any,
  propName: string,
) {
  const root = React.useRef<Root | null>(null);
  const { theme } = React.useContext(ConfigProvider.ConfigContext);
  const studioCtx = useStudioCtx();
  const projectData = useProjectData(studioCtx);
  const FullscreenModal = React.useMemo(
    () =>
      sub.createModal({
        $,
        containerSelector: ".canvas-editor",
        title: propName,
        studioDocument: document,
        domAlign,
        popupWidth: 520,
      }),
    [sub, propName],
  );
  const SideModal = React.useMemo(
    () =>
      sub.createModal({
        $,
        containerSelector: ".canvas-editor__right-pane",
        title: propName,
        studioDocument: document,
        domAlign,
      }),
    [sub, propName],
  );

  React.useEffect(() => {
    if (!container) {
      return;
    }
    const mountedRoot = sub.ReactDOMClient.createRoot(container);
    root.current = mountedRoot;
    return () => {
      mountedRoot.unmount();
      root.current = null;
    };
  }, [sub, container]);

  React.useEffect(() => {
    if (!container) {
      return;
    }
    const renderElement = sub.React.createElement(
      sub.StudioControlsProvider,
      { studioDocument: container.ownerDocument, theme },
      sub.React.createElement(sub.GenericErrorBoundary,
      {
        className: "error-boundary",
      },
      sub.React.createElement(sub.CustomPropValueEcho, {
        impl,
        value,
        onChange,
        controlProps: {
          componentProps: componentPropValues,
          contextData: ccContextData,
          FullscreenModal,
          SideModal,
          studioOps,
          projectData,
          studioDocument: window.document,
        },
      })),
    );
    root.current?.render(renderElement);
  }, [
    container,
    value,
    componentPropValues,
    ccContextData,
    onChange,
    sub,
    theme,
    impl,
    FullscreenModal,
    SideModal,
    studioOps,
    projectData,
  ]);
}
