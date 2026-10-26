import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import type { FigPage } from "@/wab/client/figma-importer/fig-file";
import { UiText } from "@/wab/client/i18n/UiText";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button } from "antd";
import React from "react";

export function FigmaPagePicker({
  pages,
  onSelect,
  onCancel,
}: {
  pages: FigPage[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open
      centered
      width={400}
      title={<UiText message="Select Figma page to import" />}
      closable={false}
      onCancel={onCancel}
      footer={
        <Button block onClick={onCancel}>
          <UiText message="Cancel" />
        </Button>
      }
    >
      <Scrollbar
        scrollX={false}
        style={{ maxHeight: "min(320px, calc(100vh - 200px))" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {pages.map((page) => (
            <Button
              key={page.id}
              type="text"
              block
              onClick={() => onSelect(page.id)}
              style={{
                textAlign: "left",
                justifyContent: "flex-start",
                height: "auto",
                whiteSpace: "normal",
              }}
            >
              {page.name}
            </Button>
          ))}
        </div>
      </Scrollbar>
    </Modal>
  );
}

export function pickFigmaPage(pages: FigPage[]) {
  return showTemporaryPrompt<string>((onSelect, onCancel) => (
    <FigmaPagePicker pages={pages} onSelect={onSelect} onCancel={onCancel} />
  ));
}
