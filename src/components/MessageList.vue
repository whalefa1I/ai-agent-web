<template>
  <div class="message-list flex-1 overflow-y-auto p-4 space-y-4">
    <div v-for="message in messages" :key="message.id"
         :class="['message-row flex', message.type === 'USER' ? 'justify-end' : 'justify-start']">
      <div :class="['message-bubble max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                     message.type === 'USER' ? 'bg-primary-500 text-white' : 'bg-white text-gray-800']">
        <!-- 用户消息 -->
        <template v-if="message.type === 'USER'">
          <p class="whitespace-pre-wrap">{{ message.content }}</p>
        </template>

        <!-- 助手消息 -->
        <template v-else-if="message.type === 'ASSISTANT'">
          <div class="markdown-body" v-html="renderMarkdown(message.content)"></div>
        </template>

        <!-- 系统消息 -->
        <template v-else-if="message.type === 'SYSTEM'">
          <p class="text-sm text-gray-500 italic">{{ message.content }}</p>
        </template>

        <!-- 时间戳 -->
        <div :class="['text-xs mt-2', message.type === 'USER' ? 'text-primary-100' : 'text-gray-400']">
          {{ formatTime(message.timestamp) }}
        </div>
      </div>
    </div>

    <!-- 思考中状态 -->
    <div v-if="isThinking" class="message-row flex justify-start">
      <div class="message-bubble bg-white rounded-2xl px-4 py-3 shadow-sm">
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

    <!-- 工具调用状态 -->
    <div v-if="toolCalls.length > 0" class="message-row flex justify-start">
      <div class="message-bubble bg-white rounded-2xl px-4 py-3 shadow-sm w-full max-w-2xl">
        <h4 class="font-medium text-sm text-gray-700 mb-2">工具调用</h4>
        <ToolCalls :toolCalls="toolCalls" />
      </div>
    </div>

    <!-- 待确认的权限请求 -->
    <PermissionDialog
      v-if="pendingPermission"
      :request="pendingPermission"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { marked } from 'marked'
import PermissionDialog from './PermissionDialog.vue'
import ToolCalls from './ToolCalls.vue'

const chatStore = useChatStore()
const messages = computed(() => chatStore.messages)
const isThinking = computed(() => chatStore.isThinking)
const pendingPermission = computed(() => chatStore.pendingPermission)
const toolCalls = computed(() => chatStore.pendingToolCalls)

// 渲染 Markdown
const renderMarkdown = (content: string) => {
  return marked.parse(content, { async: false }) as string
}

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.markdown-body :deep(pre) {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
</style>
