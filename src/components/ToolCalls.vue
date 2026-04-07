<template>
  <div class="tool-calls space-y-2">
    <div v-for="toolCall in toolCalls" :key="toolCall.id"
         class="tool-call-card">
      <!-- 工具头部 -->
      <div class="tool-header">
        <div class="flex items-center space-x-2">
          <!-- 工具图标和状态 -->
          <span class="text-xl">{{ getToolIcon(toolCall) }}</span>
          <span v-if="getToolState(toolCall) === 'started'" class="status-icon">⏳</span>
          <span v-else-if="getToolState(toolCall) === 'in_progress'" class="status-icon">🔄</span>
          <span v-else-if="getToolState(toolCall) === 'completed'" class="status-icon">✅</span>
          <span v-else-if="getToolState(toolCall) === 'failed'" class="status-icon">❌</span>
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
        <div v-if="getToolDuration(toolCall)" class="text-xs text-gray-400">
          {{ formatDuration(getToolDuration(toolCall)) }}
        </div>
      </div>

      <!-- 工具内容区域 - 使用专用视图组件 -->
      <div class="tool-body">
        <component :is="getToolViewComponent(toolCall)" :toolCall="toolCall" />
      </div>

      <!-- 默认输出展示（当没有专用视图时） -->
      <div v-if="!getToolViewComponent(toolCall)" class="default-output">
        <!-- 进度条 -->
        <div v-if="toolCall.body?.progress" class="progress-bar">
          <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 transition-all duration-300"
                 :style="{ width: `${toolCall.body.progress}%` }"></div>
          </div>
        </div>

        <!-- 输出内容（可折叠） -->
        <details v-if="getToolState(toolCall) === 'completed' && getToolOutput(toolCall)" class="output-details">
          <summary class="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
            查看输出 ({{ toolCall.body.outputType || 'text' }})
          </summary>
          <pre class="output-pre">{{ formatOutput(getToolOutput(toolCall)) }}</pre>
        </details>

        <!-- 错误信息 -->
        <div v-if="getToolState(toolCall) === 'failed' && getToolError(toolCall)" class="error-message">
          <span class="font-medium">错误：</span>{{ getToolError(toolCall) }}
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
import TaskView from '@/tools/views/TaskView.vue'
import AskUserQuestionView from '@/tools/views/AskUserQuestionView.vue'
import ExitPlanModeView from '@/tools/views/ExitPlanModeView.vue'
import LSView from '@/tools/views/LSView.vue'
import MultiEditView from '@/tools/views/MultiEditView.vue'
import McpServerView from '@/tools/views/McpServerView.vue'
import SkillsView from '@/tools/views/SkillsView.vue'

// @ts-ignore - ToolCallArtifact 类型包含 body 属性
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
    // Task 工具集
    case 'TaskCreate':
    case 'TaskList':
    case 'TaskGet':
    case 'TaskUpdate':
    case 'TaskStop':
    case 'TaskOutput':
      return TaskView
    // AskUserQuestion 工具
    case 'AskUserQuestion':
      return AskUserQuestionView
    // ExitPlanMode 工具
    case 'ExitPlanMode':
      return ExitPlanModeView
    // LS 工具
    case 'ls':
      return LSView
    // MultiEdit 工具
    case 'multi_edit':
      return MultiEditView
    // MCP 工具
    case 'mcp_connect':
    case 'mcp_disconnect':
      return McpServerView
    // Skills 工具
    case 'skill_install':
    case 'skill_uninstall':
    case 'skill_search':
      return SkillsView
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
    const desc = metadata.extractDescription(input)
    return desc || ''  // 防止返回 undefined
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

// 获取工具状态（兼容多种格式）
const getToolState = (toolCall: ToolCallArtifact): string => {
  // 1. 优先从 body.status 获取
  if (toolCall.body?.status) {
    const status = toolCall.body.status
    if (['started', 'running', 'executing'].includes(status)) return 'started'
    if (['in_progress', 'in-progress'].includes(status)) return 'in_progress'
    if (['completed', 'success'].includes(status)) return 'completed'
    if (['failed', 'error'].includes(status)) return 'failed'
  }
  // 2. 从 body.error 判断是否失败
  if (toolCall.body?.error) return 'failed'
  // 3. 从 body.output 判断是否完成
  if (toolCall.body?.output) return 'completed'
  // 4. 默认当作完成（静态 artifact）
  return 'completed'
}

// 获取工具输出（兼容多种格式）
const getToolOutput = (toolCall: ToolCallArtifact): any => {
  // 1. 直接从 body.output 获取
  if (toolCall.body?.output) return toolCall.body.output
  // 2. 从 metadata 中获取（后端 LocalToolResult 格式）
  if (toolCall.body?.metadata) {
    const metadata = toolCall.body.metadata
    if (typeof metadata === 'object') {
      // 尝试从 metadata 中提取结构化输出
      return metadata.content || metadata.output || metadata
    }
  }
  // 3. 从 body.content 获取
  if (toolCall.body?.content) return toolCall.body.content
  return null
}

// 获取工具错误信息
const getToolError = (toolCall: ToolCallArtifact): string => {
  if (toolCall.body?.error) return toolCall.body.error
  if (toolCall.body?.message) return toolCall.body.message
  return null
}

// 获取工具执行时长
const getToolDuration = (toolCall: ToolCallArtifact): number | null => {
  if (toolCall.body?.durationMs) return toolCall.body.durationMs
  if (toolCall.body?.metadata?.durationMs) return toolCall.body.metadata.durationMs
  return null
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
