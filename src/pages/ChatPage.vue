<template>
  <!-- 背景与间距对齐 happy-app lightTheme：groupped.background / header -->
  <div class="chat-page flex h-screen flex-col bg-[#F5F5F5]">
    <header
      class="header sticky top-0 z-10 flex items-center justify-between border-b border-[#eaeaea] bg-white px-4 py-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-black text-[15px] font-semibold text-white">
          H
        </div>
        <div>
          <h1 class="text-[17px] font-semibold leading-tight text-[#18171C]">Happy</h1>
          <p class="text-xs text-[#49454F]">智能助手</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-3 py-1.5">
          <div class="h-2 w-2 rounded-full" :class="serverUrl ? 'bg-[#34C759]' : 'bg-[#C0C0C0]'"></div>
          <span class="text-xs text-[#49454F]">{{ serverUrl ? '已连接' : '未配置' }}</span>
        </div>

        <button
          type="button"
          class="rounded-lg p-2 transition-colors hover:bg-[#f0f0f2]"
          @click="$router.push('/settings')">
          <svg class="h-5 w-5 text-[#18171C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MessageList class="min-h-0 flex-1 overflow-hidden" />
      <InputBar />
    </div>

    <PermissionDialog v-if="pendingPermission" :request="pendingPermission" />
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

onMounted(() => {
  chatStore.initServerUrl()
  chatStore.loadHistory()
})

onUnmounted(() => {
  chatStore.cleanup()
})
</script>

<style scoped>
.header {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>
