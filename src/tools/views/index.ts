/**
 * 工具视图组件注册
 */
import type { Component } from 'vue'

import TodoView from './TodoView.vue'
import BashView from './BashView.vue'
import EditView from './EditView.vue'
import FileReadView from './FileReadView.vue'

// 工具视图注册表
export const toolViews: Record<string, Component> = {
  todo_write: TodoView,
  bash: BashView,
  file_edit: EditView,
  file_read: FileReadView
}

// 获取工具视图组件
export function getToolView(toolName: string): Component | null {
  return toolViews[toolName] || null
}
