/**
 * 工具元数据注册系统
 *
 * 定义每个工具的显示属性：图标、标题、描述提取函数等
 * 与 claude-code 协议保持一致
 */

// 工具状态枚举
export type ToolState = 'started' | 'in_progress' | 'completed' | 'failed' | 'pending'

// 工具图标类型
export type ToolIconType = 'file' | 'terminal' | 'search' | 'edit' | 'todo' | 'task' | 'web' | 'default'

// 工具元数据接口
export interface ToolMetadata {
  name: string
  displayName: string
  icon: ToolIconType
  // 是否最简化显示（不显示详细内容）
  minimal?: boolean
  // 提取标题函数
  extractTitle?: (input: Record<string, any>) => string
  // 提取描述函数
  extractDescription?: (input: Record<string, any>) => string
  // 提取状态函数
  extractStatus?: (body: Record<string, any>) => string
}

// 图标映射
export const TOOL_ICONS: Record<ToolIconType, string> = {
  file: '📄',
  terminal: '💻',
  search: '🔍',
  edit: '📝',
  todo: '📋',
  task: '🤖',
  web: '🌐',
  default: '🔧'
}

// 工具注册表
export const toolRegistry: Record<string, ToolMetadata> = {
  // Bash 工具
  bash: {
    name: 'bash',
    displayName: '执行命令',
    icon: 'terminal',
    minimal: true,
    extractTitle: (input) => {
      const cmd = input.command as string
      if (!cmd) return '执行命令'
      // 提取命令名
      const firstWord = cmd.split(' ')[0]
      return firstWord.length > 20 ? firstWord.substring(0, 20) + '...' : firstWord
    },
    extractDescription: (input) => {
      const cmd = input.command as string
      const description = input.description as string
      // 优先使用 AI 提供的 description 字段
      if (description) return description
      return cmd || '执行 Shell 命令'
    },
    extractStatus: (body) => {
      if (body.status === 'completed') return 'completed'
      if (body.status === 'failed') return 'failed'
      if (body.progress) return 'in_progress'
      return 'started'
    }
  },

  // 文件读取工具
  file_read: {
    name: 'file_read',
    displayName: '读取文件',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const filePath = input.file_path as string
      if (!filePath) return '读取文件'
      // 提取文件名
      const parts = filePath.split(/[\\/]/)
      return parts[parts.length - 1] || '读取文件'
    },
    extractDescription: (input) => {
      const filePath = input.file_path as string
      const offset = input.offset as number
      const limit = input.limit as number
      let desc = filePath
      if (offset !== undefined) desc += `:${offset}`
      if (limit !== undefined) desc += `+${limit}`
      return desc
    }
  },

  // 文件写入工具
  file_write: {
    name: 'file_write',
    displayName: '写入文件',
    icon: 'edit',
    minimal: false,
    extractTitle: (input) => {
      const filePath = (input.file_path || input.path || input.target_path) as string
      if (!filePath) return '写入文件'
      const parts = String(filePath).split(/[\\/]/)
      return parts[parts.length - 1] || '写入文件'
    },
    extractDescription: (input) => {
      const filePath = (input.file_path || input.path || input.target_path) as string
      return filePath ? `写入：${filePath}` : '写入文件'
    }
  },

  // 文件编辑工具
  file_edit: {
    name: 'file_edit',
    displayName: '编辑文件',
    icon: 'edit',
    minimal: false,
    extractTitle: (input) => {
      const filePath = input.file_path as string
      if (!filePath) return '编辑文件'
      const parts = filePath.split(/[\\/]/)
      return parts[parts.length - 1] || '编辑文件'
    },
    extractDescription: (input) => {
      const filePath = input.file_path as string
      const oldString = input.old_string as string
      const newString = input.new_string as string
      const snippet = oldString ? `"${oldString.substring(0, 20)}${oldString.length > 20 ? '...' : ''}" → "${newString?.substring(0, 20) || ''}${(newString?.length || 0) > 20 ? '...' : ''}"` : ''
      return filePath ? `编辑：${filePath}${snippet ? ' ' + snippet : ''}` : '编辑文件'
    }
  },

  // 文件搜索工具（glob）
  glob: {
    name: 'glob',
    displayName: '文件搜索',
    icon: 'search',
    minimal: true,
    extractTitle: (input) => {
      const pattern = input.pattern as string
      return pattern || '文件搜索'
    },
    extractDescription: (input) => {
      const pattern = input.pattern as string
      const path = input.path as string
      if (path) return `${pattern} (in ${path})`
      return pattern
    }
  },

  // 文本搜索工具（grep）
  grep: {
    name: 'grep',
    displayName: '文本搜索',
    icon: 'search',
    minimal: true,
    extractTitle: (input) => {
      const pattern = input.pattern as string
      return `grep: ${pattern?.substring(0, 20) || ''}${pattern?.length > 20 ? '...' : ''}`
    },
    extractDescription: (input) => {
      const pattern = input.pattern as string
      const path = input.path as string
      if (path) return `在 ${path} 中搜索 "${pattern}"`
      return `搜索 "${pattern}"`
    }
  },

  // 目录列表工具（ls）
  ls: {
    name: 'ls',
    displayName: '列出目录',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const path = input.path as string
      if (!path) return '列出目录'
      const parts = path.split(/[\\/]/)
      return parts[parts.length - 1] || '列出目录'
    },
    extractDescription: (input) => {
      const path = input.path as string
      const recursive = input.recursive as boolean
      return `列出目录：${path}${recursive ? ' (递归)' : ''}`
    }
  },

  // 多编辑工具
  multi_edit: {
    name: 'multi_edit',
    displayName: '多重编辑',
    icon: 'edit',
    minimal: false,
    extractTitle: (input) => {
      const edits = input.edits as Array<{ file_path?: string }>
      if (!edits || edits.length === 0) return '多重编辑'
      const count = edits.length
      const files = new Set(edits.map(e => e.file_path).filter(Boolean))
      return `${count} 个编辑 (${files.size} 个文件)`
    },
    extractDescription: (input) => {
      const edits = input.edits as Array<{ file_path?: string; old_string?: string; new_string?: string }>
      if (!edits || edits.length === 0) return ''
      return edits.map(e => {
        const oldStr = e.old_string?.substring(0, 20) || ''
        const newStr = e.new_string?.substring(0, 20) || ''
        return `${e.file_path}: "${oldStr}" → "${newStr}"`
      }).join('; ')
    }
  },

  // MCP 工具
  mcp_connect: {
    name: 'mcp_connect',
    displayName: '连接 MCP',
    icon: 'web',
    minimal: true,
    extractTitle: (input) => {
      const server = input.server_name as string
      return `连接 MCP: ${server || '服务器'}`
    },
    extractDescription: (input) => {
      const server = input.server_name as string
      return `连接到 MCP 服务器：${server}`
    }
  },

  mcp_disconnect: {
    name: 'mcp_disconnect',
    displayName: '断开 MCP',
    icon: 'web',
    minimal: true,
    extractTitle: (input) => {
      const server = input.server_name as string
      return `断开 MCP: ${server || '服务器'}`
    },
    extractDescription: (input) => {
      const server = input.server_name as string
      return `断开 MCP 服务器：${server}`
    }
  },

  // Skills 工具
  skill_install: {
    name: 'skill_install',
    displayName: '安装技能',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const skill = input.skill_id as string
      return `安装技能：${skill || '?'}`
    },
    extractDescription: (input) => {
      const skill = input.skill_id as string
      const version = input.version as string
      return `安装技能 ${skill}${version ? ` (v${version})` : ''}`
    }
  },

  skill_uninstall: {
    name: 'skill_uninstall',
    displayName: '卸载技能',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const skill = input.skill_id as string
      return `卸载技能：${skill || '?'}`
    },
    extractDescription: (input) => {
      const skill = input.skill_id as string
      return `卸载技能：${skill}`
    }
  },

  skill_search: {
    name: 'skill_search',
    displayName: '搜索技能',
    icon: 'search',
    minimal: true,
    extractTitle: (input) => {
      const query = input.query as string
      return `搜索技能：${query || '...'}`
    },
    extractDescription: (input) => {
      const query = input.query as string
      return `搜索 ClawHub 技能：${query}`
    }
  },

  // 待办事项工具（claude-code 风格 - 声明式）
  todo_write: {
    name: 'todo_write',
    displayName: '待办事项',
    icon: 'todo',
    minimal: false,
    extractTitle: (input) => {
      const todos = input.todos as Array<{ content?: string; status?: string }>
      // 防御性检查：确保 todos 是数组
      if (!todos || !Array.isArray(todos) || todos.length === 0) return '待办事项'
      const count = todos.length
      const completed = todos.filter(t => t.status === 'completed').length
      return `待办 (${completed}/${count} 完成)`
    },
    extractDescription: (input) => {
      const todos = input.todos as Array<{ content?: string; status?: string }>
      // 防御性检查：确保 todos 是数组
      if (!todos || !Array.isArray(todos) || todos.length === 0) return ''
      // 显示新增或变更的 todo
      const changedTodos = todos
        .filter(t => t.content)
        .map(t => `${t.status || 'pending'}: ${t.content}`)
        .join(', ')
      return changedTodos || '更新待办列表'
    }
  },

  // 任务委派工具
  Task: {
    name: 'Task',
    displayName: '委派任务',
    icon: 'task',
    minimal: false,
    extractTitle: (input) => {
      const description = input.description as string
      return description || '委派任务'
    },
    extractDescription: (input) => {
      const prompt = input.prompt as string
      return prompt || '将任务委派给子 Agent'
    }
  },

  // Task 工具集 - 任务管理
  TaskCreate: {
    name: 'TaskCreate',
    displayName: '创建任务',
    icon: 'task',
    minimal: false,
    extractTitle: (input) => {
      const subject = input.subject as string
      return subject || '创建任务'
    },
    extractDescription: (input) => {
      const description = input.description as string
      const activeForm = input.activeForm as string
      return description || activeForm || '创建新任务'
    }
  },

  TaskList: {
    name: 'TaskList',
    displayName: '任务列表',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const status = input.status as string
      return status ? `${status} 任务` : '任务列表'
    },
    extractDescription: (input) => {
      const status = input.status as string
      return status ? `筛选状态：${status}` : '列出所有任务'
    }
  },

  TaskGet: {
    name: 'TaskGet',
    displayName: '查看任务',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return taskId || '查看任务'
    },
    extractDescription: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return `查看任务详情：${taskId}`
    }
  },

  TaskUpdate: {
    name: 'TaskUpdate',
    displayName: '更新任务',
    icon: 'task',
    minimal: false,
    extractTitle: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      const status = input.status as string
      return status ? `${status} 任务` : `更新：${taskId?.substring(0, 12) || ''}`
    },
    extractDescription: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      const status = input.status as string
      const subject = input.subject as string
      const updates: string[] = []
      if (status) updates.push(`状态：${status}`)
      if (subject) updates.push(`主题：${subject}`)
      return `更新任务 ${taskId}: ${updates.join(', ')}`
    }
  },

  TaskStop: {
    name: 'TaskStop',
    displayName: '停止任务',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return taskId || '停止任务'
    },
    extractDescription: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return `停止任务：${taskId}`
    }
  },

  TaskOutput: {
    name: 'TaskOutput',
    displayName: '任务输出',
    icon: 'task',
    minimal: true,
    extractTitle: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return taskId || '任务输出'
    },
    extractDescription: (input) => {
      const taskId = (input.taskId as string) || (input.task_id as string)
      return `获取任务输出：${taskId}`
    }
  },

  // AskUserQuestion 工具 - 用户交互
  AskUserQuestion: {
    name: 'AskUserQuestion',
    displayName: '选择',
    icon: 'todo',
    minimal: false,
    extractTitle: (input) => {
      const questions = input.questions as Array<{ question?: string }>
      if (!questions || questions.length === 0) return '用户选择'
      const firstQuestion = questions[0].question
      return firstQuestion?.substring(0, 30) || '用户选择'
    },
    extractDescription: (input) => {
      const questions = input.questions as Array<{ question?: string; options?: Array<{ label?: string }> }>
      if (!questions || questions.length === 0) return ''
      return questions.map(q => {
        const options = q.options?.map(o => o.label).join(', ') || ''
        return `${q.question}: [${options}]`
      }).join('; ')
    }
  },

  // Web 工具
  web_search: {
    name: 'web_search',
    displayName: '网络搜索',
    icon: 'web',
    minimal: true,
    extractTitle: (input) => {
      const query = input.query as string
      return query || '网络搜索'
    },
    extractDescription: (input) => {
      const query = input.query as string
      const site = input.site as string
      const fileType = input.fileType as string
      let desc = `搜索：${query}`
      if (site) desc += ` (site:${site})`
      if (fileType) desc += ` (filetype:${fileType})`
      return desc
    }
  },

  web_fetch: {
    name: 'web_fetch',
    displayName: '获取网页',
    icon: 'web',
    minimal: true,
    extractTitle: (input) => {
      const url = input.url as string
      if (!url) return '获取网页'
      try {
        const urlObj = new URL(url)
        return urlObj.hostname + urlObj.pathname.substring(0, 20)
      } catch {
        return url
      }
    },
    extractDescription: (input) => {
      const url = input.url as string
      return url || '获取网页内容'
    }
  },

  // 文件操作工具
  FileDelete: {
    name: 'FileDelete',
    displayName: '删除文件',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const path = input.path as string
      if (!path) return '删除文件'
      const parts = path.split(/[\\/]/)
      return parts[parts.length - 1] || '删除文件'
    },
    extractDescription: (input) => {
      const path = input.path as string
      const recursive = input.recursive as boolean
      return `删除：${path}${recursive ? ' (递归)' : ''}`
    }
  },

  local_file_copy: {
    name: 'local_file_copy',
    displayName: '复制文件',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const source = input.source as string
      if (!source) return '复制文件'
      const parts = source.split(/[\\/]/)
      return parts[parts.length - 1] || '复制文件'
    },
    extractDescription: (input) => {
      const source = input.source as string
      const destination = input.destination as string
      const recursive = input.recursive as boolean
      return `${source} → ${destination}${recursive ? ' (递归)' : ''}`
    }
  },

  local_mkdir: {
    name: 'local_mkdir',
    displayName: '目录操作',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const action = input.action as string
      const path = input.path as string
      if (!path) return action || '目录操作'
      const parts = path.split(/[\\/]/)
      return `${action || 'create'}: ${parts[parts.length - 1]}`
    },
    extractDescription: (input) => {
      const action = input.action as string
      const path = input.path as string
      const recursive = input.recursive as boolean
      const actionText = action === 'create' ? '创建' : action === 'list' ? '列出' : '删除'
      return `${actionText}目录：${path}${recursive ? ' (递归)' : ''}`
    }
  },

  // 计划模式工具
  ExitPlanMode: {
    name: 'ExitPlanMode',
    displayName: '提交计划',
    icon: 'todo',
    minimal: false,
    extractTitle: () => '提交计划',
    extractDescription: (input) => {
      const plan = input.plan as string
      return plan ? `计划：${plan.substring(0, 50)}${plan.length > 50 ? '...' : ''}` : '提交计划模式'
    }
  }
}

// 获取工具元数据
export function getToolMetadata(toolName: string): ToolMetadata {
  return toolRegistry[toolName] || {
    name: toolName,
    displayName: toolName,
    icon: 'default',
    minimal: false
  }
}
