import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { zIndex } from "@/wab/client/z-index";
import { Form, Input, InputRef, Typography } from "antd";
import React from "react";

export function ImportProjectModal(props: {
  onSubmit: (projectUrlOrId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form] = Form.useForm<{ projectUrlOrId: string }>();
  const inputRef = React.useRef<InputRef>(null);
  return (
    <Modal
      open
      title={t("Import project")}
      width={520}
      zIndex={zIndex.quickModal}
      okText={t("Import")}
      cancelText={t("Cancel")}
      onOk={() => form.submit()}
      onCancel={props.onCancel}
      afterOpenChange={(open) => open && inputRef.current?.focus()}
    >
      <Typography.Paragraph type="secondary">
        {t("Enter the ID or URL of the project you want to import.")}
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={({ projectUrlOrId }) => props.onSubmit(projectUrlOrId.trim())}
      >
        <Form.Item
          name="projectUrlOrId"
          label={t("Project ID or URL")}
          style={{ marginBottom: 0 }}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t("Please enter a project ID or URL."),
            },
          ]}
        >
          <Input
            ref={inputRef}
            autoFocus
            placeholder={t("Enter project ID or URL")}
            onPressEnter={(event) => {
              event.preventDefault();
              form.submit();
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function promptImportProject() {
  return showTemporaryPrompt<string>((onSubmit, onCancel) => (
    <ImportProjectModal onSubmit={onSubmit} onCancel={onCancel} />
  ));
}
