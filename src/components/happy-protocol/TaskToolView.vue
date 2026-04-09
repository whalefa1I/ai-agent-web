<template>
  <div class="task-tool-view">
    <!-- 工具头部 - 可展开/收起 -->
    <div class="tool-header" @click="toggleExpand">
      <div class="tool-icon">
        <span class="icon">📋</span>
      </div>
      <div class="tool-info">
        <div class="tool-title">{{ panelTitle }}</div>
        <div class="tool-subtitle">{{ subtitle }}</div>
      </div>
      <div class="tool-status">
        <span class="run-status" :title="runStatusHint">{{ runStatusIcon }}</span>
        <button type="button" class="expand-btn" aria-label="展开或收起">
          <span :class="{ 'rotated': isExpanded }">›</span>
        </button>
      </div>
    </div>

    <!-- 展开内容：待办列表 -->
    <div v-if="isExpanded" class="tool-content">
      <!-- Todos 列表 -->
      <div v-if="todos && todos.length > 0" class="todo-list">
        <div
          v-for="(todo, index) in todos"
          :key="todo.id || index"
          class="todo-item"
          :class="['status-' + todo.status, todo.status]"
        >
          <div class="todo-checkbox">
            <span class="checkbox-mark">
              {{ getCheckboxSymbol(todo.status) }}
            </span>
          </div>
          <div class="todo-content-text">
            <div class="todo-text" :class="{ 'completed': todo.status === 'completed' }">
              {{ todo.content }}
            </div>
            <div v-if="todo.description" class="todo-description">
              {{ todo.description }}
            </div>
            <div v-if="todo.activeForm && todo.status === 'in_progress'" class="todo-active-form">
              {{ todo.activeForm }}
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态（有错误时不显示「No tasks」，避免与红色错误重复） -->
      <div v-else-if="(!todos || todos.length === 0) && !errorText" class="todo-empty">
        <span class="empty-icon">📋</span>
        <span class="empty-text">暂无任务数据（metadata 中无 tasks/task）</span>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorText" class="todo-error">
        <span class="error-icon">❌</span>
        <span class="error-text">{{ errorText }}</span>
      </div>

      <!-- 输入/输出 展示 -->
      <div class="io-sections">
        <!-- Input 部分 -->
        <div v-if="showInput && inputContent" class="io-section input-section">
          <div class="io-header">
            <span class="io-label input-label">Input</span>
          </div>
          <pre class="io-content">{{ inputContent }}</pre>
        </div>

        <!-- Output 部分 -->
        <div v-if="showOutput && outputContent" class="io-section output-section">
          <div class="io-header">
            <span class="io-label output-label">Output</span>
          </div>
          <pre class="io-content">{{ outputContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'
import { getToolMetadata } from '@/tools/tool-registry'
import { extractTaskRowsFromAiAgentToolBody, type AiAgentTaskRow } from '@/utils/ai-agent-tool-body'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

const isExpanded = ref(true)

/** 与外层 ToolCalls 卡片状态对齐（Task* 仅内层展示时仍可见成功/失败） */
const runStatusIcon = computed(() => {
  const st = (props.toolCall.body as { status?: string } | undefined)?.status
  if (st === 'failed') return '❌'
  if (st === 'completed') return '✅'
  if (st === 'in_progress' || st === 'running') return '🔄'
  if (st === 'started') return '⏳'
  return '🔧'
})

const runStatusHint = computed(() => {
  const st = (props.toolCall.body as { status?: string } | undefined)?.status
  return st ? `工具状态: ${st}` : '工具调用'
})

const toolKey = computed(() => {
  const h = props.toolCall.header as Record<string, unknown> | undefined
  return ((h?.subtype as string) || (h?.toolName as string) || '').trim()
})

/** 使用注册表中文名，避免与外层卡片重复堆叠英文 subtype */
const panelTitle = computed(() => {
  const key = toolKey.value
  if (!key) return 'Task'
  const meta = getToolMetadata(key)
  return meta.displayName || key
})

/** 与 demo.k8s.agent.tools.local.planning.TaskTools + artifact body.metadata 对齐 */
const todos = computed((): AiAgentTaskRow[] => {
  const body = props.toolCall.body as Record<string, unknown> | null | undefined
  if (!body) return []
  let rows = extractTaskRowsFromAiAgentToolBody(body)
  const input = body.input as Record<string, unknown> | undefined
  if (rows.length === 1 && input && typeof input.description === 'string' && input.description.trim()) {
    const r = rows[0]
    if (!r.description) {
      rows = [{ ...r, description: input.description.trim() }]
    }
  }
  return rows
})

const errorText = computed(() => {
  if (props.toolCall.body?.error) return String(props.toolCall.body.error)
  if (props.toolCall.body?.message) return String(props.toolCall.body.message)
  return ''
})

const subtitle = computed(() => {
  if (errorText.value && !todos.value.length) return '见下方错误说明'
  if (!todos.value.length) return '暂无任务'
  const completed = todos.value.filter(t => t.status === 'completed').length
  const inProgress = todos.value.filter(t => t.status === 'in_progress').length
  const pending = todos.value.filter(t => t.status === 'pending').length
  if (inProgress > 0) {
    return `${completed}/${todos.value.length} 已完成 · ${inProgress} 进行中`
  }
  if (pending > 0) {
    return `${completed}/${todos.value.length} 已完成 · ${pending} 待开始`
  }
  return `${completed}/${todos.value.length} 已完成`
})

const inputContent = computed(() => {
  if (props.toolCall.body?.input) {
    return JSON.stringify(props.toolCall.body.input, null, 2)
  }
  return ''
})

const showInput = computed(() => !!inputContent.value)

/** 优先展示顶层 content（与 Enhanced 循环写入一致），否则 output */
const outputContent = computed(() => {
  const body = props.toolCall.body as Record<string, unknown> | undefined
  if (!body) return ''
  if (typeof body.content === 'string' && body.content) return body.content
  if (body.output != null && body.output !== '') {
    if (typeof body.output === 'string') return body.output
    return JSON.stringify(body.output, null, 2)
  }
  return ''
})

const showOutput = computed(() => !!outputContent.value)

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
.task-tool-view {
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

/* Todos 列表 */
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

.todo-item.completed {
  opacity: 0.85;
}

.todo-item.status-stopped {
  opacity: 0.75;
}

.todo-item.status-failed {
  opacity: 1;
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
}

/* 状态颜色（与后端 TaskStatus 对齐；过渡便于观察轮询更新） */
.todo-item .checkbox-mark {
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

/* 空状态 */
.todo-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: #9ca3af;
}

.empty-icon {
  font-size: 1.25rem;
}

.empty-text {
  font-size: 0.875rem;
  font-style: italic;
}

/* 错误信息 */
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

.error-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
  word-break: break-all;
}

/* Input/Output 区域 */
.io-sections {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.io-section {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.io-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.io-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.input-label {
  background: #dbeafe;
  color: #1e40af;
}

.output-label {
  background: #dcfce7;
  color: #166534;
}

.io-content {
  padding: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.input-section .io-content {
  background: #eff6ff;
  color: #1e3a8a;
}

.output-section .io-content {
  background: #f0fdf4;
  color: #166534;
}
</style>
