<template>
  <div class="multi-edit-view">
    <!-- 编辑列表 -->
    <div v-if="edits && edits.length > 0" class="edits-list">
      <div class="edits-header">
        <span class="edit-icon">✏️</span>
        <span class="edit-count">{{ edits.length }} 个编辑操作</span>
      </div>

      <div class="edits-body">
        <div v-for="(edit, index) in edits" :key="index" class="edit-item">
          <div class="edit-file-path">
            <span class="file-icon">📄</span>
            <span class="path-text">{{ edit.file_path }}</span>
          </div>

          <div class="edit-diff">
            <div class="diff-line diff-remove">
              <span class="diff-marker">-</span>
              <span class="diff-text">{{ truncate(edit.old_string, 80) }}</span>
            </div>
            <div class="diff-line diff-add">
              <span class="diff-marker">+</span>
              <span class="diff-text">{{ truncate(edit.new_string, 80) }}</span>
            </div>
          </div>

          <div v-if="edit.replace_all" class="replace-all-badge">
            替换所有匹配项
          </div>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-else-if="errorMessage" class="error-message">
      <span class="error-icon">❌</span>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- 成功输出 -->
    <div v-else-if="successMessage" class="success-message">
      <span class="success-icon">✅</span>
      <pre class="success-text">{{ successMessage }}</pre>
    </div>

    <!-- 无内容 -->
    <div v-else class="empty-message">
      <span class="empty-icon">📝</span>
      <span>无编辑操作</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

interface EditOperation {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 从工具调用中提取编辑操作
const edits = computed(() => {
  const input = props.toolCall.body?.input
  if (input && Array.isArray(input.edits)) {
    return input.edits as EditOperation[]
  }

  const output = props.toolCall.body?.output as string
  if (!output) return []

  try {
    const parsed = typeof output === 'string' ? JSON.parse(output) : output
    if (parsed && Array.isArray(parsed.edits)) {
      return parsed.edits as EditOperation[]
    }
  } catch {
    // JSON 解析失败，返回空数组
  }

  return []
})

const errorMessage = computed(() => {
  if (props.toolCall.body?.status === 'failed') {
    return props.toolCall.body?.error || '操作失败'
  }
  return null
})

const successMessage = computed(() => {
  if (props.toolCall.body?.status === 'completed') {
    const output = props.toolCall.body?.output as string
    if (output && !output.startsWith('{')) {
      return output
    }
  }
  return null
})

// 截断字符串
const truncate = (s: string, maxLen: number) => {
  if (!s) return ''
  if (s.length <= maxLen) return s
  return s.substring(0, maxLen - 3) + '...'
}
</script>

<style scoped>
.multi-edit-view {
  padding: 8px 0;
}

.edits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edits-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
}

.edit-icon {
  font-size: 16px;
}

.edit-count {
  flex: 1;
}

.edits-body {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.edit-item {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.edit-item:last-child {
  border-bottom: none;
}

.edit-file-path {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
}

.file-icon {
  font-size: 14px;
}

.path-text {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-diff {
  background: #f9fafb;
  border-radius: 4px;
  padding: 8px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
}

.diff-line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 0;
}

.diff-marker {
  font-weight: bold;
  flex-shrink: 0;
  width: 12px;
}

.diff-remove {
  color: #dc2626;
}

.diff-remove .diff-marker {
  color: #dc2626;
}

.diff-add {
  color: #16a34a;
}

.diff-add .diff-marker {
  color: #16a34a;
}

.diff-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.replace-all-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 12px;
  font-size: 11px;
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

.success-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f0fdf4;
  border-radius: 6px;
  color: #16a34a;
  font-size: 13px;
}

.success-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.success-text {
  flex: 1;
  margin: 0;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-word;
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
