<template>
  <div class="bash-view">
    <div class="command-section">
      <div class="command-label">命令</div>
      <div class="command-content">
        <code class="command-code">{{ command }}</code>
      </div>
    </div>

    <!-- 执行中状态 -->
    <div v-if="status === 'started' || status === 'in_progress'" class="running-status">
      <span class="spinner"></span>
      <span class="text-sm text-gray-500">执行中...</span>
    </div>

    <!-- 输出 -->
    <div v-else-if="hasOutput" class="output-section">
      <div class="output-label">输出</div>
      <div class="output-content">
        <pre class="output-pre">{{ output }}</pre>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="status === 'failed' && error" class="error-section">
      <div class="error-label">错误</div>
      <div class="error-content">
        <pre class="error-pre">{{ error }}</pre>
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

// 提取命令
const command = computed(() => {
  return props.toolCall.body?.input?.command ||
         props.toolCall.header?.inputSummary ||
         '未知命令'
})

// 提取输出
const output = computed(() => {
  const outputData = props.toolCall.body?.output
  if (typeof outputData === 'string') return outputData
  if (outputData) return JSON.stringify(outputData, null, 2)
  return ''
})

// 提取错误
const error = computed(() => {
  return props.toolCall.body?.error || ''
})

// 状态
const status = computed(() => {
  return props.toolCall.body?.status || 'started'
})

// 是否有输出
const hasOutput = computed(() => {
  return output.value && output.value.trim().length > 0
})
</script>

<style scoped>
.bash-view {
  padding: 8px 0;
}

.command-section {
  margin-bottom: 12px;
}

.command-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
}

.command-content {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 8px 12px;
}

.command-code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  color: #1f2937;
  word-break: break-all;
}

.running-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.output-section {
  margin-top: 12px;
}

.output-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
}

.output-content {
  background: #1f2937;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}

.output-pre {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: #10b981;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.error-section {
  margin-top: 12px;
}

.error-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
}

.error-content {
  background: #fef2f2;
  border-radius: 6px;
  padding: 12px;
  border-left: 3px solid #ef4444;
}

.error-pre {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: #dc2626;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
