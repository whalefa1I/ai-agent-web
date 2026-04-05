<template>
  <div class="todo-view">
    <div v-if="todos && todos.length > 0" class="todo-list">
      <div v-for="(todo, index) in todos" :key="todo.id || index" class="todo-item">
        <span class="todo-checkbox">{{ getCheckbox(todo.status) }}</span>
        <span :class="['todo-content', getStatusClass(todo.status)]">
          {{ todo.content }}
        </span>
      </div>
    </div>
    <div v-else-if="toolCall.body?.output" class="todo-output">
      <pre class="text-xs text-gray-600 whitespace-pre-wrap">{{ toolCall.body.output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: 'high' | 'medium' | 'low'
  id?: string
}

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 从工具调用中提取待办事项
const todos = computed(() => {
  const output = props.toolCall.body?.output
  if (!output) return []

  // 尝试从输出中解析待办事项
  // 格式通常是：Created todo item:\n  ID: xxx\n  Content: xxx...
  const todos: TodoItem[] = []

  // 简单解析：查找包含 "Created todo item" 或 "Todo Items" 的部分
  const lines = output.split('\n')
  let currentTodo: Partial<TodoItem> = {}

  for (const line of lines) {
    if (line.includes('Created todo item:')) {
      if (currentTodo.content) {
        todos.push(currentTodo as TodoItem)
      }
      currentTodo = {}
    } else if (line.includes('Content:')) {
      currentTodo.content = line.replace('Content:', '').trim()
    } else if (line.includes('Status:')) {
      const statusStr = line.replace('Status:', '').trim().toLowerCase()
      if (statusStr.includes('pending')) currentTodo.status = 'pending'
      else if (statusStr.includes('progress')) currentTodo.status = 'in_progress'
      else if (statusStr.includes('completed')) currentTodo.status = 'completed'
    } else if (line.includes('ID:')) {
      currentTodo.id = line.replace('ID:', '').trim()
    }
  }

  if (currentTodo.content) {
    todos.push(currentTodo as TodoItem)
  }

  return todos
})

// 获取复选框符号
const getCheckbox = (status: string) => {
  switch (status) {
    case 'completed': return '☑'
    case 'in_progress': return '☐'
    default: return '☐'
  }
}

// 获取状态样式
const getStatusClass = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-600 line-through'
    case 'in_progress': return 'text-blue-600'
    default: return 'text-gray-600'
  }
}
</script>

<style scoped>
.todo-view {
  padding: 8px 0;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.todo-checkbox {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.todo-content {
  font-size: 14px;
  line-height: 1.5;
  flex: 1;
}
</style>
