<template>
  <!-- max-w-[800px] 对齐 happy-app layout.maxWidth（Web 平板） -->
  <div class="message-list mx-auto flex w-full max-w-[800px] flex-1 overflow-y-auto py-3">
    <div class="flex w-full flex-col gap-3 px-4">
    <!-- 遍历消息：同一用户回合内的 Task* 工具合并为一块「任务进度」 -->
    <div v-for="row in displayRows" :key="displayRowKey(row)"
         :class="['message-row flex', getMessageJustify(rowKind(row))]">
      <div :class="['message-bubble', getMessageBubbleClass(rowKind(row))]">

        <template v-if="row.kind === 'task_agg'">
          <div class="tool-body-task-agg w-full">
            <TaskAggregatedView :tool-calls="row.toolCalls" />
          </div>
          <div :class="['text-xs mt-2', getMessageTimeClass('TOOL')]">
            {{ formatTime(row.timestamp) }}
          </div>
        </template>

        <template v-else>
        <!-- 用户消息 -->
        <template v-if="row.message.type === 'USER'">
          <p class="whitespace-pre-wrap">{{ row.message.content }}</p>
        </template>

        <!-- 助手消息 -->
        <template v-else-if="row.message.type === 'ASSISTANT'">
          <div v-if="row.message.subtype === 'assistant-progress-message'" class="text-xs text-gray-500 mb-1">
            中间过程
          </div>
          <div v-else-if="row.message.subtype === 'assistant-loop-state-message'" class="text-xs text-indigo-500 mb-1">
            回合状态
          </div>
          <div v-else-if="row.message.subtype === 'compact-boundary-message'" class="text-xs text-amber-600 mb-1">
            上下文压缩
          </div>
          <div v-else-if="row.message.subtype === 'tool-result-trim-message'" class="text-xs text-emerald-600 mb-1">
            工具结果裁剪
          </div>
          <div v-else-if="row.message.subtype === 'snip-history-message'" class="text-xs text-cyan-600 mb-1">
            历史切片
          </div>
          <div v-else-if="row.message.subtype === 'summary-compact-message'" class="text-xs text-violet-600 mb-1">
            摘要压缩
          </div>
          <div v-else-if="row.message.subtype === 'assistant-wait-message'" class="text-xs text-sky-600 mb-1">
            等待模型
          </div>
          <div
            v-if="row.message.subtype === 'compact-boundary-message' && row.message.metadata"
            class="mb-1 text-[11px] text-amber-700"
          >
            {{
              `turn=${String(row.message.metadata.turnId || '')} · ` +
              `compact=${String(row.message.metadata.compactId || '')} · ` +
              `${String(row.message.metadata.preCompactCount || '?')}→${String(row.message.metadata.postCompactCount || '?')} · ` +
              `userTurn=${String(row.message.metadata.userTurnId || '?')} · ` +
              `phase=${String(row.message.metadata.phase || '?')} · ` +
              `parent=${String(row.message.metadata.parentId || '?')}`
            }}
          </div>
          <div
            v-else-if="row.message.subtype === 'tool-result-trim-message' && row.message.metadata"
            class="mb-1 text-[11px] text-emerald-700"
          >
            {{
              `trimmed=${String(row.message.metadata.trimmedResponses || '?')} · ` +
              `chars=${String(row.message.metadata.trimmedChars || '?')} · ` +
              `limit=${String(row.message.metadata.maxCharsPerResponse || '?')} · ` +
              `userTurn=${String(row.message.metadata.userTurnId || '?')} · ` +
              `phase=${String(row.message.metadata.phase || '?')} · ` +
              `parent=${String(row.message.metadata.parentId || '?')}`
            }}
          </div>
          <div
            v-else-if="row.message.subtype === 'snip-history-message' && row.message.metadata"
            class="mb-1 text-[11px] text-cyan-700"
          >
            {{
              `snipped=${String(row.message.metadata.snippedMessages || '?')} · ` +
              `chars=${String(row.message.metadata.beforeChars || '?')}→${String(row.message.metadata.afterChars || '?')} · ` +
              `budget=${String(row.message.metadata.snipBudgetChars || '?')} · ` +
              `userTurn=${String(row.message.metadata.userTurnId || '?')} · ` +
              `phase=${String(row.message.metadata.phase || '?')} · ` +
              `parent=${String(row.message.metadata.parentId || '?')}`
            }}
          </div>
          <div
            v-else-if="row.message.subtype === 'summary-compact-message' && row.message.metadata"
            class="mb-1 text-[11px] text-violet-700"
          >
            {{
              `chars=${String(row.message.metadata.beforeChars || '?')}→${String(row.message.metadata.afterChars || '?')} · ` +
              `count=${String(row.message.metadata.beforeCount || '?')}→${String(row.message.metadata.afterCount || '?')} · ` +
              `userTurn=${String(row.message.metadata.userTurnId || '?')} · ` +
              `phase=${String(row.message.metadata.phase || '?')} · ` +
              `parent=${String(row.message.metadata.parentId || '?')}`
            }}
          </div>
          <div
            v-else-if="row.message.subtype === 'assistant-loop-state-message' && row.message.metadata"
            class="mb-1 text-[11px] text-indigo-700"
          >
            {{
              `turn=${String(row.message.metadata.turnId || '')} · ` +
              `batch=${String(row.message.metadata.toolBatchId || '')} · ` +
              `tools=${String(row.message.metadata.toolCallCount || '?')} · ` +
              `userTurn=${String(row.message.metadata.userTurnId || '?')}`
            }}
          </div>
          <div
            v-else-if="row.message.subtype === 'assistant-message' && row.message.metadata && row.message.metadata.userTurnId"
            class="mb-1 text-[11px] text-slate-500"
          >
            {{ `userTurn=${String(row.message.metadata.userTurnId)}` }}
          </div>
          <div
            v-if="row.message.subtype === 'assistant-wait-message'"
            class="assistant-wait-card mt-1 inline-flex items-center gap-2 rounded-lg border border-sky-200/70 bg-gradient-to-r from-sky-50 via-cyan-50 to-indigo-50 px-2.5 py-1.5 text-sm text-sky-700"
          >
            <span class="wait-dot"></span>
            <span class="wait-dot" style="animation-delay: 180ms"></span>
            <span class="wait-dot" style="animation-delay: 360ms"></span>
            <span class="thinking-verb">{{ getWaitMessageText(row.message.id) }}</span>
          </div>
          <div
            v-else-if="row.message.subtype !== 'assistant-loop-state-message'"
            class="markdown-body"
            v-html="renderMarkdown(row.message.content)"
          ></div>
        </template>

        <!-- 思考中状态 -->
        <template v-else-if="row.message.type === 'THINKING'">
          <div class="thinking-bubble">
            <template v-if="row.message.content && row.message.content.trim()">
              <div class="text-xs text-gray-500 mb-1">Thinking</div>
              <p class="whitespace-pre-wrap text-sm text-gray-700">{{ row.message.content }}</p>
            </template>
            <template v-else>
              <div class="flex items-center space-x-2">
                <div class="flex space-x-1">
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-sm text-gray-500">{{ spinnerVerb }}...</span>
              </div>
            </template>
          </div>
        </template>

        <!-- 工具调用消息（非 Task 族已由上层合并；此处为 bash 等其它工具） -->
        <template v-else-if="row.message.type === 'TOOL' && row.message.toolCall">
          <ToolCalls :toolCalls="[row.message.toolCall]" />
        </template>

        <!-- 系统消息 -->
        <template v-else-if="row.message.type === 'SYSTEM'">
          <p class="text-sm text-gray-500 italic">{{ row.message.content }}</p>
        </template>

        <!-- 时间戳 -->
        <div :class="['text-xs mt-2', getMessageTimeClass(row.message.type)]">
          {{ formatTime(row.message.timestamp) }}
        </div>
        </template>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { marked } from 'marked'
import ToolCalls from './ToolCalls.vue'
import TaskAggregatedView from '@/components/happy-protocol/TaskAggregatedView.vue'
import { logger } from '@/utils/debug-logger'
import { buildChatDisplayRows, type ChatDisplayRow } from '@/utils/task-tool-merge'

const chatStore = useChatStore()
const messages = computed(() => chatStore.messages)
const displayRows = computed<ChatDisplayRow[]>(() => {
  try {
    return buildChatDisplayRows(messages.value)
  } catch (error) {
    logger.error('MessageList', 'buildChatDisplayRows failed, fallback to raw messages', error)
    return (messages.value || []).map((m: any) => ({ kind: 'message', message: m }))
  }
})

function displayRowKey(row: ChatDisplayRow): string {
  return row.kind === 'task_agg' ? row.id : row.message.id
}

function rowKind(row: ChatDisplayRow): string {
  if (row.kind === 'task_agg') return 'TOOL'
  return row.message?.type || 'SYSTEM'
}
const isThinking = computed(() => chatStore.isThinking)
const waitPhase = computed(() => chatStore.waitPhase)
const SPINNER_VERBS = [
  // Claude Code 风格词（英文）
  'Thinking',
  'Analyzing',
  'Processing',
  'Computing',
  'Considering',
  'Reasoning',
  'Synthesizing',
  'Pondering',
  'Working',
  'Stewing',
  'Crafting',
  'Generating',
  // 中文补充
  '思考中',
  '推理中',
  '分析中',
  '计算中',
  '整理中',
  '斟酌中',
  '处理中',
  '归纳中',
  '构思中',
  '校验中',
  '生成中',
  '润色中',
  '编排中',
  '拆解中',
  '聚合中',
  '判断中',
  '确认中'
]
const spinnerVerb = ref('思考中')
const lastSpinnerKey = ref<string>('')
const waitVerbByMessageId = ref<Record<string, string>>({})
const waitMessageDoneById = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}
  const rows = displayRows.value
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.kind !== 'message') continue
    const message = row.message
    if (message.type !== 'ASSISTANT' || message.subtype !== 'assistant-wait-message') continue
    const currentTurn = String(message.metadata?.userTurnId || '')
    let done = false
    for (let j = i + 1; j < rows.length; j++) {
      const next = rows[j]
      if (next.kind !== 'message') continue
      const nextMsg = next.message
      if (nextMsg.type === 'USER') break
      const nextTurn = String(nextMsg.metadata?.userTurnId || '')
      if (currentTurn && nextTurn && currentTurn !== nextTurn) continue
      if (
        nextMsg.type === 'TOOL' ||
        nextMsg.type === 'TODO' ||
        nextMsg.type === 'SYSTEM' ||
        (nextMsg.type === 'ASSISTANT' &&
          nextMsg.subtype !== 'assistant-wait-message' &&
          Boolean(String(nextMsg.content || '').trim()))
      ) {
        done = true
        break
      }
    }
    result[message.id] = done
  }
  return result
})

function randomSpinnerVerb(): string {
  return SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)] || '思考中'
}

function randomSpinnerVerbExcept(prev: string): string {
  if (SPINNER_VERBS.length <= 1) return randomSpinnerVerb()
  let next = randomSpinnerVerb()
  let guard = 0
  while (next === prev && guard < 8) {
    next = randomSpinnerVerb()
    guard += 1
  }
  return next
}

watch(isThinking, (now, prev) => {
  if (now && !prev) {
    spinnerVerb.value = randomSpinnerVerbExcept(spinnerVerb.value)
    lastSpinnerKey.value = ''
  }
})

watch(
  displayRows,
  (rows) => {
    for (const row of rows) {
      if (row.kind !== 'message') continue
      const message = row.message
      if (message.type !== 'ASSISTANT' || message.subtype !== 'assistant-wait-message') continue
      if (!waitVerbByMessageId.value[message.id]) {
        waitVerbByMessageId.value[message.id] = randomSpinnerVerb()
      }
    }
  },
  { deep: true, immediate: true }
)

function getWaitMessageText(messageId: string): string {
  if (waitMessageDoneById.value[messageId]) {
    return '已完成'
  }
  const verb = waitVerbByMessageId.value[messageId] || '处理中'
  return `${verb}...`
}

// 按「收到一条完整输出」切换等待词：
// 用户发送后开始等待会固定一个词；当收到新的 TOOL/ASSISTANT/SYSTEM/TODO 完整消息后，
// 下一段等待期再换一个词（不按秒抖动）。
watch(
  displayRows,
  (rows) => {
    if (!isThinking.value) return
    let key = ''
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (row.kind !== 'message') continue
      const m = row.message
      if (m.type === 'THINKING' || m.type === 'USER') continue
      key = `${m.type}:${m.id}`
      break
    }
    if (key && key !== lastSpinnerKey.value) {
      spinnerVerb.value = randomSpinnerVerbExcept(spinnerVerb.value)
      lastSpinnerKey.value = key
    }
  },
  { deep: true }
)
// 组件挂载日志
onMounted(() => {
  logger.logComponentMount('MessageList', { messagesCount: messages.value.length })
})

// 仅在条数变化时记一条（避免轮询替换同长度数组导致 deep watch 刷满日志）
watch(messages, (newVal, oldVal) => {
  if (!Array.isArray(newVal)) return
  const oldLen = oldVal?.length ?? 0
  const newLen = newVal.length
  if (oldLen === newLen) return
  logger.logStateChange('MessageList', 'messages', oldLen, newLen)
  newVal.forEach(msg => {
    logger.logMessageRender(msg.type, msg.id, msg.content)
  })
}, { deep: true })

// 记录任务聚合效果：用于联调时确认是否按预期「多条 Task* -> 一块面板」
watch(displayRows, (rows, oldRows) => {
  const aggCount = rows.filter(r => r.kind === 'task_agg').length
  const prevAggCount = (oldRows ?? []).filter(r => r.kind === 'task_agg').length
  const taskRawCount = (messages.value || []).filter((m: any) => m?.type === 'TOOL' && m?.toolCall).length
  const userTurns = (messages.value || []).filter((m: any) => m?.type === 'USER').length
  logger.info('MessageList', 'Task aggregation stats', {
    previousAgg: prevAggCount,
    currentAgg: aggCount,
    rawToolMessages: taskRawCount,
    userTurns
  })
}, { deep: true })

// 渲染 Markdown
const renderMarkdown = (content: string) => {
  const text = content ?? ''
  return marked.parse(text, { async: false }) as string
}

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 获取消息对齐方式
const getMessageJustify = (type: string) => {
  if (type === 'USER') return 'justify-end'
  return 'justify-start'
}

// 获取消息气泡样式
const getMessageBubbleClass = (type: string) => {
  switch (type) {
    case 'USER':
      // happy-app theme: userMessageBackground #f0eee6, userMessageText #000
      return 'max-w-full rounded-xl bg-[#f0eee6] px-3 py-1 text-[15px] leading-relaxed text-black'
    case 'TOOL':
      return 'max-w-full rounded-xl border border-[#eaeaea] bg-white px-3 py-2 text-[15px] text-[#18171C]'
    default:
      return 'max-w-full rounded-2xl px-0 py-1 text-[15px] leading-relaxed text-black'
  }
}

// 获取时间戳样式
const getMessageTimeClass = (type: string) => {
  switch (type) {
    case 'USER':
      return 'text-[#666666]'
    case 'TOOL':
      return 'text-[#666666]'
    default:
      return 'text-[#666666]'
  }
}
</script>

<style scoped>
.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(code) {
  background: rgba(100, 116, 139, 0.2);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: #d946ef;
}

.markdown-body :deep(pre) {
  background: #1e293b;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  border: 1px solid #334155;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #e2e8f0;
}

.thinking-bubble {
  background: #f9fafb;
  border-radius: 12px;
  padding: 12px 16px;
  display: inline-block;
}

.thinking-global {
  box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.25), 0 8px 20px rgba(14, 165, 233, 0.08);
  animation: thinkingPulse 1.8s ease-in-out infinite;
}

.thinking-verb {
  font-weight: 500;
  letter-spacing: 0.1px;
  animation: thinkingFade 1.2s ease-in-out infinite;
}

.assistant-wait-card {
  box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.2), 0 6px 16px rgba(14, 165, 233, 0.08);
}

.wait-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  animation: waitDotBounce 0.9s ease-in-out infinite;
}

@keyframes thinkingPulse {
  0%, 100% {
    box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.25), 0 8px 20px rgba(14, 165, 233, 0.08);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.45), 0 10px 26px rgba(59, 130, 246, 0.16);
  }
}

@keyframes thinkingFade {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

@keyframes waitDotBounce {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-2px);
    opacity: 1;
  }
}
</style>
