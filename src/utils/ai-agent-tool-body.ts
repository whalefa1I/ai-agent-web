/**
 * ai-agent-server 工具 artifact body 约定（与 TaskTools、UnifiedToolExecutor、EnhancedAgenticQueryLoop 对齐）：
 * 成功时顶层包含 `metadata`（来自 LocalToolResult）：TaskList 为 `{ tasks: [...] }`，TaskCreate 为 `{ task: { id, subject } }`。
 */

export type AiAgentTaskRowStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'stopped'
  | 'failed'

export interface AiAgentTaskRow {
  id?: string
  content: string
  description?: string
  status: AiAgentTaskRowStatus
  activeForm?: string
}

function mapServerStatus(s: unknown): AiAgentTaskRowStatus {
  const x = String(s ?? 'pending').toLowerCase().replace(/\s+/g, '_')
  if (x === 'completed') return 'completed'
  if (x === 'in_progress') return 'in_progress'
  if (x === 'stopped') return 'stopped'
  if (x === 'failed') return 'failed'
  return 'pending'
}

/** 与后端 Task 记录字段对齐；供合并逻辑与列表提取共用 */
export function mapTaskRecord(t: Record<string, unknown>): AiAgentTaskRow {
  const subject = (t.subject as string) || (t.content as string) || (t.title as string) || ''
  const description = (t.description as string) || undefined
  return {
    id: (t.id as string) || undefined,
    content: subject || 'Unnamed',
    description: description && description !== subject ? description : undefined,
    status: mapServerStatus(t.status),
    activeForm: (t.activeForm as string) || undefined
  }
}

/**
 * 从工具 artifact body 提取 Task 工具用的行列表（仅识别后端 TaskTools 产出的 metadata 形态）。
 */
export function extractTaskRowsFromAiAgentToolBody(body: Record<string, unknown> | null | undefined): AiAgentTaskRow[] {
  if (!body) return []

  const meta = body.metadata as Record<string, unknown> | undefined
  if (!meta) return []

  const tasks = meta.tasks
  if (Array.isArray(tasks) && tasks.length > 0) {
    return tasks.map(t => mapTaskRecord((t || {}) as Record<string, unknown>))
  }

  const single = meta.task
  if (single && typeof single === 'object') {
    return [mapTaskRecord(single as Record<string, unknown>)]
  }

  return []
}
