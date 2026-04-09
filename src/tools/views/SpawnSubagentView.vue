<template>
  <div class="spawn-subagent-view">
    <div class="row">
      <span class="label">状态</span>
      <span class="value" :class="statusClass">{{ statusText }}</span>
    </div>

    <div v-if="runId" class="row">
      <span class="label">Run ID</span>
      <code class="value mono">{{ runId }}</code>
    </div>

    <div v-if="goal" class="section">
      <div class="label">目标</div>
      <pre class="content">{{ goal }}</pre>
    </div>

    <div v-if="resultText" class="section">
      <div class="label">结果</div>
      <pre class="content">{{ resultText }}</pre>
    </div>

    <div v-if="errorText" class="section error">
      <div class="label">错误</div>
      <pre class="content">{{ errorText }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

const body = computed(() => (props.toolCall.body || {}) as Record<string, any>)
const metadata = computed(() => (body.value.metadata || {}) as Record<string, any>)
const subagent = computed(() => (metadata.value.subagent || {}) as Record<string, any>)

const runId = computed(() => {
  const v = subagent.value.runId
  return typeof v === 'string' ? v : ''
})

const goal = computed(() => {
  const fromSubagent = subagent.value.goal
  if (typeof fromSubagent === 'string' && fromSubagent.trim()) return fromSubagent
  const inputGoal = body.value.input?.goal
  return typeof inputGoal === 'string' ? inputGoal : ''
})

const errorText = computed(() => {
  const err = body.value.error || body.value.message
  return err ? String(err) : ''
})

const resultText = computed(() => {
  if (typeof body.value.content === 'string' && body.value.content.trim()) {
    return body.value.content
  }
  if (typeof body.value.output === 'string' && body.value.output.trim()) {
    return body.value.output
  }
  return ''
})

const statusText = computed(() => {
  if (errorText.value) return '失败'
  if (runId.value) return '已触发'
  return '完成'
})

const statusClass = computed(() => {
  if (errorText.value) return 'failed'
  return 'ok'
})
</script>

<style scoped>
.spawn-subagent-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.label {
  min-width: 64px;
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}

.value {
  font-size: 12px;
  color: #111827;
}

.value.ok {
  color: #166534;
}

.value.failed {
  color: #b91c1c;
}

.mono {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.section {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px;
  background: #f9fafb;
}

.section.error {
  border-color: #fecaca;
  background: #fef2f2;
}

.content {
  margin: 4px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: #111827;
}
</style>
