import { AiExecutionProgress } from "@/wab/client/components/copilot/AiExecutionProgress";
import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import type { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useI18n } from "@/wab/client/i18n";
import type {
  AiMessagePart,
  AiTask,
  EditRecord,
} from "@/wab/shared/copilot/ai-chat";
import { createStyles } from "antd-style";
import React from "react";

const useStyles = createStyles(({ token }) => ({
  answer: { minWidth: 0 },
  heading: { fontSize: 11, color: token.colorTextTertiary, marginBottom: 8 },
  note: { margin: 0, fontSize: 11, color: token.colorTextSecondary },
  separator: {
    margin: 0,
    border: 0,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
    width: "100%",
  },
}));

/** Render the server's channel and event order without classifying model text. */
export function aiResponseSections(task: AiTask) {
  const sections: {
    index: number;
    type: "process" | "answer" | "node" | "result";
    parts: AiMessagePart[];
  }[] = [];
  task.parts.forEach((part, index) => {
    if (
      part.type === "attachment" ||
      (part.type === "markdown" && part.channel === "user")
    ) {
      return;
    }
    const type =
      part.type === "markdown" && part.channel === "answer"
        ? "answer"
        : part.type === "node"
          ? "node"
          : part.type === "result"
            ? "result"
            : "process";
    const previous = sections.at(-1);
    if (type === "process" && previous?.type === "process") {
      previous.parts.push(part);
    } else {
      sections.push({ index, type, parts: [part] });
    }
  });
  return sections;
}

export function AiResponse({
  task,
  session,
  lastRecord,
}: {
  task: AiTask;
  session: LocalEditSession;
  lastRecord?: EditRecord;
}) {
  const { t, label } = useI18n();
  const { styles } = useStyles();
  const sections = aiResponseSections(task);
  const nodes = [
    ...(task.nodes ?? []),
    ...task.parts.filter((part) => part.type === "node"),
  ];
  return (
    <>
      {sections.map((section, index) => {
        if (section.type === "process") {
          return (
            <AiExecutionProgress
              key={section.index}
              task={task}
              parts={section.parts}
              session={session}
              lastRecord={lastRecord}
            />
          );
        }
        return (
          <React.Fragment key={section.index}>
            {section.type === "answer" &&
              sections[index - 1]?.type === "process" && (
                <hr
                  className={styles.separator}
                  data-test-id="ai-process-answer-separator"
                />
              )}
            {section.parts.map((part) => {
              if (part.type === "markdown") {
                const streaming =
                  task.status === "running" && part.complete !== true;
                return (
                  <div
                    key="answer"
                    className={styles.answer}
                    data-test-id="ai-answer"
                    data-response-status={task.status}
                  >
                    <div className={styles.heading}>
                      {task.status === "running"
                        ? t("Generating response")
                        : part.complete && task.status === "completed"
                          ? t("Final response")
                          : t("Incomplete response")}
                    </div>
                    <AiMarkdown
                      running={streaming}
                      nodes={nodes}
                      onLocate={(node) => void session.locate(task, node)}
                    >
                      {part.text}
                    </AiMarkdown>
                  </div>
                );
              }
              if (part.type === "node") {
                return (
                  <AiNodeReference
                    key={part.uuid}
                    node={part}
                    onLocate={() => void session.locate(task, part)}
                  />
                );
              }
              if (
                part.type === "result" &&
                part.text !== task.phase &&
                part.text !== task.error
              ) {
                return (
                  <p key="result" className={styles.note}>
                    {part.status === "verified"
                      ? t(
                          "Saved revision {revision} verified. Start a new request from the current editor.",
                          { revision: part.revision ?? "" },
                        )
                      : label(part.text)}
                  </p>
                );
              }
              return null;
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}
