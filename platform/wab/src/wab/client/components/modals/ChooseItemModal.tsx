import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { UiText } from "@/wab/client/i18n/UiText";
import { Form, Radio } from "antd";
import * as React from "react";

export interface NamedItem<T> {
  name: string;
  item: T;
}

/**
 * Given a group of items, display a modal overlay that asks the user to choose
 * one. The promise will either return the chosen item or undefined
 * @param props
 * @returns
 */
export async function promptChooseItem<T>(props: {
  title: string;
  description?: string;
  group: NamedItem<T>[];
}): Promise<NamedItem<T> | undefined> {
  return showTemporaryPrompt<NamedItem<T> | undefined>((onSubmit, onCancel) => (
    <ChooseItemForm
      title={props.title}
      description={props.description}
      group={props.group}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  ));
}

function ChooseItemForm<T>(props: {
  title: string;
  description?: string;
  group: NamedItem<T>[];
  onSubmit: (data: NamedItem<T> | undefined) => void;
  onCancel: () => void;
}) {
  const { title, description, group, onSubmit, onCancel } = props;
  const [chosen, setChosen] = React.useState<NamedItem<T> | undefined>();
  const [form] = Form.useForm();
  const formId = React.useId();
  const onChange = (e) => {
    setChosen(e.target.value);
  };
  const radioStyle = {
    display: "block",
    height: "30px",
    lineHeight: "30px",
  };

  return (
    <Modal
      title={title}
      open={true}

      okButtonProps={{ htmlType: "submit", form: formId }}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
      onCancel={() => onCancel()}
    >
      {description && <p>{description}</p>}
      <Form id={formId} form={form} onFinish={() => onSubmit(chosen)}>
        <Form.Item required>
          <Radio.Group onChange={onChange} value={chosen}>
            {group.map((i) => (
              <Radio style={radioStyle} value={i}>
                {i.name}
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
