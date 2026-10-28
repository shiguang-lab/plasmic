import type { AiAttachment } from "@/wab/shared/copilot/ai-chat";

export type ConversationTurn = {
  id: string;
  prompt: string;
  answer: string | null;
  status: string;
  files: AiAttachment[];
  changes: { name: string; undone: boolean | null }[] | null;
};

/** A conservative text budget; summaries retain source IDs and never promote suggestions to decisions. */
export function conversationContext(
  recent: ConversationTurn[],
  budget = 12000,
) {
  const turns: unknown[] = [];
  let remaining = budget;
  for (const [index, turn] of recent.entries()) {
    if (remaining < 400) {
      break;
    }
    const excerpt = index < 6 ? 2200 : 400;
    const textLimit = Math.min(excerpt, Math.floor((remaining - 300) / 2));
    const entry = {
      sourceRunId: turn.id,
      userRequest: turn.prompt.slice(0, textLimit),
      assistantReply: (turn.answer ?? "").slice(-textLimit),
      status: turn.status,
      attachments: (turn.files ?? []).map((file) => ({
        id: file.id,
        name: file.name,
      })),
      changes: (turn.changes ?? []).slice(-12),
      changesOmitted: (turn.changes?.length ?? 0) > 12,
    };
    const size = JSON.stringify(entry).length;
    if (size > remaining) {
      break;
    }
    remaining -= size;
    turns.push(entry);
  }
  return JSON.stringify({
    earlierMessagesOmitted:
      turns.length < recent.length || recent.length === 100,
    note: "Excerpts, not complete transcripts. User requests are requirements; assistant suggestions are not user decisions. Undone changes are not current design facts. Ask when omitted context is needed.",
    turns: turns.reverse(),
  });
}
