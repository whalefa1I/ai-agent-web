/**
 * 工具视图组件注册
 */
import type { Component } from 'vue'

import TodoView from './TodoView.vue'
import BashView from './BashView.vue'
import EditView from './EditView.vue'
import FileReadView from './FileReadView.vue'
import TaskView from './TaskView.vue'
import AskUserQuestionView from './AskUserQuestionView.vue'
import ExitPlanModeView from './ExitPlanModeView.vue'
import LSView from './LSView.vue'
import MultiEditView from './MultiEditView.vue'
import McpServerView from './McpServerView.vue'
import SkillsView from './SkillsView.vue'

// 工具视图注册表
export const toolViews: Record<string, Component> = {
  todo_write: TodoView,
  bash: BashView,
  file_edit: EditView,
  file_write: EditView,
  file_read: FileReadView,
  // Task 工具集
  TaskCreate: TaskView,
  TaskList: TaskView,
  TaskGet: TaskView,
  TaskUpdate: TaskView,
  TaskStop: TaskView,
  TaskOutput: TaskView,
  // AskUserQuestion 工具
  AskUserQuestion: AskUserQuestionView,
  // ExitPlanMode 工具
  ExitPlanMode: ExitPlanModeView,
  // LS 工具
  ls: LSView,
  // MultiEdit 工具
  multi_edit: MultiEditView,
  // MCP 工具
  mcp_connect: McpServerView,
  mcp_disconnect: McpServerView,
  // Skills 工具
  skill_install: SkillsView,
  skill_uninstall: SkillsView,
  skill_search: SkillsView
}

// 获取工具视图组件
export function getToolView(toolName: string): Component | null {
  return toolViews[toolName] || null
}
