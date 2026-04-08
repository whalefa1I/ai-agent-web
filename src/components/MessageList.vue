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
          <div class="markdown-body" v-html="renderMarkdown(row.message.content)"></div>
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
                <span class="text-sm text-gray-500">思考中...</span>
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

    <!-- 思考中状态 -->
    <div v-if="isThinking" class="message-row flex justify-start">
      <div class="message-bubble rounded-xl border border-[#eaeaea] bg-[#F8F8F8] px-3 py-2">
        <div class="flex items-center space-x-2">
          <div class="flex space-x-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          <span class="text-sm text-gray-500">思考中...</span>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
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
</style>
