<template>
  <div class="ls-view">
    <!-- 目录列表内容 -->
    <div v-if="entries && entries.length > 0" class="entries-list">
      <div class="entries-header">
        <span class="path-icon">📁</span>
        <span class="path-text">{{ path }}</span>
        <span class="count-badge">{{ entries.length }} 项</span>
      </div>

      <div class="entries-body">
        <div v-for="entry in sortedEntries" :key="entry.path" class="entry-item">
          <span class="entry-icon">{{ getEntryIcon(entry) }}</span>
          <span class="entry-name">{{ entry.name }}</span>
          <span v-if="!entry.isDirectory" class="entry-size">{{ formatSize(entry.size) }}</span>
        </div>
      </div>
    </div>

    <!-- 无内容或错误 -->
    <div v-else-if="errorMessage" class="error-message">
      <span class="error-icon">❌</span>
      <span>{{ errorMessage }}</span>
    </div>

    <div v-else-if="toolCall.body?.output && !entries" class="output-text">
      <pre class="text-xs text-gray-600 whitespace-pre-wrap">{{ toolCall.body.output }}</pre>
    </div>

    <div v-else class="empty-message">
      <span class="empty-icon">📂</span>
      <span>空目录</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

interface LSEntry {
  name: string
  path: string
  isDirectory: boolean
  isSymbolicLink?: boolean
  size: number
  lastModifiedTime?: string
  creationTime?: string
}

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 从工具调用中提取目录信息
const entries = computed(() => {
  const output = props.toolCall.body?.output
  if (!output) return null

  try {
    // 尝试解析 JSON 输出
    const parsed = typeof output === 'string' ? JSON.parse(output) : output
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed.entries as LSEntry[]
    }
  } catch {
    // JSON 解析失败，返回 null
  }

  return null
})

const path = computed(() => {
  const output = props.toolCall.body?.output as string
  if (!output) return ''

  try {
    const parsed = typeof output === 'string' ? JSON.parse(output) : output
    return parsed?.path || ''
  } catch {
    return ''
  }
})

const errorMessage = computed(() => {
  if (props.toolCall.body?.status === 'failed') {
    return props.toolCall.body?.error || '操作失败'
  }

  const output = props.toolCall.body?.output as string
  if (!output) return null

  // 检查是否包含错误信息
  if (output.includes('error') || output.includes('Error:') || output.includes('does not exist')) {
    return output
  }

  return null
})

// 排序：目录在前，文件在后，按名称排序
const sortedEntries = computed(() => {
  if (!entries.value) return []

  return [...entries.value].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
})

// 获取条目图标
const getEntryIcon = (entry: LSEntry) => {
  if (entry.isSymbolicLink) return '🔗'
  if (entry.isDirectory) return '📁'
  return '📄'
}

// 格式化文件大小
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i]
}
</script>

<style scoped>
.ls-view {
  padding: 8px 0;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entries-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
}

.path-icon {
  font-size: 16px;
}

.path-text {
  flex: 1;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-badge {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: #6b7280;
}

.entries-body {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}

.entry-item:last-child {
  border-bottom: none;
}

.entry-item:hover {
  background: #f9fafb;
}

.entry-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.entry-name {
  flex: 1;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: #111827;
}

.entry-size {
  color: #9ca3af;
  font-size: 11px;
  flex-shrink: 0;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

.error-icon {
  font-size: 16px;
}

.output-text {
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}
</style>
