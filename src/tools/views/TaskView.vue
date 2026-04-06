<template>
  <div class="task-view">
    <!-- 任务列表模式：显示所有相关工具调用 -->
    <div class="task-tools-container">
      <div v-for="(toolItem, index) in visibleTools" :key="index" class="task-tool-item">
        <div class="task-tool-title">
          <span class="task-tool-name">{{ toolItem.toolName }}</span>
          <span class="task-tool-description">{{ toolItem.description }}</span>
        </div>
        <div class="task-tool-status">
          <span v-if="toolItem.state === 'started'" class="status-icon" title="等待中">⏳</span>
          <span v-else-if="toolItem.state === 'in_progress'" class="status-icon" title="进行中">🔄</span>
          <span v-else-if="toolItem.state === 'completed'" class="status-icon" title="已完成">✅</span>
          <span v-else-if="toolItem.state === 'failed'" class="status-icon" title="失败">❌</span>
        </div>
      </div>

      <!-- 显示更多提示 -->
      <div v-if="remainingCount > 0" class="task-more-item">
        <span class="task-more-text">还有 {{ remainingCount }} 个任务工具...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 提取所有任务相关的工具调用
interface TaskToolItem {
  toolName: string
  description: string
  state: string
}

// 从消息历史中提取任务工具
const visibleTools = computed(() => {
  // 这里简化处理，只显示当前工具调用的基本信息
  const taskTool: TaskToolItem = {
    toolName: props.toolCall.header?.subtype || props.toolCall.header?.toolName || 'Task',
    description: extractDescription(props.toolCall),
    state: props.toolCall.body?.status || 'completed'
  }

  return [taskTool]
})

const remainingCount = computed(() => {
  return 0 // 简化版本，暂不计算
})

// 提取描述
function extractDescription(toolCall: ToolCallArtifact): string {
  const input = toolCall.body?.input
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
}
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
</style>
