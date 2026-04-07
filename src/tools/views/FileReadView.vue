<template>
  <div class="file-read-view">
    <!-- 错误信息 -->
    <div v-if="errorMessage" class="file-error">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ errorMessage }}</span>
    </div>

    <!-- 文件信息 -->
    <div v-else-if="filePath" class="file-info">
      <span class="file-path">{{ filePath }}</span>
      <span v-if="lineInfo" class="line-info">{{ lineInfo }}</span>
    </div>

    <!-- 文件内容 -->
    <div v-else-if="!errorMessage" class="content-section">
      <pre class="file-content"><code>{{ content }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 提取文件路径
const filePath = computed(() => {
  return (props.toolCall.body?.input?.file_path as string) ||
         (props.toolCall.body?.input?.path as string) ||
         props.toolCall.header?.inputSummary ||
         ''
})

// 提取行信息
const lineInfo = computed(() => {
  const offset = props.toolCall.body?.input?.offset as number | undefined
  const limit = props.toolCall.body?.input?.limit as number | undefined
  if (offset !== undefined && limit !== undefined) {
    return `第 ${offset + 1}-${offset + limit} 行`
  }
  if (offset !== undefined) {
    return `从第 ${offset + 1} 行开始`
  }
  return ''
})

// 提取错误信息
const errorMessage = computed(() => {
  return props.toolCall.body?.error as string | null
})

// 提取内容
const content = computed(() => {
  // 尝试从 output 中获取内容
  const output = props.toolCall.body?.output as any
  if (output) {
    if (typeof output === 'string') return output
    // 如果是对象，尝试获取 content 字段
    if (output.content) return output.content
    return JSON.stringify(output, null, 2)
  }
  return '<文件内容>'
})
</script>

<style scoped>
.file-read-view {
  padding: 8px 0;
}

/* 错误信息 */
.file-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
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

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.file-path {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}

.line-info {
  font-size: 12px;
  color: #6b7280;
}

.content-section {
  background: #1f2937;
  border-radius: 6px;
  overflow: hidden;
}

.file-content {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: #e5e7eb;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  line-height: 1.6;
  max-height: 400px;
  overflow-y: auto;
}

.file-content code {
  background: transparent;
  padding: 0;
}
</style>
