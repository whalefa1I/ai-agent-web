<template>
  <div class="tool-calls space-y-2">
    <div v-for="toolCall in toolCalls" :key="toolCall.id"
         class="tool-call-card bg-gray-50 rounded-xl p-3 border border-gray-200">
      <div class="flex items-center space-x-3">
        <!-- 工具图标和状态 -->
        <div class="text-xl">
          <span v-if="toolCall.body.status === 'started'">⏳</span>
          <span v-else-if="toolCall.body.status === 'in_progress'">🔄</span>
          <span v-else-if="toolCall.body.status === 'completed'">✅</span>
          <span v-else-if="toolCall.body.status === 'failed'">❌</span>
        </div>

        <!-- 工具信息 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <span class="font-medium text-sm text-gray-700">{{ toolCall.header.toolDisplayName }}</span>
            <span v-if="toolCall.body.progress" class="text-xs text-gray-500">
              {{ toolCall.body.progress }}%
            </span>
          </div>

          <!-- 输入展示 -->
          <div v-if="toolCall.header.inputSummary" class="text-xs text-gray-500 truncate mt-0.5">
            {{ toolCall.header.inputSummary }}
          </div>

          <!-- 进度条 -->
          <div v-if="toolCall.body.progress" class="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 transition-all duration-300"
                 :style="{ width: `${toolCall.body.progress}%` }"></div>
          </div>
        </div>

        <!-- 执行时间 -->
        <div v-if="toolCall.body.durationMs" class="text-xs text-gray-400">
          {{ formatDuration(toolCall.body.durationMs) }}
        </div>
      </div>

      <!-- 输出内容（可折叠） -->
      <div v-if="toolCall.body.status === 'completed' && toolCall.body.output"
           class="mt-2 pt-2 border-t border-gray-200">
        <details class="text-xs">
          <summary class="cursor-pointer text-gray-500 hover:text-gray-700">
            查看输出 ({{ toolCall.body.outputType || 'text' }})
          </summary>
          <pre class="mt-2 bg-gray-100 rounded p-2 overflow-x-auto text-gray-700">{{ formatOutput(toolCall.body.output) }}</pre>
        </details>
      </div>

      <!-- 错误信息 -->
      <div v-if="toolCall.body.status === 'failed' && toolCall.body.error"
           class="mt-2 pt-2 border-t border-red-200">
        <div class="text-xs text-red-600">
          <span class="font-medium">错误：</span>{{ toolCall.body.error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallArtifact } from '@/types/happy-protocol'

defineProps<{
  toolCalls: ToolCallArtifact[]
}>()

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
