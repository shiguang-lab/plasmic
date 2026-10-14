import type { AiMessagePart } from "@/wab/shared/copilot/ai-chat";

/** One-time conversion of stored streams using their recorded model responses. */
export function migrateAiMessageChannels(
  parts: unknown[],
  steps: {
    step: number;
    response: { text: string; calls: unknown[] } | null;
  }[],
): AiMessagePart[] {
  const texts = steps
    .filter((entry) => entry.response?.text)
    .map((entry) => ({
      step: entry.step,
      text: entry.response?.text ?? "",
      channel: entry.response?.calls.length
        ? ("commentary" as const)
        : ("answer" as const),
    }));
  return parts.flatMap((value): AiMessagePart[] => {
    const part = value as AiMessagePart;
    if (part.type !== "markdown" || part.channel) return [part];
    let text = part.text;
    const output: AiMessagePart[] = [];
    while (text) {
      const entry = texts.find((candidate) => text.startsWith(candidate.text));
      if (!entry) {
        output.push({
          type: "markdown",
          channel: "commentary",
          text,
          complete: false,
        });
        break;
      }
      output.push({
        type: "markdown",
        channel: entry.channel,
        step: entry.step,
        text: entry.text,
        complete: true,
      });
      text = text.slice(entry.text.length);
      texts.splice(texts.indexOf(entry), 1);
    }
    return output;
  });
}
