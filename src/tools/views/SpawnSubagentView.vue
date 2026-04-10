<template>
  <div class="spawn-subagent-view">
    <!-- SSE 实时进度面板（当有 batch 信息时显示） -->
    <SubagentProgressPanel
      v-if="shouldShowProgressPanel"
      :batch="sseBatch"
      :is-connected="isConnected"
      :connection-error="connectionError"
      :compact="isCompact"
      @reconnect="handleReconnect"
    />

    <!-- 单任务基础信息 -->
    <div v-else class="summary-grid">
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
import { computed, watch, onMounted } from 'vue'
import { marked } from 'marked'
import type { ToolCallArtifact } from '@/types/happy-protocol'
import SubagentProgressPanel from '@/components/SubagentProgressPanel.vue'
import { subagentSseService, useSubagentSse } from '@/services/subagent-sse-service'

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// SSE 服务状态
const { 
  currentBatch: sseBatch, 
  isConnected, 
  connectionError,
  allTasksCompleted 
} = useSubagentSse()

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

// 判断是否应该显示进度面板（有 batch 信息或检测到多任务）
const shouldShowProgressPanel = computed(() => {
  // 如果 SSE 已经有批次信息，显示面板
  if (sseBatch.value && sseBatch.value.totalTasks > 0) {
    return true
  }
  // 如果 toolCall 中包含 batch 信息，初始化 SSE
  const batch = metadata.value.batch
  if (batch && batch.totalTasks > 0) {
    return true
  }
  return false
})

// 紧凑模式（当任务完成时自动切换到紧凑）
const isCompact = computed(() => {
  return allTasksCompleted.value
})

// 是否是批量任务
const isBatchTask = computed(() => {
  const input = body.value.input || {}
  return input.batchTasks && Array.isArray(input.batchTasks) && input.batchTasks.length > 0
})

// 初始化 SSE 连接
const initSseConnection = () => {
  // 从 toolCall 中提取 batch 信息初始化 SSE
  const batch = metadata.value.batch
  if (batch && batch.batchId) {
    // 提取任务列表
    const tasks: { runId: string; goal: string }[] = []
    
    // 从 batch.runIds 和 batch.tasks 中提取
    if (batch.runIds && Array.isArray(batch.runIds)) {
      batch.runIds.forEach((runId: string, index: number) => {
        const taskName = batch.tasks?.[index]?.taskName || `Task ${index + 1}`
        const goal = batch.tasks?.[index]?.goal || taskName
        tasks.push({ runId, goal })
      })
    }
    
    // 如果没有从 batch 提取到，尝试从 input.batchTasks 提取
    if (tasks.length === 0 && isBatchTask.value) {
      const input = body.value.input || {}
      const batchTasks = input.batchTasks || []
      batchTasks.forEach((task: any, index: number) => {
        tasks.push({
          runId: `pending-${index}`, // 临时的，等待 SSE 更新
          goal: task.goal || task.taskName || `Task ${index + 1}`
        })
      })
    }
    
    if (tasks.length > 0) {
      subagentSseService.initBatch(
        batch.batchId,
        batch.sessionId || 'unknown',
        tasks
      )
      
      // 连接 SSE（需要 sessionId 和 opsSecret）
      // 注意：opsSecret 应该来自配置或环境变量
      const opsSecret = localStorage.getItem('ai-agent-ops-secret') || ''
      if (opsSecret && batch.sessionId) {
        subagentSseService.connect(batch.sessionId, opsSecret)
      }
    }
  }
}

// 重连处理
const handleReconnect = () => {
  const batch = metadata.value.batch
  const opsSecret = localStorage.getItem('ai-agent-ops-secret') || ''
  if (batch?.sessionId && opsSecret) {
    subagentSseService.connect(batch.sessionId, opsSecret)
  }
}

// 监听 toolCall 变化，自动初始化 SSE
watch(() => props.toolCall, (newToolCall) => {
  if (newToolCall) {
    const body = (newToolCall.body || {}) as Record<string, any>
    const metadata = (body.metadata || {}) as Record<string, any>
    const batch = metadata.batch
    
    // 检测到 batch 信息时初始化 SSE
    if (batch && batch.batchId) {
      // 延迟一点初始化，等待后端准备好
      setTimeout(() => {
        initSseConnection()
      }, 500)
    }
  }
}, { immediate: true })

// 组件挂载时尝试初始化
onMounted(() => {
  initSseConnection()
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
