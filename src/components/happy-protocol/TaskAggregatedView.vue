<template>
  <div class="task-aggregated-view">
    <div class="tool-header" @click="toggleExpand">
      <div class="tool-icon">
        <span class="icon">📋</span>
      </div>
      <div class="tool-info">
        <div class="tool-title">任务进度</div>
        <div class="tool-subtitle">{{ subtitle }}</div>
        <div v-if="lastEventLabel" class="tool-activity">最近：{{ lastEventLabel }}</div>
      </div>
      <div class="tool-status">
        <span class="run-status" :title="runStatusHint">{{ aggregateStatusIcon }}</span>
        <button type="button" class="expand-btn" aria-label="展开或收起">
          <span :class="{ rotated: isExpanded }">›</span>
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="tool-content">
      <div v-if="todos.length > 0" class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPct + '%' }" />
        </div>
        <span class="progress-caption">{{ progressCaption }}</span>
      </div>

      <div v-if="showDebug && snapshots.length > 0" class="timeline-wrap">
        <div class="timeline-title">{{ stepCountLabel }}</div>
        <div class="timeline-list">
          <div v-for="snap in snapshots" :key="snap.step" class="timeline-item">
            <div class="timeline-head">
              <span class="timeline-step">#{{ snap.step }}</span>
              <span class="timeline-label">{{ snap.label }}</span>
            </div>
            <div v-if="snap.errorText" class="timeline-error">
              {{ snap.errorText }}
              <span v-if="snap.errorCode" class="timeline-error-code">[{{ snap.errorCode }}]</span>
            </div>
            <div v-if="snap.rows.length === 0" class="timeline-empty">（当前无任务）</div>
            <div v-else class="timeline-mini-list">
              <span v-for="(r, idx) in snap.rows" :key="(r.id || 'x') + '-' + idx" class="mini-item">
                {{ getCheckboxSymbol(r.status) }} {{ r.content }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="todos.length > 0" class="todo-list">
        <div
          v-for="(todo, index) in todos"
          :key="todo.id || index"
          class="todo-item"
          :class="['status-' + todo.status, todo.status]"
        >
          <div class="todo-checkbox">
            <span class="checkbox-mark">{{ getCheckboxSymbol(todo.status) }}</span>
          </div>
          <div class="todo-content-text">
            <div class="todo-text" :class="{ completed: todo.status === 'completed' }">
              {{ todo.content }}
            </div>
            <div v-if="todo.description" class="todo-description">{{ todo.description }}</div>
            <div v-if="todo.activeForm && todo.status === 'in_progress'" class="todo-active-form">
              {{ todo.activeForm }}
            </div>
            <!-- Subagent 标识 -->
            <div v-if="todo.metadata?.useSubagent" class="todo-subagent-badge">
              <span class="subagent-icon">🚀</span>
              <span>Subagent</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!errorText" class="todo-empty">
        <span class="empty-icon">📋</span>
        <span class="empty-text">暂无任务数据（等待 TaskList 或 TaskCreate 结果）</span>
      </div>

      <div v-if="errorText" class="todo-error">
        <span class="error-icon">❌</span>
        <span class="error-text">{{ errorText }}</span>
      </div>

      <details v-if="showDebug" class="debug-calls">
        <summary>本次合并的 {{ toolCalls.length }} 次工具调用</summary>
        <ol class="debug-list">
          <li v-for="(c, idx) in toolCalls" :key="c.id || idx">
            {{ (c.header?.subtype || c.header?.toolName || '?') + ' · ' + (c.id || idx) }}
          </li>
        </ol>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'
import { getToolMetadata } from '@/tools/tool-registry'
import {
  mergeTaskToolCallsToRows,
  buildTaskProgressSnapshots,
  getToolName
} from '@/utils/task-tool-merge'
import { resolveTaskMetadataFromToolBody } from '@/utils/ai-agent-tool-body'
import { logger } from '@/utils/debug-logger'

const props = defineProps<{
  toolCalls: ToolCallArtifact[]
}>()

const isExpanded = ref(true)
/** 开发/排障时可改为 true，向用户展示合并来源 */
const showDebug = ref(false)

const todos = computed(() => mergeTaskToolCallsToRows(props.toolCalls))
const snapshots = computed(() => buildTaskProgressSnapshots(props.toolCalls))

const errorText = computed(() => {
  for (const c of props.toolCalls) {
    const err = c.body?.error || c.body?.message
    if (err) return String(err)
  }
  return ''
})

const subtitle = computed(() => {
  if (errorText.value && !todos.value.length) return '部分调用失败，见下方'
  if (!todos.value.length) return '暂无任务'
  const total = Math.max(
    todos.value.length,
    ...snapshots.value.map(s => s.rows.length)
  )
  const completed = todos.value.filter(t => t.status === 'completed').length
  const inProgress = todos.value.filter(t => t.status === 'in_progress').length
  const pending = todos.value.filter(t => t.status === 'pending').length
  if (inProgress > 0) {
    return `${completed}/${total} 已完成 · ${inProgress} 进行中`
  }
  if (pending > 0) {
    return `${completed}/${total} 已完成 · ${pending} 待开始`
  }
  return `${completed}/${total} 已完成`
})

const stepCountLabel = computed(() => {
  if (snapshots.value.length <= 1) return '无任务步骤'
  return `共 ${snapshots.value.length - 1} 次任务变更（含初始态）`
})

const progressCaption = computed(() => {
  const n = todos.value.length
  const done = todos.value.filter(t => t.status === 'completed').length
  return `${done} / ${n} 已完成`
})

const progressPct = computed(() => {
  const n = todos.value.length
  if (n === 0) return 0
  const done = todos.value.filter(t => t.status === 'completed').length
  return Math.round((done / n) * 100)
})

const lastEventLabel = computed(() => {
  const last = props.toolCalls[props.toolCalls.length - 1]
  if (!last) return ''
  const key = String(last.header?.subtype || last.header?.toolName || '')
  const meta = getToolMetadata(key)
  return meta.displayName || key
})

const aggregateStatusIcon = computed(() => {
  const last = props.toolCalls[props.toolCalls.length - 1]
  const st = (last?.body as { status?: string } | undefined)?.status
  if (st === 'failed') return '❌'
  if (st === 'completed') return '✅'
  if (st === 'in_progress' || st === 'running') return '🔄'
  if (st === 'started') return '⏳'
  return '🔧'
})

const runStatusHint = computed(() => {
  const last = props.toolCalls[props.toolCalls.length - 1]
  const st = (last?.body as { status?: string } | undefined)?.status
  return st ? `最近工具状态: ${st}` : '任务面板（已合并多次调用）'
})

onMounted(() => {
  logger.info('TaskAggregatedView', 'Mounted aggregated task panel', {
    toolCalls: props.toolCalls.length,
    mergedTasks: todos.value.length
  })
})

watch(todos, (next, prev) => {
  const prevLen = prev?.length ?? 0
  if (next.length !== prevLen) {
    logger.info('TaskAggregatedView', 'Merged task rows changed', {
      previous: prevLen,
      current: next.length
    })
  }
}, { deep: true })

/** 有 Task 族调用却合不出行时打一条告警，便于 Linux/网关嵌套 body 排障 */
watch(
  () => ({
    ids: props.toolCalls.map(c => c.id).join('|'),
    merged: todos.value.length
  }),
  ({ ids, merged }) => {
    if (!ids || merged > 0 || errorText.value) return
    const first = props.toolCalls[0]
    const body = first?.body as Record<string, unknown> | undefined
    const resolved = body ? resolveTaskMetadataFromToolBody(body) : undefined
    logger.warn('TaskAggregatedView', 'Merged task list empty while Task calls present', {
      callCount: props.toolCalls.length,
      firstCanonicalTool: first ? getToolName(first) : '',
      firstBodyTopKeys: body && typeof body === 'object' ? Object.keys(body).slice(0, 32) : [],
      resolvedMetaKeys: resolved ? Object.keys(resolved) : [],
      sampleCanonicalTools: props.toolCalls.slice(0, 8).map(c => getToolName(c))
    })
  },
  { flush: 'post' }
)

function getCheckboxSymbol(status: string): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'in_progress':
      return '◉'
    case 'stopped':
      return '⊘'
    case 'failed':
      return '✗'
    default:
      return '○'
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.task-aggregated-view {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.15s;
}

.tool-header:hover {
  background: #f3f4f6;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #dbeafe;
  flex-shrink: 0;
}

.tool-icon .icon {
  font-size: 1.25rem;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #111827;
}

.tool-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
}

.tool-activity {
  font-size: 0.6875rem;
  color: #9ca3af;
  margin-top: 0.125rem;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.run-status {
  font-size: 1rem;
  line-height: 1;
  user-select: none;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-btn span {
  display: block;
  font-size: 1.25rem;
  line-height: 1;
}

.expand-btn span.rotated {
  transform: rotate(90deg);
}

.tool-content {
  padding: 0.75rem;
}

.progress-wrap {
  margin-bottom: 0.75rem;
}

.progress-track {
  height: 6px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 999px;
  transition: width 0.35s ease;
}

.progress-caption {
  display: block;
  font-size: 0.6875rem;
  color: #6b7280;
  margin-top: 0.35rem;
}

.timeline-wrap {
  margin-bottom: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.5rem;
  background: #fafafa;
}

.timeline-title {
  font-size: 0.75rem;
  color: #4b5563;
  margin-bottom: 0.35rem;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.timeline-item {
  border-left: 2px solid #d1d5db;
  padding-left: 0.5rem;
}

.timeline-head {
  font-size: 0.75rem;
  color: #111827;
}

.timeline-step {
  margin-right: 0.35rem;
  color: #6b7280;
}

.timeline-error {
  font-size: 0.7rem;
  color: #dc2626;
  margin-top: 0.2rem;
}

.timeline-error-code {
  color: #991b1b;
  margin-left: 0.25rem;
}

.timeline-empty {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 0.2rem;
}

.timeline-mini-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.mini-item {
  font-size: 0.7rem;
  color: #374151;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.15s;
}

.todo-item:hover {
  background: #f9fafb;
}

.todo-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-mark {
  font-size: 1rem;
  line-height: 1;
  font-weight: bold;
  transition: color 0.35s ease, transform 0.2s ease;
}

.todo-item.pending .checkbox-mark,
.todo-item.status-pending .checkbox-mark {
  color: #9ca3af;
}

.todo-item.in_progress .checkbox-mark,
.todo-item.status-in_progress .checkbox-mark {
  color: #eab308;
}

.todo-item.completed .checkbox-mark,
.todo-item.status-completed .checkbox-mark {
  color: #22c55e;
}

.todo-item.stopped .checkbox-mark,
.todo-item.status-stopped .checkbox-mark {
  color: #94a3b8;
}

.todo-item.failed .checkbox-mark,
.todo-item.status-failed .checkbox-mark {
  color: #ef4444;
}

.todo-content-text {
  flex: 1;
  min-width: 0;
}

.todo-text {
  font-size: 0.875rem;
  color: #111827;
  line-height: 1.5;
}

.todo-text.completed {
  text-decoration: line-through;
  color: #9ca3af;
}

.todo-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
  line-height: 1.4;
}

.todo-active-form {
  font-size: 0.75rem;
  color: #3b82f6;
  margin-top: 0.25rem;
  font-style: italic;
}

.todo-subagent-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #7c3aed;
  background: #f3e8ff;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  margin-top: 0.375rem;
  font-weight: 500;
}

.todo-subagent-badge .subagent-icon {
  font-size: 0.75rem;
}

.todo-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: #9ca3af;
}

.empty-text {
  font-size: 0.875rem;
  font-style: italic;
}

.todo-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-top: 0.5rem;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
  word-break: break-all;
}

.debug-calls {
  margin-top: 0.75rem;
  font-size: 0.6875rem;
  color: #9ca3af;
}

.debug-list {
  margin: 0.35rem 0 0 1rem;
  padding: 0;
}
</style>
