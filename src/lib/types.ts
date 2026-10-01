export type TaskStatus = "todo" | "running" | "pending_approval" | "ready" | "done" | "rejected";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ApprovalType =
  | "none"
  | "external_post"
  | "email_reply"
  | "invoice_issue"
  | "expense_confirm"
  | "code_deploy";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "superseded";

export interface Settings {
  owner_id: string;
  company_name: string;
  company_address: string;
  invoice_registration_number: string;
  invoice_note: string;
}

export interface Employee {
  id: string;
  key: string;
  name: string;
  role: string;
  responsibilities: string;
  capabilities: string;
  prohibitions: string;
  system_prompt: string;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  instruction: string;
  employee_id: string | null;
  priority: Priority;
  due_at: string | null;
  status: TaskStatus;
  approval_type: ApprovalType;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRun {
  id: string;
  task_id: string;
  version: number;
  output_md: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  status: "running" | "succeeded" | "failed";
  error: string | null;
  revision_note: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  task_run_id: string | null;
  body: string;
  author: "owner" | "claude" | "system";
  kind: "comment" | "progress" | "revision" | "rejection";
  created_at: string;
}

export interface Approval {
  id: string;
  task_id: string;
  task_run_id: string;
  type: Exclude<ApprovalType, "none">;
  status: ApprovalStatus;
  reason: string;
  impact: string;
  owner_comment: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface MoneyRow {
  id: string;
  date: string;
  amount_excl: number;
  tax_rate: number;
  tax_amount: number;
  amount: number;
  category: string;
  note: string;
}

export interface Sale extends MoneyRow {
  client: string;
}

export interface Expense extends MoneyRow {
  vendor: string;
  ai_note: string;
  status: "draft" | "confirmed";
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number; // 税抜単価(円)
  tax_rate: number; // %
}

export interface Invoice {
  id: string;
  number: string;
  client: string;
  issue_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  note: string;
  status: "draft" | "confirmed" | "paid";
  paid_at: string | null;
  created_at: string;
}
