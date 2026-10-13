import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { joinReactNodes } from "@/wab/commons/components/ReactUtil";
import {
  Component,
  ComponentDataQuery,
  ComponentServerQuery,
  Param,
  Site,
} from "@/wab/shared/model/classes";
import { Form } from "antd";
import { computed } from "mobx";
import { useLocalStore, useObserver } from "mobx-react";
import React from "react";

export interface ExtractComponentResponse {
  name: string;
}

export async function promptExtractComponent(props: {
  site: Site;
  containingComponent: Component;
  linkedParams: Param[];
  queriesToCreateProps: ComponentDataQuery[];
  serverQueriesToCreateProps: ComponentServerQuery[];
}) {
  return showTemporaryPrompt<ExtractComponentResponse>((onSubmit, onCancel) => (
    <ExtractComponentForm
      site={props.site}
      containingComponent={props.containingComponent}
      linkedParams={props.linkedParams}
      queriesToCreateProps={props.queriesToCreateProps}
      serverQueriesToCreateProps={props.serverQueriesToCreateProps}
      onSubmit={(resp) => onSubmit(resp)}
      onCancel={() => onCancel()}
    />
  ));
}

export function ExtractComponentForm(props: {
  site: Site;
  containingComponent: Component;
  linkedParams: Param[];
  queriesToCreateProps: ComponentDataQuery[];
  serverQueriesToCreateProps: ComponentServerQuery[];
  onSubmit: (resp: ExtractComponentResponse) => void;
  onCancel: () => void;
}) {
  const { t: uiT } = useI18n();
  const [form] = Form.useForm();
  const formId = React.useId();
  const {
    containingComponent,
    linkedParams,
    queriesToCreateProps,
    serverQueriesToCreateProps,
  } = props;

  const resp = useLocalStore<ExtractComponentResponse>(() => ({
    name: "",
    resurfaceParams: false,
  }));

  const validateName = (name: string) => {
    if (!name.trim()) {
      return undefined;
    }

    return undefined;
  };

  const errors = computed(() => ({
    name: validateName(resp.name),
  }));

  return useObserver(() => (
    <Modal
      title={<UiText message="Create new component" />}
      open
      onCancel={props.onCancel}
      okText={<UiText message="Create component" />}
      cancelText={<UiText message="Cancel" />}
      okButtonProps={{
        htmlType: "submit",
        form: formId,
        disabled: !resp.name || !!errors.get().name,
      }}
    >
      <Form
        id={formId}
        form={form}
        onFinish={(_e) => {
          if (resp.name && !errors.get().name) {
            props.onSubmit(resp);
          }
        }}
        layout="horizontal"
        data-test-id="extract-component-form"
      >
        <Form.Item
          label={uiT("Component name")}
          validateStatus={errors.get().name ? "error" : undefined}
          help={errors.get().name}
        >
          <Textbox
            onChange={(e) => (resp.name = e.target.value)}
            value={resp.name}
            autoFocus={true}
            placeholder={uiT("Enter the name of your new component")}
            data-test-id="extract-component-name"
            styleType={["bordered"]}
          />
        </Form.Item>
        {(linkedParams.length > 0 ||
          queriesToCreateProps.length > 0 ||
          serverQueriesToCreateProps.length > 0) &&
          !!containingComponent.name && (
            <div className="mb-xlg">
              <UiText
                message={"Your new component will also have props for {part1}."}
                values={{
                  part1: joinReactNodes(
                    [
                      ...linkedParams.map((s) => (
                        <code key={s.variable.name}>{s.variable.name}</code>
                      )),
                      ...queriesToCreateProps.map((q) => (
                        <code key={q.name}>{q.name}</code>
                      )),
                      ...serverQueriesToCreateProps.map((q) => (
                        <code key={q.name}>{q.name}</code>
                      )),
                    ],
                    ", ",
                  ),
                }}
              />
            </div>
          )}
      </Form>
    </Modal>
  ));
}
