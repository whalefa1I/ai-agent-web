<template>
  <div class="tool-calls space-y-2">
    <div v-for="toolCall in toolCalls" :key="toolCall.id"
         class="tool-call-card">
      <!-- 工具头部 -->
      <div class="tool-header">
        <div class="flex items-center space-x-2">
          <!-- 工具图标和状态 -->
          <span class="text-xl">{{ getToolIcon(toolCall) }}</span>
          <span v-if="toolCall.body.status === 'started'" class="status-icon">⏳</span>
          <span v-else-if="toolCall.body.status === 'in_progress'" class="status-icon">🔄</span>
          <span v-else-if="toolCall.body.status === 'completed'" class="status-icon">✅</span>
          <span v-else-if="toolCall.body.status === 'failed'" class="status-icon">❌</span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-gray-700 truncate">
            {{ getToolDisplayName(toolCall) }}
          </div>
          <div v-if="getToolDescription(toolCall)" class="text-xs text-gray-500 truncate">
            {{ getToolDescription(toolCall) }}
          </div>
        </div>

        <!-- 执行时间 -->
        <div v-if="toolCall.body.durationMs" class="text-xs text-gray-400">
          {{ formatDuration(toolCall.body.durationMs) }}
        </div>
      </div>

      <!-- 工具内容区域 - 使用专用视图组件 -->
      <div class="tool-body">
        <component :is="getToolViewComponent(toolCall)" :toolCall="toolCall" />
      </div>

      <!-- 默认输出展示（当没有专用视图时） -->
      <div v-if="!getToolViewComponent(toolCall)" class="default-output">
        <!-- 进度条 -->
        <div v-if="toolCall.body.progress" class="progress-bar">
          <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 transition-all duration-300"
                 :style="{ width: `${toolCall.body.progress}%` }"></div>
          </div>
        </div>

        <!-- 输出内容（可折叠） -->
        <details v-if="toolCall.body.status === 'completed' && toolCall.body.output" class="output-details">
          <summary class="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
            查看输出 ({{ toolCall.body.outputType || 'text' }})
          </summary>
          <pre class="output-pre">{{ formatOutput(toolCall.body.output) }}</pre>
        </details>

        <!-- 错误信息 -->
        <div v-if="toolCall.body.status === 'failed' && toolCall.body.error" class="error-message">
          <span class="font-medium">错误：</span>{{ toolCall.body.error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'
import { toolViews } from '@/tools/views'
import { getToolMetadata, TOOL_ICONS } from '@/tools/tool-registry'

import TodoView from '@/tools/views/TodoView.vue'
import BashView from '@/tools/views/BashView.vue'
import EditView from '@/tools/views/EditView.vue'
import FileReadView from '@/tools/views/FileReadView.vue'

const props = defineProps<{
  toolCalls: ToolCallArtifact[]
}>()

// 获取工具视图组件
const getToolViewComponent = (toolCall: ToolCallArtifact): Component | null => {
  const toolName = toolCall.header?.subtype || toolCall.header?.toolName || ''

  // 根据工具类型返回专用视图组件
  switch (toolName) {
    case 'todo_write':
      return TodoView
    case 'bash':
      return BashView
    case 'file_edit':
    case 'file_write':
      return EditView
    case 'file_read':
      return FileReadView
    default:
      return null
  }
}

// 获取工具显示名称
const getToolDisplayName = (toolCall: ToolCallArtifact) => {
  const toolName = toolCall.header?.subtype || toolCall.header?.toolName || ''
  const metadata = getToolMetadata(toolName)
  return toolCall.header?.toolDisplayName || metadata.displayName || toolName
}

// 获取工具描述
const getToolDescription = (toolCall: ToolCallArtifact) => {
  const toolName = toolCall.header?.subtype || toolCall.header?.toolName || ''
  const metadata = getToolMetadata(toolName)
  const input = toolCall.body?.input || {}

  if (metadata.extractDescription) {
    return metadata.extractDescription(input)
  }
  const summary = toolCall.header?.inputSummary
  return summary ? String(summary) : ''
}

// 获取工具图标
const getToolIcon = (toolCall: ToolCallArtifact) => {
  const toolName = toolCall.header?.subtype || toolCall.header?.toolName || ''
  const metadata = getToolMetadata(toolName)
  return toolCall.header?.icon || TOOL_ICONS[metadata.icon] || TOOL_ICONS.default
}

// 格式化时长
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 格式化输出
const formatOutput = (output: any) => {
  if (typeof output === 'string') return output
  return JSON.stringify(output, null, 2)
}
</script>

<style scoped>
.tool-call-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.status-icon {
  font-size: 14px;
}

.tool-body {
  padding: 12px;
}

.default-output {
  padding: 12px;
}

.progress-bar {
  margin-bottom: 8px;
}

.output-details {
  margin-top: 8px;
}

.output-pre {
  background: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-message {
  margin-top: 8px;
  padding: 8px;
  background: #fef2f2;
  border-radius: 4px;
  font-size: 12px;
  color: #dc2626;
}
</style>
