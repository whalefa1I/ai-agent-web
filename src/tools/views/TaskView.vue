<template>
  <div class="task-view">
    <!-- TaskCreate: 显示任务标题和描述 -->
    <div v-if="isTaskCreate" class="task-card">
      <div class="task-header">
        <span class="task-checkbox">{{ getCheckboxSymbol(taskStatus) }}</span>
        <div class="task-info">
          <div class="task-subject">{{ taskSubject }}</div>
          <div v-if="taskDescriptionText" class="task-description">{{ taskDescriptionText }}</div>
          <div v-if="taskActiveForm" class="task-active-form">{{ taskActiveForm }}</div>
        </div>
      </div>
    </div>

    <!-- TaskUpdate: 显示状态变更 -->
    <div v-else-if="isTaskUpdate" class="task-update">
      <div class="update-label">更新任务状态:</div>
      <div class="update-content">
        <span class="task-id">{{ updateTaskId }}</span>
        <span v-if="updateStatus" :class="['status-badge', getStatusClass(updateStatus)]">
          {{ getStatusLabel(updateStatus) }}
        </span>
        <span v-if="updateSubject" class="update-subject">{{ updateSubject }}</span>
      </div>
    </div>

    <!-- TaskList: 显示任务列表 -->
    <div v-else-if="isTaskList" class="task-list-result">
      <div class="list-label">任务列表:</div>
      <div class="task-list-items">
        <div v-for="(task, index) in taskListItems" :key="task.id || index" class="task-list-item">
          <span class="task-list-checkbox">{{ getCheckboxSymbol(task.status) }}</span>
          <span :class="['task-list-content', getStatusClass(task.status)]">
            {{ task.subject }}
          </span>
        </div>
      </div>
    </div>

    <!-- TaskGet/TaskOutput/TaskStop: 显示操作信息 -->
    <div v-else class="task-action">
      <div class="action-label">{{ actionLabel }}</div>
      <div class="action-content">{{ actionContent }}</div>
    </div>

    <!-- 错误信息 -->
    <div v-if="toolState === 'failed' && errorMessage" class="task-error">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ errorMessage }}</span>
    </div>

    <!-- 输出内容 -->
    <div v-else-if="toolState === 'completed' && outputContent" class="task-output">
      <div class="output-label">📋 输出：</div>
      <pre class="output-content">{{ outputContent }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 提取工具名称
const toolName = computed(() => {
  return props.toolCall.header?.subtype || props.toolCall.header?.toolName || 'Task'
})

// 判断是否是 TaskCreate
const isTaskCreate = computed(() => {
  return toolName.value === 'TaskCreate'
})

// 判断是否是 TaskUpdate
const isTaskUpdate = computed(() => {
  return toolName.value === 'TaskUpdate'
})

// 判断是否是 TaskList
const isTaskList = computed(() => {
  return toolName.value === 'TaskList'
})

// TaskCreate 相关
const taskSubject = computed(() => {
  const input = props.toolCall.body?.input
  return input?.subject || '未命名任务'
})

const taskDescriptionText = computed(() => {
  const input = props.toolCall.body?.input
  return input?.description || ''
})

const taskActiveForm = computed(() => {
  const input = props.toolCall.body?.input
  return input?.activeForm || ''
})

const taskStatus = computed(() => {
  const input = props.toolCall.body?.input
  return input?.status || 'pending'
})

// TaskUpdate 相关
const updateTaskId = computed(() => {
  const input = props.toolCall.body?.input
  return input?.task_id || 'unknown'
})

const updateStatus = computed(() => {
  const input = props.toolCall.body?.input
  return input?.status || null
})

const updateSubject = computed(() => {
  const input = props.toolCall.body?.input
  return input?.subject || null
})

// TaskList 相关
const taskListItems = computed(() => {
  const output = props.toolCall.body?.output
  if (!output) return []

  // 尝试解析 JSON 格式的输出
  try {
    if (typeof output === 'string') {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) {
        return parsed.map((task: any) => ({
          id: task.id,
          subject: task.subject,
          status: task.status,
          description: task.description
        }))
      }
    }
  } catch (e) {
    // 解析失败，返回空数组
  }
  return []
})

// TaskGet/TaskOutput/TaskStop 相关
const actionLabel = computed(() => {
  const name = toolName.value
  if (name === 'TaskGet') return '获取任务:'
  if (name === 'TaskOutput') return '任务输出:'
  if (name === 'TaskStop') return '停止任务:'
  return '任务操作:'
})

const actionContent = computed(() => {
  const input = props.toolCall.body?.input
  if (input?.task_id) {
    return input.task_id
  }
  if (input?.status) {
    return `筛选：${input.status}`
  }
  return ''
})

// 获取复选框符号
const getCheckboxSymbol = (status: string) => {
  switch (status) {
    case 'completed': return '✓'
    case 'in_progress': return '◻'
    default: return '◻'
  }
}

// 获取状态样式类
const getStatusClass = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-600 line-through'
    case 'in_progress': return 'text-blue-600'
    default: return 'text-gray-600'
  }
}

// 获取状态标签
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'pending': return '待处理'
    default: return status
  }
}

// 提取工具状态（兼容多种格式）
const toolState = computed(() => {
  const status = props.toolCall.body?.status
  if (status === 'started' || status === 'running' || status === 'executing') return 'started'
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress'
  if (status === 'completed' || status === 'success') return 'completed'
  if (status === 'failed' || status === 'error') return 'failed'
  // 从 error/output 判断
  if (props.toolCall.body?.error) return 'failed'
  if (props.toolCall.body?.output) return 'completed'
  return 'completed'
})

// 提取错误信息
const errorMessage = computed(() => {
  return props.toolCall.body?.error || null
})

// 提取输出内容
const outputContent = computed(() => {
  const output = props.toolCall.body?.output
  if (!output) return null

  // 如果 output 是字符串，直接返回
  if (typeof output === 'string') return output

  // 如果 output 是对象，尝试格式化为 JSON
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
})
</script>

<style scoped>
.task-view {
  padding: 4px 0;
}

/* TaskCreate 样式 */
.task-card {
  background: #f9fafb;
  border-radius: 6px;
  padding: 8px 12px;
}

.task-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-checkbox {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  color: #9ca3af;
}

.task-checkbox.completed {
  color: #22c55e;
}

.task-checkbox.in_progress {
  color: #3b82f6;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-subject {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  margin-bottom: 2px;
}

.task-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.task-active-form {
  font-size: 12px;
  color: #3b82f6;
  font-style: italic;
  margin-top: 2px;
}

/* TaskUpdate 样式 */
.task-update {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 8px 12px;
}

.update-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 4px;
}

.update-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.task-id {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: #6b7280;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.text-green-600 {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.text-blue-600 {
  background: #dbeafe;
  color: #2563eb;
}

.status-badge.text-gray-600 {
  background: #f3f4f6;
  color: #4b5563;
}

.update-subject {
  color: #111827;
  font-weight: 500;
}

/* TaskList 样式 */
.task-list-result {
  background: #f9fafb;
  border-radius: 6px;
  padding: 8px 12px;
}

.list-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 6px;
}

.task-list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-list-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
}

.task-list-item:hover {
  background: #f3f4f6;
}

.task-list-checkbox {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.task-list-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
}

.task-list-content.line-through {
  text-decoration: line-through;
  color: #9ca3af;
}

.task-list-content.text-green-600 {
  color: #16a34a;
}

.task-list-content.text-blue-600 {
  color: #2563eb;
}

.task-list-content.text-gray-600 {
  color: #4b5563;
}

/* TaskGet/TaskOutput/TaskStop 样式 */
.task-action {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 8px 12px;
}

.action-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 4px;
}

.action-content {
  font-size: 13px;
  color: #111827;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

/* 错误信息 */
.task-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 8px;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}

.error-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.error-text {
  font-size: 13px;
  color: #dc2626;
  word-break: break-all;
}

/* 输出内容 */
.task-output {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.output-label {
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
  margin-bottom: 4px;
}

.output-content {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: #374151;
}
</style>
