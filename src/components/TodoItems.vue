<template>
  <div class="todo-items space-y-2">
    <div v-for="todo in todos" :key="todo.id"
         class="todo-item-card">
      <div class="flex items-center space-x-3">
        <!-- 待办图标和状态 -->
        <div class="text-xl">
          <span v-if="todo.body.status === 'pending'">⏳</span>
          <span v-else-if="todo.body.status === 'in_progress'">🔄</span>
          <span v-else-if="todo.body.status === 'completed'">✅</span>
        </div>

        <!-- 待办内容 -->
        <div class="flex-1 min-w-0">
          <!-- 待办事项内容 -->
          <div class="text-sm text-gray-800">
            {{ todo.body.content }}
          </div>

          <!-- 负责人和状态 -->
          <div class="flex items-center space-x-2 mt-1">
            <span v-if="todo.body.assignee" class="text-xs text-gray-500">
              负责人：{{ todo.body.assignee }}
            </span>
            <span :class="[
              'px-2 py-0.5 rounded-full text-xs font-medium',
              getStatusClass(todo.body.status)
            ]">
              {{ getStatusText(todo.body.status) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="todos.length === 0" class="text-center text-gray-500 py-4">
      暂无待办事项
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TodoArtifact } from '@/types/happy-protocol'

defineProps<{
  todos: TodoArtifact[]
}>()

// 获取状态样式类
const getStatusClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'pending':
      return '待处理'
    case 'in_progress':
      return '进行中'
    case 'completed':
      return '已完成'
    default:
      return status
  }
}
</script>

<style scoped>
.todo-item-card {
  padding: 8px 0;
}
</style>
