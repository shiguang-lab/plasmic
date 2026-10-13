import { Modal } from "@/wab/client/components/widgets/Modal";
import { useFocusOnDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { Input, InputRef } from "antd";
import * as React from "react";
import { useRef, useState } from "react";

export type CmsEntryCloneModalProps = {
  open: boolean;
  disabled: boolean;
  defaultIdentifier: string;
  entryDisplayName: string;
  placeholderIdentifier: string | undefined;
  onClone: (newIdentifier: string) => void;
  onCancel: () => void;
};

export function CmsEntryCloneModal({
  open,
  disabled,
  entryDisplayName,
  defaultIdentifier,
  placeholderIdentifier,
  onClone,
  onCancel,
}: CmsEntryCloneModalProps) {
  const { t: studioUiT } = useI18n();

  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const ref = useRef<InputRef | null>(null);
  useFocusOnDisplayed(() => ref.current?.input, {
    autoFocus: true,
    selectAll: true,
  });
  return (
    <Modal
      title={studioUiT("Duplicate CMS entry")}
      open={open}
      okText={studioUiT("Duplicate")}
      okButtonProps={{
        disabled,
      }}
      onOk={() => onClone(identifier)}
      onCancel={onCancel}
    >
      <p>
        <UiText message={"Duplicate"} /> {entryDisplayName}
        <UiText
          message={
            "? This will create an unpublished duplicate of the entry and all its data."
          }
        />{" "}
      </p>
      <Input
        ref={ref}
        placeholder={placeholderIdentifier || studioUiT("Entry identifier")}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        onPressEnter={() => onClone(identifier)}
      />
    </Modal>
  );
}
