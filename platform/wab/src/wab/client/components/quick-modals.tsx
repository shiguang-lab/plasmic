import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import type { UsageSummary } from "@/wab/client/operations/delete-resources";
import { zIndex } from "@/wab/client/z-index";
import { joinReactNodes } from "@/wab/commons/components/ReactUtil";
import { FRAMES_CAP, FRAME_LOWER, MIXINS_CAP } from "@/wab/shared/Labels";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import { Form, Input } from "antd";
import { Rule } from "antd/lib/form";
import React from "react";
import ReactDOM from "react-dom";

/**
 * Shows a React element appended to the end of document.  As such, it is outside of
 * the usual React render tree, and would likely only make sense for absolutely-positioned
 * components that don't need to be part of the React context.  It's useful for showing
 * temporary pop-ups and one-offs.
 *
 * The function returns an object with a method `destroy()`, which must be called when
 * you are done to unmount the temporary widget.
 */
function showTemporaryWidget(children: React.ReactElement<any>) {
  const div = document.createElement("div");
  document.body.appendChild(div);
  function destroy() {
    const unmountResult = ReactDOM.unmountComponentAtNode(div);
    if (unmountResult && div.parentNode) {
      div.parentNode.removeChild(div);
    }
  }

  ReactDOM.render(<AntdConfigProvider>{children}</AntdConfigProvider>, div);
  return { destroy };
}

/**
 * Async function that shows a temporary widget to the user, asking for an answer to
 * something.  The user's response will be returned as a Promise from this function;
 * the response is undefined if the user chose not to answer.
 *
 * `children` is a function that takes in two argument functions, and returns the
 * temporary React component that asks the user the question.  The two arguments are:
 *
 * - onSubmit -- to be called with the answer to the prompt.
 * - onCancel -- to be called when the user declines to answer the prompt.
 *
 * Typical usage might look something like:
 *
 * const answer = await showTemporaryPrompt((onSubmit, onCancel) => (
 *   <MySpecialModal onSubmit={onSubmit} onCancel={onCancel} {...opts}/>
 * ));
 * @param children
 */
export async function showTemporaryPrompt<T>(
  children: (
    onSubmit: (val: T) => void,
    onCancel: () => void,
  ) => React.ReactElement<any>,
) {
  let modalResolve: (result?: T) => void;
  const promise = new Promise<T | undefined>((resolve) => {
    modalResolve = resolve;
  });
  const onSubmit = (val: T) => {
    modalResolve(val);
    temp.destroy();
  };
  const onCancel = () => {
    modalResolve(undefined);
    temp.destroy();
  };
  const node = children(onSubmit, onCancel);
  const temp = showTemporaryWidget(node);
  return promise;
}

export async function showTemporaryInfo(opts: {
  title: React.ReactNode;
  content: React.ReactNode;
  width?: number;
  onClose?: () => void;
}) {
  const { title, content, onClose, width } = opts;
  return showTemporaryPrompt<void>((onSubmit, onCancel) => (
    <Modal
      title={title}
      footer={null}
      onCancel={() => {
        onClose && onClose();
        onCancel();
      }}
      open
      width={width}
    >
      {content}
    </Modal>
  ));
}

export async function confirm(opts: {
  title?: React.ReactNode;
  message: React.ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const { title, message, danger, confirmLabel, cancelLabel } = opts;
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <Modal
      title={title}
      open
      onOk={() => onSubmit(true)}
      onCancel={onCancel}
      okText={<UiLabel text={confirmLabel ?? "Confirm"} />}
      cancelText={<UiLabel text={cancelLabel ?? "Cancel"} />}
      okButtonProps={{ danger, "data-test-id": "confirm" }}
      closable={false}
      zIndex={zIndex.quickModal}
    >
      {message}
    </Modal>
  ));
}

export const reactConfirm = confirm;

export async function alert(opts: {
  title?: React.ReactNode;
  message: React.ReactNode;
}) {
  const { title, message } = opts;
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <Modal
      title={title}
      open
      onOk={() => onSubmit(true)}
      onCancel={onCancel}
      okText={<UiText message="OK" />}
      footer={(_, { OkBtn }) => <OkBtn />}
      closable={false}
    >
      {message}
    </Modal>
  ));
}

export const reactAlert = alert;

/**
 * The same as confirm, except the user must type some confirmation message
 * before the "Confirm" button is enabled
 * @param opts
 * @returns
 */
export async function hardConfirm(opts: {
  title?: React.ReactNode;
  message: React.ReactNode;
  mustType: string;
}) {
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <HardConfirmForm {...opts} onSubmit={onSubmit} onCancel={onCancel} />
  ));
}

export const reactHardConfirm = hardConfirm;

function HardConfirmForm(props: {
  title?: React.ReactNode;
  message: React.ReactNode;
  mustType: string;
  onSubmit: (v: boolean) => void;
  onCancel: () => void;
}) {
  const { title, message, mustType, onSubmit, onCancel } = props;
  const [readySubmit, setReadySubmit] = React.useState(false);
  const [form] = Form.useForm();
  const formId = React.useId();
  return (
    <Modal
      title={title}
      open={true}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
      okButtonProps={{
        htmlType: "submit",
        form: formId,
        disabled: !readySubmit,
      }}
      onCancel={onCancel}
      closable={false}
    >
      <Form
        id={formId}
        form={form}
        onFinish={() => {
          if (readySubmit) {
            onSubmit(true);
          }
        }}
      >
        <Form.Item>{message}</Form.Item>
        <Form.Item>
          <Textbox
            name="input"
            defaultValue={""}
            placeholder={mustType}
            styleType={["bordered"]}
            autoFocus
            data-test-id="prompt"
            onChange={(e) => {
              if (!readySubmit && e.target.value === mustType) {
                setReadySubmit(true);
              } else if (readySubmit && e.target.value !== mustType) {
                setReadySubmit(false);
              }
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export type ReactPromptOpts = {
  title?: React.ReactNode;
  message: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  actionText?: React.ReactNode;
  rules?: Rule[];
};

export async function reactPrompt(opts: ReactPromptOpts) {
  return showTemporaryPrompt<string | undefined>((onSubmit, onCancel) => (
    <ReactPromptForm {...opts} onSubmit={onSubmit} onCancel={onCancel} />
  ));
}

function ReactPromptForm({
  title,
  message,
  defaultValue,
  actionText,
  placeholder,
  rules,
  onSubmit,
  onCancel,
}: ReactPromptOpts & {
  onSubmit: (value: string | undefined) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm<{ input?: string }>();
  return (
    <Modal
      title={title}
      open={true}
      width={400}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={actionText ?? <UiText message="Submit" />}
      cancelText={<UiText message="Cancel" />}
      wrapClassName="prompt-modal"
      zIndex={zIndex.quickModal}
    >
      <Form
        form={form}
        initialValues={{ input: defaultValue }}
        onFinish={(e) => {
          onSubmit(e.input ?? defaultValue ?? undefined);
        }}
        data-test-id="prompt-form"
        layout="vertical"
      >
        <Form.Item name="input" label={message} rules={rules}>
          <Input
            name="input"
            placeholder={placeholder}
            autoFocus
            data-test-id="prompt"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface StudioElement {
  uuid: string;
  name?: string;
}

export async function deleteStudioElementConfirm(
  title: string,
  usages: {
    element: StudioElement;
    summary: UsageSummary;
  }[],
  message?: React.ReactNode,
) {
  return await reactConfirm({
    title,
    message: (
      <>
        {usages.map(({ element, summary }) => (
          <p>
            {element.name ? (
              <strong>{element.name}</strong>
            ) : (
              <UiText message="It" />
            )}{" "}
            <UiText message={"is still being used in:"} />
            <ul>
              {makeUsageControl(
                "Components",
                summary.components?.map(getComponentDisplayName),
              )}
              {makeUsageControl(
                FRAMES_CAP,
                summary.frames?.map(
                  (frame) => frame.name || `unnamed ${FRAME_LOWER}`,
                ),
              )}
              {makeUsageControl(
                MIXINS_CAP,
                summary.mixins?.map((m) => m.name),
              )}
              {makeUsageControl(
                "Tokens",
                summary.styleTokens?.map((t) => t.name),
              )}
              {makeUsageControl(
                "Token Overrides",
                summary.styleTokenOverrides?.map((t) => t.token.name),
              )}
              {makeUsageControl(
                "Default Typography Styles",
                summary.themes?.map((t) => t.style.name),
              )}
              {makeUsageControl("Initial Styles", summary.addItemPrefs)}
            </ul>
          </p>
        ))}
        {message}
      </>
    ),
  });
}

const makeUsageControl = (usageName: string, names?: Array<string>) => {
  if (names === undefined || names.length === 0) {
    return null;
  }
  return (
    <li key={usageName}>
      <UiLabel text={usageName} />:{" "}
      <span className="asset-usage-items">
        {joinReactNodes(
          names.map((name, i) => <code key={i}>{name}</code>),
          ", ",
        )}
      </span>
    </li>
  );
};
