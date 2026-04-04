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

    <!-- 待确认的权限请求 -->
    <PermissionDialog
      v-if="pendingPermission"
      :request="pendingPermission"
      @respond="handlePermissionResponse"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { marked } from 'marked'
import PermissionDialog from './PermissionDialog.vue'

const chatStore = useChatStore()
const messages = computed(() => chatStore.messages)
const isThinking = computed(() => chatStore.isThinking)
const pendingPermission = computed(() => chatStore.pendingPermission)

// 渲染 Markdown
const renderMarkdown = (content: string) => {
  return marked.parse(content, { async: false }) as string
}

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 处理权限响应
const handlePermissionResponse = (
  requestId: string,
  choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
) => {
  chatStore.respondPermission(requestId, choice)
}
</script>
