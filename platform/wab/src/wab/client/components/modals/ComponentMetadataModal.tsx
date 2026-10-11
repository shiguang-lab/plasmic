import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import Button from "@/wab/client/components/widgets/Button";
import { Modal } from "@/wab/client/components/widgets/Modal";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { Component } from "@/wab/shared/model/classes";
import { Form } from "antd";
import React from "react";

export default async function promptForMetadata(
  component: Component,
): Promise<{ key: string; value: string } | undefined> {
  type KeyValuePair = { key: string; value: string };
  const keyAndValue = await showTemporaryPrompt<KeyValuePair | undefined>(
    (onSubmit, onCancel) => (
      <MetadataForm
        component={component}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    ),
  );

  if (!keyAndValue || !keyAndValue?.key || !keyAndValue?.value) {
    return undefined;
  }
  keyAndValue.key = keyAndValue.key.trim();
  keyAndValue.value = keyAndValue.value.trim();
  console.log(keyAndValue.key, keyAndValue.value);
  return { key: keyAndValue.key, value: keyAndValue.value };
}

function MetadataForm({
  component,
  onSubmit,
  onCancel,
}: {
  component: Component;
  onSubmit: (value: { key: string; value: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      title={null}
      open={true}
      footer={null}
      onCancel={onCancel}
      closable={false}
      wrapClassName="prompt-modal"
    >
      <Form
        onFinish={(e) => {
          onSubmit({
            key: e.keyInput,
            value: e.valueInput,
          });
        }}
        data-test-id="prompt-form"
        layout="vertical"
      >
        <Form.Item
          name="keyInput"
          label={
            <UiText
              message={'Key for a new metadata for "{part1}":'}
              values={{ part1: component.name }}
            />
          }
        >
          <Textbox
            name="keyInput"
            placeholder={t("Metadata key")}
            styleType={["bordered"]}
            autoFocus
            data-test-id="prompt"
          />
        </Form.Item>
        <Form.Item
          name="valueInput"
          label={
            <UiText
              message={'Value for a new metadata for "{part1}":'}
              values={{ part1: component.name }}
            />
          }
        >
          <Textbox
            name="valueInput"
            placeholder={t("Metadata value")}
            styleType={["bordered"]}
            data-test-id="prompt"
          />
        </Form.Item>
        <Form.Item style={{ margin: 0 }}>
          <Button
            className="mr-sm"
            type="primary"
            htmlType="submit"
            data-test-id="prompt-submit"
          >
            <UiText message={"Confirm"} />
          </Button>
          <Button onClick={() => onCancel()}>
            <UiText message={"Cancel"} />
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
