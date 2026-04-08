<template>
  <Transition name="fade">
    <div v-if="request" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        <!-- 头部：风险等级标识 -->
        <div class="px-6 py-4 border-b flex items-center space-x-3"
             :style="{ backgroundColor: `${request.header.levelColor}15` }">
          <span class="text-2xl">{{ request.header.levelIcon }}</span>
          <div>
            <h3 class="font-semibold text-lg" :style="{ color: request.header.levelColor }">
              {{ request.header.levelLabel }}权限请求
            </h3>
            <p class="text-sm text-gray-500">{{ request.header.toolDisplayName }}</p>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="p-6 space-y-4">
          <!-- 工具描述 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="text-sm text-gray-700">{{ request.header.toolDescription }}</p>
          </div>

          <!-- 输入摘要 -->
          <div v-if="request.body.inputSummary" class="space-y-2">
            <h4 class="font-medium text-sm text-gray-600">执行参数</h4>
            <pre class="bg-gray-100 rounded-lg p-3 text-sm text-gray-800 overflow-x-auto">{{ request.body.inputSummary }}</pre>
          </div>

          <!-- 风险说明 -->
          <div v-if="request.body.riskExplanation" class="space-y-2">
            <h4 class="font-medium text-sm text-gray-600">风险说明</h4>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p class="text-sm text-gray-700">{{ request.body.riskExplanation }}</p>
            </div>
          </div>

          <!-- 权限选项按钮 -->
          <div class="space-y-2">
            <h4 class="font-medium text-sm text-gray-600">请选择</h4>
            <div class="grid gap-2">
              <button
                v-for="option in permissionOptions"
                :key="option.value"
                @click="handleRespond(option.value)"
                :class="[
                  'permission-btn px-4 py-3 rounded-xl text-left transition-all duration-200',
                  getButtonStyle(option.style)
                ]"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium">{{ option.label }}</div>
                    <div v-if="option.description" class="text-xs text-gray-500 mt-1">
                      {{ option.description }}
                    </div>
                  </div>
                  <span class="text-xs text-gray-400">
                    {{ option.shortcut ? `快捷键：${option.shortcut}` : '' }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PermissionArtifact } from '@/types/happy-protocol'
import { useChatStore } from '@/stores/chat'

// @ts-ignore - 类型定义中包含 body 属性
const props = defineProps<{
  request: PermissionArtifact
}>()

const chatStore = useChatStore()

const permissionOptions = computed(
  () => props.request.body?.permissionOptions ?? []
)

// 处理响应
function handleRespond(choice: string) {
  chatStore.respondPermission(props.request.id, choice as any)
}

// 按钮样式映射
const getButtonStyle = (style: string) => {
  const styles: Record<string, string> = {
    default: 'bg-[#F5F5F5] hover:bg-[#eaeaea] text-[#18171C]',
    primary: 'bg-black hover:bg-[#1a1a1a] text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  }
  return styles[style] || styles.default
}
</script>

<style scoped>
.permission-btn {
  border: 2px solid transparent;
}

.permission-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.permission-btn:active {
  transform: translateY(0);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
