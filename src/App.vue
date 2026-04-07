<template>
  <div class="chat-page flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- 头部导航 -->
    <header class="header bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div class="flex items-center space-x-3">
        <!-- Logo -->
        <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
          <span class="text-white text-xl">✨</span>
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-800">Happy AI</h1>
          <p class="text-xs text-gray-500">智能助手</p>
        </div>
      </div>

      <!-- 右侧操作 -->
      <div class="flex items-center space-x-2">
        <!-- 连接状态 -->
        <div class="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-gray-100">
          <div class="w-2 h-2 rounded-full"
               :class="serverUrl ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"></div>
          <span class="text-xs text-gray-600">{{ serverUrl ? 'HTTP API 已就绪' : '未配置' }}</span>
        </div>

        <!-- 设置按钮 -->
        <button @click="$router.push('/settings')"
                class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.066 2.573c.94 1.543.826 3.31 2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 聊天区域 -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- 消息列表 -->
        <MessageList class="flex-1 overflow-hidden" />

        <!-- 输入框 -->
        <InputBar />
      </div>
    </div>

    <!-- 权限确认对话框 -->
    <PermissionDialog v-if="pendingPermission" :request="pendingPermission" />

    <!-- 调试日志面板 -->
    <DebugPanel />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageList from '@/components/MessageList.vue'
import InputBar from '@/components/InputBar.vue'
import PermissionDialog from '@/components/PermissionDialog.vue'
import DebugPanel from '@/components/DebugPanel.vue'

const chatStore = useChatStore()
const serverUrl = computed(() => chatStore.serverUrl)
const pendingPermission = computed(() => chatStore.pendingPermission)

// 组件挂载时初始化
onMounted(() => {
  chatStore.initServerUrl()
  chatStore.loadHistory()
})

// 组件卸载时清理
onUnmounted(() => {
  chatStore.cleanup()
})
</script>

<style scoped>
.header {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>
