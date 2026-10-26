import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import type { PenChoice } from "@/wab/client/pen-importer/types";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button } from "antd";
import React from "react";

export function PenFilePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (files: File[]) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const file = React.useRef<HTMLInputElement>(null);
  const folder = React.useRef<HTMLInputElement>(null);
  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length) {onSelect(files);}
  };
  return (
    <Modal
      open
      centered
      width={480}
      title={<UiText message="Import from Pen" />}
      onCancel={onCancel}
      footer={
        <Button onClick={onCancel}>
          <UiText message="Cancel" />
        </Button>
      }
    >
      <p>
        <UiText message="Choose a .pen file or ZIP. For designs with libraries, images or scripts, select the folder containing the design and its dependencies." />
      </p>
      <input
        hidden
        ref={file}
        type="file"
        accept=".pen,.zip"
        aria-label={t("Choose Pen file or ZIP")}
        onChange={change}
      />
      <input
        hidden
        ref={folder}
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        aria-label={t("Choose Pen folder")}
        onChange={change}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="primary" onClick={() => file.current?.click()}>
          <UiText message="Choose Pen file or ZIP" />
        </Button>
        <Button onClick={() => folder.current?.click()}>
          <UiText message="Choose Pen folder" />
        </Button>
      </div>
    </Modal>
  );
}

export function PenChoicePicker({
  choices,
  kind,
  onSelect,
  onCancel,
}: {
  choices: PenChoice[];
  kind: "file" | "canvas";
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open
      centered
      width={480}
      title={
        <UiText
          message={
            kind === "file"
              ? "Select Pen design to import"
              : "Select Pen canvas to import"
          }
        />
      }
      onCancel={onCancel}
      footer={
        <Button onClick={onCancel}>
          <UiText message="Cancel" />
        </Button>
      }
    >
      <Scrollbar
        scrollX={false}
        style={{ maxHeight: "min(320px, calc(100vh - 200px))" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {choices.map((choice) => (
            <Button
              key={choice.id}
              type="text"
              block
              onClick={() => onSelect(choice.id)}
              style={{
                textAlign: "left",
                justifyContent: "flex-start",
                height: "auto",
                whiteSpace: "normal",
              }}
            >
              {choice.name}
            </Button>
          ))}
        </div>
      </Scrollbar>
    </Modal>
  );
}

export function pickPenFiles() {
  return showTemporaryPrompt<File[]>((onSelect, onCancel) => (
    <PenFilePicker onSelect={onSelect} onCancel={onCancel} />
  ));
}
export function pickPenChoice(choices: PenChoice[], kind: "file" | "canvas") {
  return showTemporaryPrompt<string>((onSelect, onCancel) => (
    <PenChoicePicker
      choices={choices}
      kind={kind}
      onSelect={onSelect}
      onCancel={onCancel}
    />
  ));
}
