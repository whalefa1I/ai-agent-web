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
    <div v-if="relativePathHint && !errorMessage" class="path-hint">
      {{ relativePathHint }}
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
import { isLikelyAbsolutePath, resolveFilePathFromToolInput } from '@/utils/file-tool-input'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

const filePath = computed(() => {
  const p = resolveFilePathFromToolInput(
    props.toolCall.body?.input as Record<string, unknown> | undefined
  )
  return p || props.toolCall.header?.inputSummary || ''
})

const relativePathHint = computed(() => {
  const p = filePath.value
  if (!p) return ''
  if (isLikelyAbsolutePath(p)) return ''
  return '提示：相对路径会在服务端按 workspaceRoot 解析；若读不到文件，请改用绝对路径或先 glob/ls 确认位置。'
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

function formatBodyError(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// 提取错误信息
const errorMessage = computed(() => {
  const err = props.toolCall.body?.error
  if (!bodyErrorIndicatesFailure(err)) return ''
  return formatBodyError(err)
})

function bodyErrorIndicatesFailure(err: unknown): boolean {
  if (err == null || err === false) return false
  if (typeof err === 'string') return err.trim().length > 0
  if (typeof err === 'number') return err !== 0
  if (Array.isArray(err)) return err.length > 0
  if (typeof err === 'object') return Object.keys(err as Record<string, unknown>).length > 0
  return Boolean(err)
}

// 提取内容
const content = computed(() => {
  const body = props.toolCall.body as Record<string, unknown> | undefined
  const output = body?.output as any
  if (output) {
    if (typeof output === 'string') return output
    if (output.content) return output.content
    return JSON.stringify(output, null, 2)
  }
  const meta = body?.metadata as Record<string, unknown> | undefined
  if (meta?.content != null) return String(meta.content)
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

.path-hint {
  margin: -6px 0 12px 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  line-height: 1.4;
  word-break: break-word;
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
