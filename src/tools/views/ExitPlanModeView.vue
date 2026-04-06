<template>
  <div class="exit-plan-mode-view">
    <!-- 计划内容展示 -->
    <div v-if="plan" class="plan-content">
      <div class="plan-header">
        <span class="plan-icon">📋</span>
        <span class="plan-title">计划提案</span>
      </div>

      <div class="plan-body">
        <pre class="plan-text">{{ plan }}</pre>
      </div>

      <div class="plan-footer">
        <p class="plan-note">
          此计划需要用户确认后方可执行。请使用 <code>/plan</code> 命令查看和管理计划。
        </p>
      </div>
    </div>

    <!-- 无计划内容 -->
    <div v-else class="plan-empty">
      <p class="text-gray-500">暂无计划内容</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 从工具调用中提取计划内容
const plan = computed(() => {
  const input = props.toolCall.body?.input
  if (input && typeof input.plan === 'string') {
    return input.plan
  }

  // 尝试从 output 中获取
  const output = props.toolCall.body?.output as string
  if (output) {
    return output
  }

  return null
})
</script>

<style scoped>
.exit-plan-mode-view {
  padding: 8px 0;
}

.plan-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.plan-icon {
  font-size: 20px;
}

.plan-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.plan-body {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
}

.plan-text {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.plan-footer {
  padding-top: 8px;
}

.plan-note {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

.plan-note code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
}

.plan-empty {
  padding: 24px;
  text-align: center;
}
</style>
