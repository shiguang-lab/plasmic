import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { useI18n } from "@/wab/client/i18n";
import {
  LOCAL_AI_ATTACHMENT_MAX_BYTES,
  LocalAiAttachment,
  localAiAttachmentSchema,
  localAiAttachmentsSchema,
} from "@/wab/shared/copilot/local-edit";
import { Alert, Button, Image, Menu, Tag, Tooltip } from "antd";
import * as React from "react";

export const AI_ATTACHMENT_ACCEPT = ".txt,.md,.pdf,.png,.jpg,.jpeg,.webp";
const fileTypes: Record<
  string,
  "application/pdf" | "image/png" | "image/jpeg" | "image/webp"
> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function readAiAttachment(file: File): Promise<LocalAiAttachment> {
  if (file.size > LOCAL_AI_ATTACHMENT_MAX_BYTES) {
    throw new Error("Use up to 5 attachments, totaling at most 10 MB.");
  }
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  let attachment: LocalAiAttachment;
  if (extension === "txt" || extension === "md") {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Could not read the attachment."));
      reader.readAsText(file);
    });
    attachment = { type: "text", name: file.name, text };
  } else {
    const mediaType = fileTypes[extension];
    if (!mediaType) {
      throw new Error(
        "Supported attachments: PDF, TXT, Markdown, PNG, JPEG and WebP.",
      );
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () =>
        reject(new Error("Could not read the attachment."));
      reader.readAsDataURL(file);
    });
    attachment = { type: "file", name: file.name, mediaType, data };
  }
  if (!localAiAttachmentSchema.safeParse(attachment).success) {
    throw new Error(
      "The attachment is empty or too large. Text documents must contain at most 100,000 characters.",
    );
  }
  return attachment;
}

export function useAiAttachments(
  attachments: LocalAiAttachment[],
  setAttachments: (attachments: LocalAiAttachment[]) => void,
  scope?: string,
) {
  const [reading, setReading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const readingRef = React.useRef(false);
  const currentScope = React.useRef(scope);
  if (currentScope.current !== scope) {
    currentScope.current = scope;
    readingRef.current = false;
  }
  React.useEffect(() => {
    setReading(false);
    setError(undefined);
  }, [scope]);
  const add = async (files: File[]) => {
    if (readingRef.current) {
      return;
    }
    readingRef.current = true;
    setError(undefined);
    setReading(true);
    try {
      const existingSize = attachments.reduce(
        (size, attachment) =>
          size +
          (attachment.type === "file"
            ? (attachment.data.length * 3) / 4 -
              (attachment.data.endsWith("==")
                ? 2
                : attachment.data.endsWith("=")
                  ? 1
                  : 0)
            : new TextEncoder().encode(attachment.text).length),
        0,
      );
      if (
        attachments.length + files.length > 5 ||
        existingSize + files.reduce((size, file) => size + file.size, 0) >
          LOCAL_AI_ATTACHMENT_MAX_BYTES
      ) {
        throw new Error("Use up to 5 attachments, totaling at most 10 MB.");
      }
      const next = [
        ...attachments,
        ...(await Promise.all(files.map(readAiAttachment))),
      ];
      if (!localAiAttachmentsSchema.safeParse(next).success) {
        throw new Error("Use up to 5 attachments, totaling at most 10 MB.");
      }
      setAttachments(next);
    } catch (reason) {
      if (currentScope.current === scope) { setError(
        reason instanceof Error
          ? reason.message
          : "Could not read the attachment.",
      ); }
    } finally {
      if (currentScope.current === scope) {
        readingRef.current = false;
        setReading(false);
      }
    }
  };
  return {
    attachments,
    setAttachments,
    reading,
    error,
    add,
    onPaste: (event: React.ClipboardEvent) => {
      const files = Array.from(event.clipboardData.files);
      if (files.length) {
        event.preventDefault();
        event.stopPropagation();
        void add(files);
      }
    },
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
      }
    },
    onDrop: (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer.files);
      if (files.length) {
        event.preventDefault();
        event.stopPropagation();
        void add(files);
      }
    },
  };
}

export function AiAttachmentPicker({
  state,
  disabled,
}: {
  state: ReturnType<typeof useAiAttachments>;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={AI_ATTACHMENT_ACCEPT}
        aria-label={t("Choose requirement documents and reference images")}
        disabled={disabled || state.reading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) {
            void state.add(files);
          }
        }}
      />
      <IFrameAwareDropdownMenu
        disabled={disabled || state.reading}
        placement="topRight"
        menu={
          <Menu
            items={[
              { key: "documents", label: t("Add requirement documents") },
              { key: "images", label: t("Add reference images") },
            ]}
            onClick={({ key }) => {
              if (input.current) {
                input.current.accept =
                  key === "images" ? ".png,.jpg,.jpeg,.webp" : ".pdf,.txt,.md";
                input.current.click();
              }
            }}
          />
        }
      >
        <Tooltip title={t("Add files and images")}>
          <Button
            type="text"
            disabled={disabled || state.reading}
            loading={state.reading}
            aria-label={t("Add files and images")}
            icon={
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                aria-hidden="true"
              >
                <path d="M12 4v16 M4 12h16" />
              </svg>
            }
          />
        </Tooltip>
      </IFrameAwareDropdownMenu>
    </>
  );
}

export function AiAttachmentList({
  attachments,
  onRemove,
  error,
  disabled,
}: {
  attachments: LocalAiAttachment[];
  onRemove?: (index: number) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { t, label } = useI18n();
  return (
    <>
      {!!attachments.length && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 4, width: "100%" }}
        >
          {attachments.map((attachment, index) => (
            <Tag
              key={index}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
                margin: 0,
                padding: "4px 6px",
              }}
            >
              {attachment.type === "file" &&
              attachment.mediaType.startsWith("image/") ? (
                <Image
                  src={`data:${attachment.mediaType};base64,${attachment.data}`}
                  alt={attachment.name}
                  width={32}
                  height={32}
                  style={{ objectFit: "cover", borderRadius: 4 }}
                />
              ) : (
                <span aria-hidden="true">▤</span>
              )}
              <span
                title={attachment.name}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {attachment.name}
              </span>
              {onRemove && (
                <Button
                  type="text"
                  size="small"
                  disabled={disabled}
                  aria-label={t("Remove attachment {name}", {
                    name: attachment.name,
                  })}
                  onClick={() => onRemove(index)}
                >
                  ×
                </Button>
              )}
            </Tag>
          ))}
        </div>
      )}
      {error && (
        <Alert style={{ width: "100%" }} type="error" message={label(error)} />
      )}
    </>
  );
}
