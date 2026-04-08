/**
 * 将同一会话片段内多次 Task* 工具调用的 artifact 合并为「当前任务列表」视图，
 * 避免每条 TaskCreate / TaskUpdate 各占一块卡片。
 */
import type { ChatMessageDTO, ToolCallArtifact } from '@/types/happy-protocol'
import {
  extractTaskRowsFromAiAgentToolBody,
  mapTaskRecord,
  resolveTaskMetadataFromToolBody,
  type AiAgentTaskRow
} from '@/utils/ai-agent-tool-body'

export const TASK_FAMILY_TOOL_NAMES = new Set([
  'TaskCreate',
  'TaskList',
  'TaskGet',
  'TaskUpdate',
  'TaskStop',
  'TaskOutput'
])

function normalizeToolName(name: unknown): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

const TASK_FAMILY_TOOL_NAMES_NORM = new Set([
  'taskcreate',
  'tasklist',
  'taskget',
  'taskupdate',
  'taskstop',
  'taskoutput',
  // 兼容潜在别名
  'createtask',
  'listtasks',
  'updatetask',
  'gettask'
])

export function isTaskFamilyToolCall(tc: ToolCallArtifact | undefined | null): boolean {
  if (!tc) return false
  const raw =
    tc.header?.subtype ||
    tc.header?.toolName ||
    (tc.header as Record<string, unknown> | undefined)?.toolDisplayName ||
    ''
  const norm = normalizeToolName(raw)
  if (TASK_FAMILY_TOOL_NAMES_NORM.has(norm)) return true
  // 兜底：中文 displayName 场景（如“创建任务/更新任务”）
  return ['创建任务', '任务列表', '查看任务', '更新任务', '停止任务', '任务输出'].includes(String(raw))
}

/**
 * 按时间顺序应用各次工具结果，得到当前任务列表（用于单一任务面板）。
 * - TaskList：整体替换
 * - TaskCreate：按 id 追加或覆盖
 * - TaskUpdate / TaskGet 等：按 id 合并到已有行
 */
export function mergeTaskToolCallsToRows(calls: ToolCallArtifact[]): AiAgentTaskRow[] {
  const byId = new Map<string, AiAgentTaskRow>()
  const order: string[] = []

  const upsertRow = (row: AiAgentTaskRow, syntheticId: string) => {
    const id = row.id && String(row.id).trim() ? String(row.id) : syntheticId
    const next = { ...row, id }
    const prev = byId.get(id)
    byId.set(id, prev ? { ...prev, ...next, id } : next)
    if (!order.includes(id)) order.push(id)
  }

  for (let ci = 0; ci < calls.length; ci++) {
    const call = calls[ci]!
    const name = getToolName(call)
    const body = call.body as Record<string, unknown> | undefined
    if (!body) continue

    const meta = resolveTaskMetadataFromToolBody(body)

    if (name === 'TaskList' && meta && Array.isArray(meta.tasks)) {
      byId.clear()
      order.length = 0
      const tasks = meta.tasks as Record<string, unknown>[]
      tasks.forEach((t, idx) => {
        let row = mapTaskRecord((t || {}) as Record<string, unknown>)
        upsertRow(row, `__list_${idx}`)
      })
      continue
    }

    if (name === 'TaskCreate' && meta?.task && typeof meta.task === 'object') {
      let row = mapTaskRecord(meta.task as Record<string, unknown>)
      upsertRow(row, `__create_${ci}_${order.length}`)
      continue
    }

    if (
      (name === 'TaskUpdate' ||
        name === 'TaskGet' ||
        name === 'TaskStop' ||
        name === 'TaskOutput') &&
      meta?.task &&
      typeof meta.task === 'object'
    ) {
      let row = mapTaskRecord(meta.task as Record<string, unknown>)
      const id = row.id && String(row.id).trim() ? String(row.id) : ''
      if (id) {
        upsertRow(row, id)
      } else {
        const extracted = extractTaskRowsFromAiAgentToolBody(body)
        extracted.forEach((r, i) => upsertRow(r, `__sub_${ci}_${i}`))
      }
      continue
    }

    const extracted = extractTaskRowsFromAiAgentToolBody(body)
    if (extracted.length === 0) continue
    extracted.forEach((r, i) => upsertRow(r, `__ex_${ci}_${i}`))
  }

  return order.map(id => byId.get(id)).filter((r): r is AiAgentTaskRow => r != null)
}

export type ChatDisplayRow =
  | { kind: 'message'; message: ChatMessageDTO }
  | { kind: 'task_agg'; toolCalls: ToolCallArtifact[]; timestamp: string; id: string }

export interface TaskProgressSnapshot {
  step: number
  label: string
  rows: AiAgentTaskRow[]
  errorText?: string
  errorCode?: string
}

function cloneRows(rows: AiAgentTaskRow[]): AiAgentTaskRow[] {
  return rows.map(r => ({ ...r }))
}

export function getToolName(call: ToolCallArtifact): string {
  const raw =
    call.header?.subtype ||
    call.header?.toolName ||
    (call.header as Record<string, unknown> | undefined)?.toolDisplayName ||
    ''
  const norm = normalizeToolName(raw)
  if (norm === 'taskcreate' || raw === '创建任务') return 'TaskCreate'
  if (norm === 'tasklist' || raw === '任务列表') return 'TaskList'
  if (norm === 'taskget' || raw === '查看任务') return 'TaskGet'
  if (norm === 'taskupdate' || raw === '更新任务') return 'TaskUpdate'
  if (norm === 'taskstop' || raw === '停止任务') return 'TaskStop'
  if (norm === 'taskoutput' || raw === '任务输出') return 'TaskOutput'
  return String(raw).trim()
}

/** 下一个「同回合内的 Task 族」工具下标；遇 USER 或文末则视为无后续 */
function nextTaskToolMessageIndex(messages: ChatMessageDTO[], fromIndex: number): number | null {
  for (let j = fromIndex + 1; j < messages.length; j++) {
    const m = messages[j]
    if (!m || typeof m !== 'object') continue
    if (m.type === 'USER') return null
    if (m.type === 'TOOL' && m.toolCall && isTaskFamilyToolCall(m.toolCall as ToolCallArtifact)) {
      return j
    }
  }
  return null
}

/**
 * 是否在本条 Task 工具后插入一张任务进度卡片。
 * - TaskCreate：连续多次创建只打一张卡——在「创建批次结束」时刷新（下一条 Task 不是 TaskCreate，或已无后续 Task 工具）。
 * - 其它 Task*：每次仍刷新，便于看到状态推进。
 */
function shouldEmitTaskCheckpoint(
  call: ToolCallArtifact,
  messages: ChatMessageDTO[],
  messageIndex: number
): boolean {
  const name = getToolName(call)
  if (name === 'TaskCreate') {
    const nextIdx = nextTaskToolMessageIndex(messages, messageIndex)
    if (nextIdx === null) return true
    const nextCall = messages[nextIdx]!.toolCall as ToolCallArtifact
    return getToolName(nextCall) !== 'TaskCreate'
  }
  return ['TaskUpdate', 'TaskList', 'TaskStop', 'TaskOutput'].includes(name)
}

function mergeOneCallRows(current: AiAgentTaskRow[], call: ToolCallArtifact, ci: number): AiAgentTaskRow[] {
  const name = getToolName(call)
  const body = call.body as Record<string, unknown> | undefined
  if (!body) return current
  const meta = resolveTaskMetadataFromToolBody(body)

  const byId = new Map<string, AiAgentTaskRow>()
  const order: string[] = []
  for (const r of current) {
    const id = String(r.id || `__cur_${order.length}`)
    byId.set(id, { ...r, id })
    order.push(id)
  }

  const upsert = (row: AiAgentTaskRow, syntheticId: string) => {
    const id = row.id && String(row.id).trim() ? String(row.id) : syntheticId
    const prev = byId.get(id)
    byId.set(id, prev ? { ...prev, ...row, id } : { ...row, id })
    if (!order.includes(id)) order.push(id)
  }

  if (name === 'TaskList' && meta && Array.isArray(meta.tasks)) {
    return (meta.tasks as Record<string, unknown>[]).map(t => mapTaskRecord((t || {}) as Record<string, unknown>))
  }
  if (name === 'TaskCreate' && meta?.task && typeof meta.task === 'object') {
    upsert(mapTaskRecord(meta.task as Record<string, unknown>), `__create_${ci}_${order.length}`)
    return order.map(id => byId.get(id)).filter((r): r is AiAgentTaskRow => r != null)
  }
  if (meta?.task && typeof meta.task === 'object') {
    upsert(mapTaskRecord(meta.task as Record<string, unknown>), `__task_${ci}_${order.length}`)
    return order.map(id => byId.get(id)).filter((r): r is AiAgentTaskRow => r != null)
  }
  const extracted = extractTaskRowsFromAiAgentToolBody(body)
  extracted.forEach((r, i) => upsert(r, `__ex_${ci}_${i}`))
  return order.map(id => byId.get(id)).filter((r): r is AiAgentTaskRow => r != null)
}

export function buildTaskProgressSnapshots(calls: ToolCallArtifact[]): TaskProgressSnapshot[] {
  const snapshots: TaskProgressSnapshot[] = [{ step: 0, label: '初始状态', rows: [] }]
  let current: AiAgentTaskRow[] = []

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]!
    const name = getToolName(call) || `Task#${i + 1}`
    current = mergeOneCallRows(current, call, i)
    const body = call.body as Record<string, unknown> | undefined
    const errRaw = body?.error || body?.message
    const input = body?.input as Record<string, unknown> | undefined
    const resolvedMeta = body ? resolveTaskMetadataFromToolBody(body) : undefined
    const contract = resolvedMeta?.taskContract as Record<string, unknown> | undefined
    const errorCode = contract?.errorCode ? String(contract.errorCode) : undefined
    let errorText = errRaw ? String(errRaw) : undefined
    if (errorText && errorCode === 'TASK_CREATE_SUBJECT_REQUIRED') {
      const keys = contract?.inputKeys
      const emptyInput = Array.isArray(keys) ? keys.length === 0 : (input ? Object.keys(input).length === 0 : true)
      if (emptyInput) {
        errorText = `${errorText}（模型传入空参数 Input {}）`
      }
    }
    snapshots.push({
      step: i + 1,
      label: name,
      rows: cloneRows(current),
      errorText,
      errorCode
    })
  }
  return snapshots
}

/** 将相邻、仅「pending → in_progress」或完全相同的任务快照合并为一张（保留较新） */
function collapseAdjacentTaskProgressCards(rows: ChatDisplayRow[]): ChatDisplayRow[] {
  const result: ChatDisplayRow[] = []
  for (const row of rows) {
    if (row.kind !== 'task_agg') {
      result.push(row)
      continue
    }
    const prev = result[result.length - 1]
    if (prev?.kind === 'task_agg') {
      const a = mergeTaskToolCallsToRows(prev.toolCalls)
      const b = mergeTaskToolCallsToRows(row.toolCalls)
      if (isRedundantAdjacentTaskSnapshot(a, b)) {
        result[result.length - 1] = row
        continue
      }
    }
    result.push(row)
  }
  return result
}

/**
 * 是否可视为「重复进度卡」：
 * - 完全一致（含 description / activeForm）→ 合并；
 * - 或：同一批任务、标题 content 一致，且仅有 pending→in_progress 变化 → 合并（忽略 description/activeForm 差异，避免创建时与中途展示不一致导致合并不了）。
 */
function isRedundantAdjacentTaskSnapshot(prev: AiAgentTaskRow[], next: AiAgentTaskRow[]): boolean {
  const mapById = (rows: AiAgentTaskRow[]) => {
    const m = new Map<string, AiAgentTaskRow>()
    rows.forEach((r, idx) => {
      const id = (r.id && String(r.id).trim()) || `__row_${idx}`
      m.set(id, r)
    })
    return m
  }
  const pm = mapById(prev)
  const nm = mapById(next)
  if (pm.size !== nm.size) return false
  for (const id of pm.keys()) {
    if (!nm.has(id)) return false
  }

  let sawPendingToInProgress = false
  let anyStatusChange = false

  for (const id of pm.keys()) {
    const a = pm.get(id)!
    const b = nm.get(id)!
    if (a.content !== b.content) return false

    if (a.status === b.status) continue
    anyStatusChange = true
    if (a.status === 'pending' && b.status === 'in_progress') {
      sawPendingToInProgress = true
      continue
    }
    return false
  }

  if (anyStatusChange && sawPendingToInProgress) {
    return true
  }

  // 无状态变化：视为同快照去重，要求 description / activeForm 也一致
  for (const id of pm.keys()) {
    const a = pm.get(id)!
    const b = nm.get(id)!
    if ((a.description || '') !== (b.description || '')) return false
    if ((a.activeForm || '') !== (b.activeForm || '')) return false
  }
  return true
}

export function buildChatDisplayRows(messages: ChatMessageDTO[]): ChatDisplayRow[] {
  if (!Array.isArray(messages) || messages.length === 0) return []
  const out: ChatDisplayRow[] = []
  let currentTurnUserId = 'pre-user'
  let currentTurnTaskCalls: ToolCallArtifact[] = []
  let checkpointIndex = 0

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (!m || typeof m !== 'object') continue

    if (m.type === 'USER') {
      currentTurnUserId = m.id
      currentTurnTaskCalls = []
      checkpointIndex = 0
      out.push({ kind: 'message', message: m })
      continue
    }

    const isTaskTool =
      m.type === 'TOOL' &&
      m.toolCall &&
      isTaskFamilyToolCall(m.toolCall as ToolCallArtifact)

    if (isTaskTool) {
      const tc = m.toolCall as ToolCallArtifact
      currentTurnTaskCalls.push(tc)
      if (shouldEmitTaskCheckpoint(tc, messages, i)) {
        checkpointIndex++
        out.push({
          kind: 'task_agg',
          // 每次卡片展示“截至当前 checkpoint 的全量任务状态”
          toolCalls: [...currentTurnTaskCalls],
          timestamp: m.timestamp,
          id: `task-agg-turn-${currentTurnUserId}-ck-${checkpointIndex}-${m.id}`
        })
      }
      continue
    }

    out.push({ kind: 'message', message: m })
  }
  return collapseAdjacentTaskProgressCards(out)
}
