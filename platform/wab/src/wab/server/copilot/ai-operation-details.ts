import type { AiTask } from "@/wab/shared/copilot/ai-chat";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";

/** Presentation facts from the recorded tool request, never from model prose. */
export function aiOperationDetails(
  name: string,
  input: Record<string, unknown>,
  task: AiTask,
): Pick<AiTask["operations"][number], "title" | "target"> {
  const nodeName = (uuid: string) =>
    task.nodes?.find((node) => node.uuid === uuid)?.name ?? uuid;
  const componentName = (uuid: string) =>
    uuid === task.binding.componentUuid ? (task.scopeLabel ?? uuid) : uuid;
  if (name === "read") {
    const parsed = PROTOTYPE_TOOL_META.read.inputSchema.safeParse(input);
    if (!parsed.success) return {};
    if (parsed.data.elements?.length) {
      return {
        title: "Read selected elements",
        target: parsed.data.elements
          .map((element) => nodeName(element.elementUuid))
          .join(", "),
      };
    }
    if (parsed.data.componentUuids?.length) {
      return {
        title: "Read page structure",
        target: parsed.data.componentUuids.map(componentName).join(", "),
      };
    }
    return { title: "Read project overview" };
  }
  const target =
    typeof input.elementUuid === "string"
      ? nodeName(input.elementUuid)
      : typeof input.componentUuid === "string"
        ? componentName(input.componentUuid)
        : typeof input.name === "string"
          ? input.name
          : ["getEditorContext", "validate", "save"].includes(name)
            ? task.scopeLabel
            : undefined;
  return { target };
}

export function aiOperationError(error: string): string {
  try {
    const issues: unknown = JSON.parse(error);
    if (
      Array.isArray(issues) &&
      issues.length &&
      issues.every(
        (issue) =>
          typeof issue?.code === "string" && typeof issue?.message === "string",
      )
    ) {
      return "Tool arguments were rejected.";
    }
  } catch {
    // Ordinary editor errors are already readable; retain their first line.
  }
  return error.split("\n")[0];
}
