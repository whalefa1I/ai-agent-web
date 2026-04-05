<template>
  <div class="edit-view">
    <!-- 文件信息 -->
    <div v-if="filePath" class="file-info">
      <span class="file-path">{{ filePath }}</span>
    </div>

    <!-- Diff 视图 -->
    <div class="diff-container">
      <!-- 旧内容 -->
      <div class="diff-section old">
        <div class="diff-label">原内容</div>
        <pre class="diff-old">{{ oldText }}</pre>
      </div>

      <!-- 箭头 -->
      <div class="diff-arrow">↓</div>

      <!-- 新内容 -->
      <div class="diff-section new">
        <div class="diff-label">新内容</div>
        <pre class="diff-new">{{ newText }}</pre>
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

// 提取文件路径
const filePath = computed(() => {
  return props.toolCall.body?.input?.path ||
         props.toolCall.header?.inputSummary ||
         ''
})

// 提取旧内容
const oldText = computed(() => {
  // 首先从 input 获取
  const inputOld = props.toolCall.body?.input?.oldText ||
                   props.toolCall.body?.input?.old_string ||
                   ''
  if (inputOld) return inputOld

  // 如果没有，尝试从 output 中解析
  const output = props.toolCall.body?.output as string
  if (output && output.includes('- ')) {
    const match = output.match(/- (.+?)(?:\n|$)/)
    if (match && match[1]) return match[1]
  }
  return '<原内容>'
})

// 提取新内容
const newText = computed(() => {
  // 首先从 input 获取
  const inputNew = props.toolCall.body?.input?.newText ||
                   props.toolCall.body?.input?.new_string ||
                   ''
  if (inputNew) return inputNew

  // 如果没有，尝试从 output 中解析
  const output = props.toolCall.body?.output as string
  if (output && output.includes('+ ')) {
    const match = output.match(/\+ (.+?)(?:\n|$)/)
    if (match && match[1]) return match[1]
  }
  return '<新内容>'
})
</script>

<style scoped>
.edit-view {
  padding: 8px 0;
}

.file-info {
  margin-bottom: 12px;
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

.diff-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-section {
  border-radius: 6px;
  overflow: hidden;
}

.diff-section.old {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.diff-section.new {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.diff-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  padding: 4px 8px;
  border-bottom: 1px solid inherit;
}

.diff-section.old .diff-label {
  border-bottom-color: #fecaca;
}

.diff-section.new .diff-label {
  border-bottom-color: #bbf7d0;
}

.diff-old, .diff-new {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  line-height: 1.5;
}

.diff-old {
  color: #dc2626;
  background: rgba(254, 202, 202, 0.3);
}

.diff-new {
  color: #16a34a;
  background: rgba(187, 247, 208, 0.3);
}

.diff-arrow {
  text-align: center;
  color: #9ca3af;
  font-size: 16px;
  padding: 4px 0;
}
</style>
