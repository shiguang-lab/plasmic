import { usePropExpressionInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { useQueryInteractionInputs } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs";
import { useStepCacheVersion } from "@/wab/client/studio-ctx/steps-cache-state";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import {
  CustomCodePreview,
  CustomFunctionExprPreview,
  ServerQueryOpSummary,
} from "@/wab/client/components/sidebar-tabs/ServerQuery/QueryResultPreview";
import { useServerQueryBottomModal } from "@/wab/client/components/sidebar-tabs/ServerQuery/ServerQueryBottomModal";
import Button from "@/wab/client/components/widgets/Button";
import { useI18n } from "@/wab/client/i18n";
import { extractDataCtx } from "@/wab/client/state-management/interactions-meta";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ServerQueryOp } from "@/wab/shared/codegen/react-p/server-queries/utils";
import { ExprCtx } from "@/wab/shared/core/exprs";
import { EventHandlerKeyType } from "@/wab/shared/core/tpls";
import {
  Component,
  Interaction,
  TplNode,
  isKnownCustomCode,
  isKnownCustomFunctionExpr,
} from "@/wab/shared/model/classes";
import * as React from "react";

/**
 * DataSourceOpPicker takes a `env` OR a tuple `{ viewCtx, tpl,
 * eventHandlerKey }` which the bottom modal uses to get the canvas
 * env. The latter is preferred because with the former the modal
 * does not react to changes in canvas env.
 */
type CustomFunctionEditorProps = {
  queryKey: string;
  queryName?: string;
  value?: ServerQueryOp;
  shouldOpenModal?: boolean;
  onChange: (value: ServerQueryOp) => void;
  onClose?: () => void;
  allowedOps?: string[];
  component?: Component;
  interaction?: Interaction;
} & (
  | {
      env: Record<string, any> | undefined;
    }
  | {
      viewCtx: ViewCtx | undefined;
      tpl: TplNode | undefined;
      eventHandlerKey: EventHandlerKeyType | undefined;
    }
);

export const CustomFunctionEditor = React.memo(function CustomFunctionEditor(props: CustomFunctionEditorProps) {
  const studio = useStudioCtx(), view = "viewCtx" in props ? props.viewCtx : undefined;
  const identity = props.component ?? props.interaction ?? props.value ?? view ?? studio.site;
  const world = useVariantModelWorld(studio, identity, view);
  return world.alive ? <CustomFunctionEditorContent {...props} isCurrent={world.isCurrent} /> : null;
});
const CustomFunctionEditorContent = React.memo(
  (props: CustomFunctionEditorProps & { isCurrent: () => boolean }) => {
    const { t: studioUiT } = useI18n();

    const {
      queryKey,
      value,
      onChange,
      onClose,
      allowedOps,
      component,
      isCurrent: _isCurrent,
      ...rest
    } = props;
    const { open, close } = useServerQueryBottomModal(queryKey);
    const studioCtx = useStudioCtx();
    const view = "viewCtx" in props ? props.viewCtx : undefined, tpl = "tpl" in props ? props.tpl : undefined, key = "eventHandlerKey" in props ? props.eventHandlerKey : undefined;
    usePropExpressionInputs(studioCtx, value ?? component ?? view ?? studioCtx, value, component);
    useQueryInteractionInputs(studioCtx, props.interaction, key, view);
    useStepCacheVersion(studioCtx); useCanvasRenderCount(view);
    const canvasEnv = useInspectorCanvasEnv(view, tpl);
    const subscribeFlags = React.useCallback((listener: () => void) => studioCtx.appCtx.subscribeUiEnvironmentInputs(listener), [studioCtx]);
    React.useSyncExternalStore(subscribeFlags, () => !!studioCtx.appCtx.appConfig.previewSteps, () => !!studioCtx.appCtx.appConfig.previewSteps);
    const projectFlags = studioCtx.projectFlags();
    // Identity-stable for useServerQueryOp's memo deps.
    const exprCtx: ExprCtx = React.useMemo(
      () => ({
        projectFlags,
        component: component ?? null,
        inStudio: true,
      }),
      [projectFlags, component],
    );

    const env =
      "env" in props
        ? props.env
        : props.viewCtx && props.tpl
          ? extractDataCtx(
              props.viewCtx,
              props.tpl,
              canvasEnv,
              props.interaction,
              props.eventHandlerKey,
            )
          : undefined;
    const currGlobalThis =
      "viewCtx" in props ? props.viewCtx?.canvasCtx.win() : undefined;

    return (
      <div className="flex-col fill-width">
        <Button
          id="configure-operation-btn"
          type="leftAligned"
          onClick={() => {
            if (!props.isCurrent()) { return; }
            open({
              value,
              onSave: (newExpr) => {
                if (!props.isCurrent()) { return; }
                onChange(newExpr);
                close();
                onClose?.();
              },
              onCancel: () => {
                if (!props.isCurrent()) { return; }
                close();
                onClose?.();
              },
              allowedOps,
              exprCtx,
              ...rest,
            });
          }}
          data-plasmic-prop="data-source-open-modal-btn"
        >
          {!value ? (
            studioUiT("Configure an operation")
          ) : (
            <ServerQueryOpSummary expr={value} />
          )}
        </Button>
        {value && isKnownCustomFunctionExpr(value) && (
          <CustomFunctionExprPreview
            expr={value}
            env={env}
            exprCtx={exprCtx}
            currGlobalThis={currGlobalThis}
          />
        )}
        {value && isKnownCustomCode(value) && (
          <CustomCodePreview queryUuid={queryKey} expr={value} env={env} />
        )}
      </div>
    );
  },
);
