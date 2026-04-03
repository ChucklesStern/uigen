import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = typeof args.path === "string" ? args.path : null;
  const filename = path ? path.split("/").filter(Boolean).at(-1) ?? path : null;
  const command = args.command;

  if (toolName === "str_replace_editor") {
    if (command === "create" && filename) return `Creating ${filename}`;
    if ((command === "str_replace" || command === "insert") && filename)
      return `Editing ${filename}`;
    if (command === "view" && filename) return `Reading ${filename}`;
    if (command === "undo_edit") return "Undoing edit";
  }

  if (toolName === "file_manager") {
    if (command === "rename" && filename) return `Renaming ${filename}`;
    if (command === "delete" && filename) return `Deleting ${filename}`;
  }

  return toolName;
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationBadge({
  toolInvocation,
}: ToolInvocationBadgeProps) {
  const label = getToolLabel(
    toolInvocation.toolName,
    (toolInvocation.args as Record<string, unknown>) ?? {}
  );
  const isDone =
    toolInvocation.state === "result" &&
    (toolInvocation as { result?: unknown }).result;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
