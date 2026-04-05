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
import { computed } from 'vue'
import type { ToolCallArtifact } from '@/types/happy-protocol'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
  id?: string
}

const props = defineProps<{
  toolCall: ToolCallArtifact
}>()

// 从工具调用中提取待办事项
const todos = computed(() => {
  // 首先尝试从 metadata 中获取 newTodos（claude-code 风格）
  const metadata = props.toolCall.body?.metadata
  if (metadata && Array.isArray(metadata.newTodos)) {
    return metadata.newTodos.map((todo: any) => ({
      content: todo.content,
      status: todo.status,
      activeForm: todo.activeForm,
      id: todo.id
    }))
  }

  // 尝试从 output 中解析
  const output = props.toolCall.body?.output as string
  if (!output) return []

  const todos: TodoItem[] = []
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

// 获取状态样式类
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
