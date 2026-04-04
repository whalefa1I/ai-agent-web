<template>
  <div class="input-bar border-t bg-white p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 工具调用状态 -->
      <ToolCalls v-if="toolCalls.length > 0" :toolCalls="toolCalls" class="mb-3" />

      <!-- 输入框 -->
      <div class="flex items-end space-x-3">
        <div class="flex-1 relative">
          <textarea
            v-model="input"
            :disabled="disabled || isThinking"
            placeholder="输入消息..."
            class="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 pr-12 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            rows="1"
            @keydown.enter.exact.prevent="sendMessage"
            @input="autoResize"
            ref="textareaRef"
          ></textarea>

          <!-- 附件按钮（预留） -->
          <button
            class="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
            title="添加附件"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        </div>

        <!-- 发送按钮 -->
        <button
          @click="sendMessage"
          :disabled="!input.trim() || disabled || isThinking"
          class="send-btn px-4 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
        >
          <span>发送</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      <!-- 提示信息 -->
      <div class="mt-2 text-center text-xs text-gray-400">
        <span v-if="isThinking">AI 正在思考中...</span>
        <span v-else>按 Enter 发送，Shift+Enter 换行</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import ToolCalls from './ToolCalls.vue'

const chatStore = useChatStore()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const toolCalls = computed(() => chatStore.pendingToolCalls)
const isThinking = computed(() => chatStore.isThinking)
const disabled = computed(() => chatStore.hasPendingPermission)

// 自动调整文本框高度
const autoResize = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }
}

// 发送消息
const sendMessage = async () => {
  const content = input.value.trim()
  if (!content || isThinking.value) return

  await chatStore.sendMessage(content)
  input.value = ''

  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}
</script>

<style scoped>
.send-btn {
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.send-btn:active:not(:disabled) {
  transform: translateY(0);
}
</style>
