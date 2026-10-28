import { useI18n } from "@/wab/client/i18n";
import { Button } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: { minWidth: 0 },
  title: { fontSize: 17, fontWeight: 500, margin: "4px 0 8px" },
  description: {
    color: token.colorTextSecondary,
    margin: "0 0 20px",
    fontSize: 12,
  },
  examples: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    "& .ant-btn": {
      height: "auto",
      whiteSpace: "normal",
      textAlign: "left",
      justifyContent: "flex-start",
      padding: "9px 12px",
      fontSize: 12,
    },
  },
  help: {
    marginTop: 24,
    fontSize: 12,
    "& details + details": { marginTop: 12 },
    "& summary": { cursor: "pointer" },
    "& p": { color: token.colorTextSecondary, margin: "6px 0 0" },
  },
}));

export function AiWelcome({
  pageEnabled,
  hasWorkspace,
  disabled,
  onChoose,
}: {
  pageEnabled: boolean;
  hasWorkspace: boolean;
  disabled: boolean;
  onChoose: (prompt: string) => void;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const examples = [
    ...(pageEnabled
      ? [
          {
            title: "Create a customer management page",
            prompt:
              "Create a customer management page with name, phone and status filters, a customer table, and drawers for creation and details. Reuse the project's existing components.",
          } as const,
        ]
      : hasWorkspace
        ? [
            {
              title: "Review form validation",
              prompt:
                "Review the current form and suggest necessary required-field and format validation while preserving the existing submission behavior.",
            } as const,
          ]
        : []),
    ...(hasWorkspace
      ? ([
          {
            title: "Improve the current layout",
            prompt:
              "Improve spacing, alignment and information hierarchy on the current page. Preserve existing fields, data bindings and business interactions.",
          },
          {
            title: "Complete filtering and pagination",
            prompt:
              "Check the current page and complete query, reset and pagination behavior. Reset to the first page when applied filters change.",
          },
          {
            title: "Discuss the design first",
            prompt:
              "Analyze the current page's information structure and propose layout and interaction improvements. Do not change the page yet.",
          },
        ] as const)
      : []),
  ] as const;
  return (
    <div className={styles.root} data-test-id="ai-welcome">
      <h3 className={styles.title}>
        {t("What would you like to create or improve?")}
      </h3>
      <p className={styles.description}>
        {t(
          "Describe your goal, or add a requirement document or reference image.",
        )}
      </p>
      {!pageEnabled && !hasWorkspace && (
        <p className={styles.description}>
          {t("Open a page or canvas before using AI.")}
        </p>
      )}
      <div className={styles.examples}>
        {examples.map((example) => (
          <Button
            key={example.title}
            block
            disabled={disabled}
            onClick={() => onChoose(t(example.prompt))}
          >
            {t(example.title)}
          </Button>
        ))}
      </div>
      <div className={styles.help}>
        <details>
          <summary>{t("What I can help with")}</summary>
          <p>
            {t(
              pageEnabled
                ? "Create pages, improve layouts and complete forms and interactions, or discuss a design before editing."
                : "Improve the current layout, complete forms and interactions, or discuss a design before editing.",
            )}
          </p>
        </details>
        <details>
          <summary>{t("Add requirements and reference images")}</summary>
          <p>
            {t(
              "Use + to add TXT, MD, PDF, PNG, JPG or WebP files. Up to 5 attachments, totaling 10 MB.",
            )}
          </p>
        </details>
      </div>
    </div>
  );
}
