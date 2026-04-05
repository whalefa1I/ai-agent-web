<template>
  <div class="bash-view">
    <!-- 执行中状态 -->
    <div v-if="status === 'started' || status === 'in_progress'" class="running-status">
      <span class="spinner"></span>
      <span class="text-sm text-gray-500">执行中...</span>
      <!-- 执行中显示命令 -->
      <div class="command-section">
        <div class="command-label">命令</div>
        <div class="command-content">
          <code class="command-code">{{ command }}</code>
        </div>
      </div>
    </div>

    <!-- 执行完成 - 整合显示 -->
    <div v-else-if="hasOutput" class="output-section">
      <div class="output-content">
        <pre class="output-pre">{{ formattedOutput }}</pre>
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

// 格式化输出：解析并美化显示
const formattedOutput = computed(() => {
  const outputStr = output.value
  if (!outputStr) return ''

  // 尝试解析标准输出格式：Command: xxx \n Exit code: xxx \n Duration: xxx \n\n STDOUT: xxx
  const lines = outputStr.split('\n')
  const result: string[] = []

  let hasCommand = false
  let hasStdout = false

  for (const line of lines) {
    if (line.startsWith('Command:')) {
      hasCommand = true
      result.push(`📝 ${line}`)
    } else if (line.startsWith('Exit code:')) {
      const exitCode = line.replace('Exit code:', '').trim()
      if (exitCode === '0') {
        result.push(`✅ 退出码：${exitCode}`)
      } else {
        result.push(`❌ 退出码：${exitCode}`)
      }
    } else if (line.startsWith('Duration:')) {
      result.push(`⏱️ ${line}`)
    } else if (line.trim() === 'STDOUT:') {
      hasStdout = true
      result.push('\n💡 输出结果：')
    } else if (line.trim() === 'STDERR:') {
      result.push('\n⚠️ 错误输出：')
    } else if (line || result.length === 0) {
      result.push(line)
    }
  }

  return result.join('\n')
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

.running-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  flex-wrap: wrap;
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

.command-section {
  margin: 8px 0 12px;
  width: 100%;
}

.command-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.command-content {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
}

.command-code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  color: #1f2937;
  word-break: break-all;
}

.output-section {
  margin-top: 12px;
}

.output-content {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  border: 1px solid #334155;
}

.output-pre {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  color: #a7f3d0;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  line-height: 1.6;
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
