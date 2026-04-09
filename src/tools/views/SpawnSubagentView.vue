<template>
  <div class="spawn-subagent-view">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">状态</div>
        <div class="summary-value" :class="statusClass">{{ statusText }}</div>
      </div>
      <div v-if="runId" class="summary-item">
        <div class="summary-label">Run ID</div>
        <code class="summary-value mono">{{ runId }}</code>
      </div>
    </div>

    <div v-if="goal" class="section">
      <div class="label">目标</div>
      <pre class="content plain">{{ goal }}</pre>
    </div>

    <div v-if="translationRows.length" class="section">
      <div class="label">产出文件</div>
      <div class="table-wrap">
        <table class="result-table">
          <thead>
            <tr>
              <th>语言</th>
              <th>文件名</th>
              <th>大小</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in translationRows" :key="`${row.file}-${idx}`">
              <td>{{ row.language }}</td>
              <td><code class="mono">{{ row.file }}</code></td>
              <td>{{ row.size }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="resultText" class="section">
      <div class="label">详细结果</div>
      <div class="content markdown-body" v-html="renderedResult"></div>
    </div>

    <div v-if="errorText" class="section error">
      <div class="label">错误</div>
      <pre class="content plain">{{ errorText }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
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

interface TranslationRow {
  language: string
  file: string
  size: string
}

const translationRows = computed<TranslationRow[]>(() => {
  const text = resultText.value
  if (!text) return []
  const rows: TranslationRow[] = []
  const lineRegex = /^\s*\d+\.\s*[✅✔]?\s*\*{0,2}([^*(\n]+?)\*{0,2}\s*\(([^)\n]+)\)\s*-\s*([^\n]+)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = lineRegex.exec(text)) !== null) {
    const language = m[1]?.trim() || '未知'
    const file = m[2]?.trim() || 'unknown'
    const size = m[3]?.trim() || ''
    rows.push({ language, file, size })
  }
  return rows
})

const renderedResult = computed(() => {
  const text = resultText.value ?? ''
  return marked.parse(text, { async: false, gfm: true, breaks: true }) as string
})

const statusText = computed(() => {
  if (errorText.value) return '失败'
  if (translationRows.value.length > 0) return `已完成（${translationRows.value.length} 个文件）`
  if (runId.value) return '执行中/已触发'
  return '已完成'
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
  gap: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.summary-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  padding: 8px;
}

.summary-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 600;
  margin-bottom: 2px;
}

.label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}

.summary-value {
  font-size: 12px;
  color: #111827;
}

.summary-value.ok {
  color: #166534;
}

.summary-value.failed {
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
  word-break: break-word;
  font-size: 12px;
  color: #111827;
}

.content.plain {
  white-space: pre-wrap;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 6px;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.result-table th,
.result-table td {
  border: 1px solid #e5e7eb;
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}

.result-table th {
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
}

.markdown-body :deep(p) {
  margin: 0.45em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.45em 0;
  padding-left: 1.2em;
}

.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  word-break: break-all;
}
</style>
