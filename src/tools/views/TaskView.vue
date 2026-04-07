<template>
  <div class="task-view">
    <!-- 任务工具信息 -->
    <div class="task-tools-container">
      <div class="task-tool-item">
        <div class="task-tool-title">
          <span class="task-tool-name">{{ toolName }}</span>
          <span class="task-tool-description">{{ taskDescription }}</span>
        </div>
        <div class="task-tool-status">
          <span v-if="toolState === 'started'" class="status-icon" title="等待中">⏳</span>
          <span v-else-if="toolState === 'in_progress'" class="status-icon" title="进行中">🔄</span>
          <span v-else-if="toolState === 'completed'" class="status-icon" title="已完成">✅</span>
          <span v-else-if="toolState === 'failed'" class="status-icon" title="失败">❌</span>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="toolState === 'failed' && errorMessage" class="task-error">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ errorMessage }}</span>
    </div>

    <!-- 输出内容 -->
    <div v-else-if="toolState === 'completed' && outputContent" class="task-output">
      <div class="output-label">✅ 输出：</div>
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

// 提取描述
const taskDescription = computed(() => {
  const input = props.toolCall.body?.input
  if (!input) return ''

  // TaskCreate: 显示 subject
  if (input.subject) {
    return String(input.subject)
  }

  // TaskUpdate: 显示 task_id 和 status
  if (input.task_id) {
    const status = input.status ? ` → ${input.status}` : ''
    return `${input.task_id}${status}`
  }

  // TaskGet/TaskStop/TaskOutput: 显示 task_id
  if (input.task_id) {
    return String(input.task_id)
  }

  // TaskList: 显示 status 筛选
  if (input.status) {
    return `筛选：${input.status}`
  }

  return ''
})

// 提取工具状态
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

.task-tools-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
}

.task-tool-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-tool-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.task-tool-description {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-tool-status {
  margin-left: auto;
  padding-left: 8px;
}

.status-icon {
  font-size: 16px;
}

.task-more-item {
  padding: 4px 8px;
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
  opacity: 0.7;
}

.task-more-text {
  color: #6b7280;
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
