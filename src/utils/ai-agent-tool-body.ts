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
  metadata?: {
    reason?: string
    [key: string]: unknown
  }
}

function mapServerStatus(s: unknown): AiAgentTaskRowStatus {
  const x = String(s ?? 'pending').toLowerCase().replace(/\s+/g, '_')
  if (x === 'completed') return 'completed'
  if (x === 'in_progress') return 'in_progress'
  if (x === 'stopped') return 'stopped'
  if (x === 'failed') return 'failed'
  return 'pending'
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/**
 * 从工具 artifact body 中解析出与 TaskTools 对齐的 metadata 片段（含 tasks / task）。
 * 兼容部分后端/网关把结果放在 output、result、localToolResult 等嵌套路径下的情况（Linux 部署联调常见）。
 */
export function resolveTaskMetadataFromToolBody(
  body: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!body) return undefined

  const looksLikeTaskMeta = (m: Record<string, unknown>): boolean =>
    (Array.isArray(m.tasks) && m.tasks.length >= 0) ||
    (m.task !== undefined && m.task !== null && typeof m.task === 'object' && !Array.isArray(m.task))

  const direct = body.metadata
  if (isPlainObject(direct) && looksLikeTaskMeta(direct)) {
    return direct
  }

  const liftTasksFrom = (obj: Record<string, unknown>): Record<string, unknown> | undefined => {
    if (Array.isArray(obj.tasks) || (isPlainObject(obj.task) && !Array.isArray(obj.task))) {
      const out: Record<string, unknown> = {}
      if (Array.isArray(obj.tasks)) out.tasks = obj.tasks
      if (isPlainObject(obj.task)) out.task = obj.task
      return out
    }
    return undefined
  }

  const nestedKeys = [
    'output',
    'result',
    'data',
    'localToolResult',
    'toolResult',
    'response',
    'payload'
  ] as const
  for (const k of nestedKeys) {
    const v = body[k]
    if (!isPlainObject(v)) continue
    const inner = v.metadata
    if (isPlainObject(inner) && looksLikeTaskMeta(inner)) return inner
    const lifted = liftTasksFrom(v)
    if (lifted) return lifted
  }

  return liftTasksFrom(body)
}

/** 与后端 Task 记录字段对齐；供合并逻辑与列表提取共用 */
export function mapTaskRecord(t: Record<string, unknown>): AiAgentTaskRow {
  const subject = (t.subject as string) || (t.content as string) || (t.title as string) || ''
  const description = (t.description as string) || undefined
  const metadata = (t.metadata as Record<string, unknown>) || undefined
  return {
    id: (t.id as string) || undefined,
    content: subject || 'Unnamed',
    description: description && description !== subject ? description : undefined,
    status: mapServerStatus(t.status),
    activeForm: (t.activeForm as string) || undefined,
    metadata: metadata
  }
}

/**
 * 从工具 artifact body 提取 Task 工具用的行列表（仅识别后端 TaskTools 产出的 metadata 形态）。
 */
export function extractTaskRowsFromAiAgentToolBody(body: Record<string, unknown> | null | undefined): AiAgentTaskRow[] {
  if (!body) return []

  const meta = resolveTaskMetadataFromToolBody(body)
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
