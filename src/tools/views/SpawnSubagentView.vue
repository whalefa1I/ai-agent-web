<template>
  <div class="spawn-subagent-view">
    <!-- SSE 实时进度面板（自动显示，支持单任务和多任务） -->
    <SubagentProgressPanel
      v-if="shouldShowProgressPanel"
      :batch="displayBatch"
      :is-connected="isConnected"
      :connection-error="connectionError"
      :compact="isCompact"
      @reconnect="handleReconnect"
    />

    <!-- 单任务简化进度（当没有批次信息但正在执行时） -->
    <div v-else-if="isSingleTaskRunning" class="single-task-progress">
      <div class="progress-header">
        <div class="spinner"></div>
        <span class="progress-text">{{ singleTaskStatus }}</span>
      </div>
      <div v-if="runId" class="run-id">{{ shortenRunId(runId) }}</div>
    </div>

    <!-- 基础信息（已完成或失败时） -->
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

// 用于传递给进度面板的批次信息
const displayBatch = computed(() => {
  // 优先使用 SSE 服务中的批次
  if (sseBatch.value && sseBatch.value.totalTasks > 0) {
    return sseBatch.value
  }
  // 其次使用 toolCall 中的 batch 元数据
  const batch = metadata.value.batch
  if (batch && batch.totalTasks > 0) {
    return batch as any
  }
  return null
})

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

// 判断是否应该显示完整进度面板
const shouldShowProgressPanel = computed(() => {
  // 如果有 SSE 批次信息，显示面板
  if (sseBatch.value && sseBatch.value.totalTasks > 0) {
    return true
  }
  // 如果有 batch 元数据，显示面板
  const batch = metadata.value.batch
  if (batch && batch.totalTasks > 0) {
    return true
  }
  return false
})

// 单任务是否正在执行（没有 batch 信息但有 runId）
const isSingleTaskRunning = computed(() => {
  return runId.value && !resultText.value && !errorText.value
})

// 单任务状态文本
const singleTaskStatus = computed(() => {
  if (isConnected.value) {
    return '子任务执行中，实时连接已建立...'
  }
  return '子任务执行中...'
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

// 获取会话 ID（从 store）
const getSessionId = () => {
  // 尝试从 localStorage 获取当前会话
  return localStorage.getItem('happy-session-id') || ''
}

// 初始化 SSE 连接（支持单任务和批量任务）
const initSseConnection = () => {
  const opsSecret = localStorage.getItem('ai-agent-ops-secret') || ''
  const sessionId = getSessionId()
  
  if (!opsSecret || !sessionId) {
    console.warn('[SpawnSubagentView] Cannot start SSE: missing opsSecret or sessionId')
    return
  }

  // 从 toolCall 中提取 batch 信息
  const batch = metadata.value.batch
  
  if (batch && batch.batchId) {
    // ===== 批量任务路径 =====
    const tasks: { runId: string; goal: string }[] = []
    
    if (batch.runIds && Array.isArray(batch.runIds)) {
      batch.runIds.forEach((runId: string, index: number) => {
        const taskName = batch.tasks?.[index]?.taskName || `Task ${index + 1}`
        const goal = batch.tasks?.[index]?.goal || taskName
        tasks.push({ runId, goal })
      })
    }
    
    if (tasks.length > 0) {
      subagentSseService.initBatch(batch.batchId, sessionId, tasks)
      subagentSseService.connect(sessionId, opsSecret)
      console.log('[SpawnSubagentView] Batch SSE initialized:', batch.batchId)
    }
  } else if (runId.value) {
    // ===== 单任务路径 =====
    // 为单任务创建一个虚拟批次
    const singleBatchId = `single-${runId.value}`
    subagentSseService.initBatch(singleBatchId, sessionId, [
      { runId: runId.value, goal: goal.value || '子任务' }
    ])
    subagentSseService.connect(sessionId, opsSecret, runId.value)
    console.log('[SpawnSubagentView] Single task SSE initialized:', runId.value)
  }
}

// 重连处理
const handleReconnect = () => {
  const opsSecret = localStorage.getItem('ai-agent-ops-secret') || ''
  const sessionId = getSessionId()
  if (sessionId && opsSecret) {
    subagentSseService.connect(sessionId, opsSecret)
  }
}

// 监听 toolCall 变化，自动初始化 SSE
watch(() => props.toolCall, (newToolCall) => {
  if (newToolCall) {
    const body = (newToolCall.body || {}) as Record<string, any>
    const metadata = (body.metadata || {}) as Record<string, any>
    
    // 延迟初始化，等待后端准备好
    setTimeout(() => {
      initSseConnection()
    }, 500)
  }
}, { immediate: true })

// 组件挂载时尝试初始化
onMounted(() => {
  initSseConnection()
})

// 工具函数
const shortenRunId = (runId: string) => {
  if (!runId) return ''
  if (runId.length <= 16) return runId
  return runId.substring(0, 8) + '...' + runId.substring(-4)
}

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

/* 单任务进度样式 */
.single-task-progress {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #3b82f6;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #bfdbfe;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-text {
  font-size: 13px;
  color: #1e40af;
  font-weight: 500;
}

.run-id {
  font-size: 11px;
  color: #6b7280;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}
</style>
