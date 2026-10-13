import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { defaultComponentKinds } from "@/wab/shared/core/components";
import { naturalSort } from "@/wab/shared/sort";
import { Form, Select } from "antd";
import React from "react";

export function DefaultComponentKindModal<T>({
  onSubmit,
  onCancel,
}: {
  onSubmit: (val: T) => void;
  onCancel: () => void;
}) {
  const { t: uiT } = useI18n();
  const [form] = Form.useForm();
  const formId = React.useId();
  return (
    <Modal
      title={
        <h3>
          <UiText message={"Set as default component"} />
        </h3>
      }
      open

      okButtonProps={{ htmlType: "submit", form: formId }}
      okText={<UiText message="Submit" />}
      cancelText={<UiText message="Cancel" />}
      onCancel={() => onCancel()}
    >
      <Form
        id={formId}
        form={form}
        labelCol={{
          span: 3,
        }}
        onFinish={(values) => {
          onSubmit(values.kind);
        }}
      >
        <Form.Item
          name="kind"
          label={uiT("Kind")}
          rules={[
            {
              required: true,
            },
          ]}
        >
          <Select
            placeholder={uiT("Set as the default component for this category")}
          >
            {naturalSort(
              Object.entries(defaultComponentKinds),
              ([_kind, label]) => label,
            ).map(([kind, label]) => (
              <Select.Option value={kind}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
