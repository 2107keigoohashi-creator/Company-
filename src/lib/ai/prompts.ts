import type { Employee, Task, TaskComment, TaskRun } from "@/lib/types";
import { APPROVAL_TYPE, PRIORITY } from "@/lib/labels";
import { COMMON_RULES } from "./rules";

/** 過去成果物を渡すときの1件あたり最大文字数(コスト対策)。超過分は明示して省略する。 */
const RELATED_OUTPUT_LIMIT = 4000;

function clip(text: string, limit = RELATED_OUTPUT_LIMIT) {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n\n…(長いため以下省略)`;
}

export function buildSystemPrompt(employee: Employee) {
  return [
    COMMON_RULES,
    `# あなたの役割: ${employee.name}(${employee.role})`,
    employee.responsibilities && `## 担当\n${employee.responsibilities}`,
    employee.capabilities && `## できること\n${employee.capabilities}`,
    employee.prohibitions && `## 禁止事項\n${employee.prohibitions}`,
    employee.system_prompt && `## 指針\n${employee.system_prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildTaskPrompt(args: {
  task: Task;
  previousRun: TaskRun | null;
  comments: TaskComment[];
  revisionNote: string | null;
  related: { title: string; output_md: string }[];
}) {
  const { task, previousRun, comments, related } = args;
  let { revisionNote } = args;
  const parts: string[] = [];
  parts.push(
    [
      "## タスク",
      `タイトル: ${task.title}`,
      `優先度: ${PRIORITY[task.priority].label}`,
      task.due_at ? `期限: ${new Date(task.due_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}` : "期限: なし",
      `承認種別: ${APPROVAL_TYPE[task.approval_type].label}`,
      task.approval_type !== "none"
        ? "※この成果物はオーナーの承認が必要です。実行・送信はせず、承認用の案として提出してください。"
        : "",
      "",
      "### 指示",
      task.instruction || "(詳細指示なし。タイトルから判断してください)",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );

  if (related.length > 0) {
    parts.push(
      "## 参考: あなたの過去の関連成果物\n" +
        related.map((r) => `### ${r.title}\n${clip(r.output_md)}`).join("\n\n"),
    );
  }

  if (previousRun?.output_md) {
    parts.push(`## 前回の成果物(v${previousRun.version})\n${clip(previousRun.output_md, 12000)}`);
  }

  const feedback = comments.filter((c) => c.kind !== "comment" || c.author === "owner");
  if (feedback.length > 0) {
    parts.push(
      "## これまでのオーナーのコメント\n" +
        feedback
          .slice(-10)
          .map((c) => `- [${c.kind === "rejection" ? "差し戻し" : c.kind === "revision" ? "修正依頼" : "コメント"}] ${c.body}`)
          .join("\n"),
    );
  }

  const lastFeedback = feedback.at(-1);
  if (!revisionNote && lastFeedback?.kind === "rejection") {
    revisionNote = `(差し戻し理由)${lastFeedback.body}`;
  }
  if (revisionNote) {
    parts.push(`## オーナーからの修正依頼\n${revisionNote}\n\n前回の成果物をベースに、この修正依頼を反映した新しい版を提出してください。`);
  }

  return parts.join("\n\n");
}
