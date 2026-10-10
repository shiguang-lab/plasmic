import type { FullCodeEditor } from "@/wab/client/components/coding/FullCodeEditor";
import {
  SidebarModal,
  useMaybeSidebarModalContext,
} from "@/wab/client/components/sidebar/SidebarModal";
import {
  FileUploadLink,
  ObserverLoadable,
} from "@/wab/client/components/widgets";
import Button from "@/wab/client/components/widgets/Button";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { readUploadedFileAsText } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import { ensure, swallow } from "@/wab/shared/common";
import { tryEvalExpr } from "@/wab/shared/eval";
import {
  codeUsesGlobalObjects,
  tryCodeWritesToGlobalVariable,
} from "@/wab/shared/eval/expression-parser";
import { isValidJavaScriptCode } from "@/wab/shared/parser-utils";
import { hasUnexpected$$Usage } from "@/wab/shared/utils/regex-dollardollar";
import { Tooltip, notification } from "antd";
import { default as classNames } from "classnames";
import { jsonrepair } from "jsonrepair";
import { observer } from "mobx-react";
import React from "react";
import { FocusScope } from "react-aria";

const softStrSizeLimit = 500 * 1024; // 500KB
const hardStrSizeLimit = 5000 * 1024; // 5MB

export function checkStrSizeLimit(val: string) {
  if (val.length > hardStrSizeLimit) {
    notification.warning({
      message: <UiText message="Value is longer than 5MB" />,
      description: <UiText message="Please provide a shorter value." />,
    });
    return false;
  }
  if (val.length > softStrSizeLimit) {
    notification.warning({
      message: <UiText message="Value is longer than 500KB" />,
      description: (
        <UiText message="This long content will be embedded into your page, which will increase load time." />
      ),
    });
  }
  return true;
}

export function checkSyntaxError(val: string) {
  try {
    return (
      isValidJavaScriptCode(`(${val})`) ||
      isValidJavaScriptCode(val, { throwIfInvalid: true })
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      notification.warning({
        message: <UiText message="Syntax error" />,
        description: (
          <UiText
            message="The expression has a syntax error. Fix it before saving. {error}"
            values={{ error: err.message }}
          />
        ),
      });
      return false;
    }
  }

  return true;
}

export function checkDisallowedUseOfLibs(val: string) {
  if (hasUnexpected$$Usage(val)) {
    notification.warning({
      message: (
        <UiText
          message="Unexpected usage of {name}"
          values={{ name: <code>$$</code> }}
        />
      ),
      description: (
        <UiText
          message="The {name} object can only access libraries directly, for example {example}, to import libraries and functions into your code snippet. Do not use {name} as a regular variable."
          values={{ name: <code>$$</code>, example: <code>$$.libName</code> }}
        />
      ),
      duration: 20,
    });
    return false;
  }
  return true;
}

export function checkDisallowedStateBindingAssignment(val: string) {
  const writesToState = tryCodeWritesToGlobalVariable(val, "$state");
  if (writesToState === undefined) {
    notification.warning({
      message: <UiText message="Unsupported JavaScript syntax" />,
      description: <UiText message="This code cannot be analyzed safely." />,
    });
    return false;
  }
  if (writesToState) {
    notification.warning({
      message: <UiText message="Cannot reassign $state" />,
      description: (
        <UiText message="Update one of its properties instead, for example: $state.count = value." />
      ),
    });
    return false;
  }
  return true;
}

export function checkWindowGlobalUsage(val: string) {
  if (codeUsesGlobalObjects(val)) {
    notification.warning({
      message: <UiText message="Global object usage detected" />,
      description: (
        <UiText
          message="Using {window} or {global} in code expressions can cause issues during pre-rendering."
          values={{
            window: <code>window</code>,
            global: <code>globalThis</code>,
          }}
        />
      ),
      duration: 10,
    });
  }
  return true;
}

export const CodeEditor = observer(function CodeEditor(props: {
  title: string;
  value: string | {} | null | undefined;
  onChange: (value: string | null | undefined) => void;
  lang: "html" | "css" | "javascript" | "typescript" | "json" | "text";
  /**
   * Monaco file name to be used for this CodeEditor.
   * This should be globally unique to prevent state issues.
   */
  fileName?: string;
  defaultFullscreen?: boolean;
  isCustomCode?: boolean;
  saveAsObject?: boolean;
  requireObject?: boolean;
  data?: Record<string, any>;
  isDisabled?: boolean;
  disabledTooltip?: React.ReactNode;
  "data-plasmic-prop"?: string;
}) {
  const { t: uiT } = useI18n();
  const {
    value,
    onChange,
    lang,
    defaultFullscreen,
    isCustomCode,
    saveAsObject,
    requireObject,
    data,
    fileName,
  } = props;
  const stringValue =
    (lang === "json" && saveAsObject) || (value && typeof value === "object")
      ? swallow(() => JSON.stringify(value, undefined, 2))
      : (value as string | null | undefined);
  const [show, setShow] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(defaultFullscreen);
  const editor = React.useRef<FullCodeEditor>(null);
  const [draft, setDraft] = React.useState<string>();

  const sidebarModalContext = useMaybeSidebarModalContext();
  const useSidebarModal = sidebarModalContext && !fullscreen;

  const CodeModal = useSidebarModal ? SidebarModal : Modal;
  const codeModalRef = React.useRef(CodeModal);
  codeModalRef.current = CodeModal;
  let evaluatedValue: string | null | undefined = "";
  if (isCustomCode && data && value && typeof value !== "object") {
    const evalExpr = tryEvalExpr(value as string, data);
    evaluatedValue = evalExpr.err
      ? stringValue
      : swallow(() => JSON.stringify(evalExpr.val, undefined, undefined));
  } else {
    evaluatedValue = stringValue;
  }
  const onCancel = () => {
    // This function might be called if we are unmounting a Modal
    // to mount the other one
    if (codeModalRef.current === CodeModal) {
      setShow(false);
      setDraft(undefined);
      setFullscreen(defaultFullscreen);
      editor.current?.resetValue();
    } else {
      setDraft(editor.current?.getValue());
    }
  };
  const trySave = (val: string) => {
    if (!checkStrSizeLimit(val)) {
      return false;
    }
    if (lang === "json") {
      try {
        val = jsonrepair(val);
      } catch {}
    }
    if (lang === "json" && requireObject) {
      if (val[0] !== "{") {
        notification.warning({
          message: <UiText message="Invalid JSON object" />,
          description: (
            <UiText message="Only JSON objects (wrapped in {}) are supported." />
          ),
        });
        return false;
      }
    }
    if (lang === "json" && saveAsObject) {
      try {
        const jsonObj = JSON.parse(val);
        onChange(jsonObj);
        setDraft(undefined);
        return true;
      } catch (err) {
        notification.warning({
          message: <UiText message="Invalid JSON" />,
          description: `${err}`,
        });
        return false;
      }
    } else {
      if (lang === "javascript" || lang === "typescript") {
        checkWindowGlobalUsage(val);
      }
      onChange(val);
      setDraft(undefined);
      return true;
    }
  };
  const modalProps = useSidebarModal
    ? {
        show,
        onClose: onCancel,
      }
    : {
        open: show,
        width: 1024,
        styles: { body: { overflowX: "scroll" as const } },
        footer: null,
        onCancel,
      };

  return (
    <>
      <div
        className="code-editor-input"
        onClick={() => !props.isDisabled && setShow(true)}
        data-plasmic-prop={props["data-plasmic-prop"]}
      >
        <Tooltip title={props.isDisabled && props.disabledTooltip}>
          <span
            className={classNames("text-align-left", {
              "text-set": isCustomCode ? evaluatedValue : stringValue,
              "text-unset": !(isCustomCode ? evaluatedValue : stringValue),
            })}
          >
            {isCustomCode ? evaluatedValue : (stringValue ?? "unset")}
          </span>
        </Tooltip>
      </div>
      <CodeModal {...modalProps} title={props.title}>
        <MaybeWrap
          cond={fullscreen ?? false}
          wrapper={(x) => <FocusScope contain>{x}</FocusScope>}
        >
          <div
            style={{
              height: "auto",
              minHeight: fullscreen ? 512 : 350,
            }}
            className="flex-col"
          >
            {fullscreen && (
              <div className="mb-lg flex-col">
                <div className="mb-sm">
                  <UiText
                    message="Enter your content or {upload}."
                    values={{
                      upload: (
                        <FileUploadLink
                          onChange={async (files) => {
                            if (files === null || files.length === 0) {
                              return;
                            }
                            const file = files[0];
                            if (
                              file.type.startsWith("text/") ||
                              ["css", "html", "javascript", "json"].some(
                                (str) => file.type.includes(str),
                              )
                            ) {
                              const contents =
                                await readUploadedFileAsText(file);
                              trySave(contents);
                            } else {
                              notification.error({
                                message: (
                                  <UiText message="Unknown file format" />
                                ),
                                description: uiT(
                                  "Please make sure to upload a text file",
                                ),
                              });
                            }
                          }}
                        >
                          <UiText message={"upload a file"} />
                        </FileUploadLink>
                      ),
                    }}
                  />
                </div>
              </div>
            )}
            <ObserverLoadable
              loader={() =>
                import("@/wab/client/components/coding/FullCodeEditor").then(
                  ({ FullCodeEditor }) => FullCodeEditor,
                )
              }
              contents={(FullCodeEditor) => (
                <FullCodeEditor
                  ref={editor}
                  hideLineNumbers={true}
                  language={lang}
                  defaultValue={draft ?? stringValue ?? ""}
                  data={data}
                  onSave={trySave}
                  editorHeight={fullscreen ? 396 : 310}
                  fileName={fileName}
                />
              )}
            />
            <div className="flex flex-right mt-lg mr-xlg">
              <Button onClick={onCancel}>
                <UiText message={"Cancel"} />
              </Button>
              <Button
                className={"ml-lg"}
                onClick={() => {
                  if (
                    trySave(
                      ensure(
                        editor.current,
                        "Editor must exist to save",
                      ).getValue(),
                    )
                  ) {
                    setShow(false);
                    setDraft(undefined);
                  }
                }}
                type={"primary"}
                data-test-id={"save-code"}
              >
                <UiText message={"Save"} />
              </Button>
              {!fullscreen && (
                <Button
                  className={"ml-lg"}
                  onClick={() => {
                    codeModalRef.current = Modal;
                    setFullscreen(true);
                  }}
                  type={"primary"}
                >
                  <UiText message={"Fullscreen"} />
                </Button>
              )}
            </div>
          </div>
        </MaybeWrap>
      </CodeModal>
    </>
  );
});
