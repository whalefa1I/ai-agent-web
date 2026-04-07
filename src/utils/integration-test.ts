/**
 * 前端联调测试脚本
 * 用于在浏览器中模拟各种消息和工具调用场景
 */

import { logger } from './debug-logger';

// 测试场景数据
const testMessages = [
  // 场景 1: 用户消息
  {
    id: 'user_001',
    type: 'USER' as const,
    content: '你好，请帮我创建一个测试文件 test.txt，内容为"这是测试内容"',
    timestamp: new Date().toISOString()
  },
  // 场景 2: 助手回复
  {
    id: 'assistant_001',
    type: 'ASSISTANT' as const,
    content: `# 文件创建完成

我已经为你创建了测试文件。

## 文件信息
- 路径：\`test.txt\`
- 内容：这是测试内容

\`\`\`bash
$ cat test.txt
这是测试内容
\`\`\`
`,
    timestamp: new Date().toISOString()
  },
  // 场景 3: TaskCreate - 创建任务
  {
    id: 'tool_task_create_001',
    type: 'TOOL' as const,
    toolCall: {
      id: 'task_create_001',
      header: {
        type: 'tool-call',
        subtype: 'TaskCreate',
        toolName: 'TaskCreate',
        toolDisplayName: 'Create Task',
        icon: '💡',
        timestamp: Date.now()
      },
      body: {
        input: {
          subject: '创建测试文件',
          description: '创建一个包含测试内容的文件',
          activeForm: 'Creating test file...'
        },
        status: 'completed',
        output: {
          success: true,
          metadata: {
            task: {
              id: 'task_abc123',
              subject: '创建测试文件',
              description: '创建一个包含测试内容的文件',
              status: 'completed',
              activeForm: 'Creating test file...'
            }
          }
        }
      }
    },
    timestamp: new Date().toISOString()
  },
  // 场景 4: TaskUpdate - 更新任务状态
  {
    id: 'tool_task_update_001',
    type: 'TOOL' as const,
    toolCall: {
      id: 'task_update_001',
      header: {
        type: 'tool-call',
        subtype: 'TaskUpdate',
        toolName: 'TaskUpdate',
        toolDisplayName: 'Update Task',
        icon: '✓',
        timestamp: Date.now()
      },
      body: {
        input: {
          task_id: 'task_abc123',
          status: 'in_progress',
          subject: '创建测试文件'
        },
        status: 'completed',
        output: {
          success: true,
          metadata: {
            task: {
              id: 'task_abc123',
              subject: '创建测试文件',
              status: 'in_progress'
            }
          }
        }
      }
    },
    timestamp: new Date().toISOString()
  },
  // 场景 5: Bash 工具
  {
    id: 'tool_bash_001',
    type: 'TOOL' as const,
    toolCall: {
      id: 'bash_001',
      header: {
        type: 'tool-call',
        subtype: 'bash',
        toolName: 'bash',
        toolDisplayName: 'Terminal Command',
        icon: '⌨️',
        timestamp: Date.now()
      },
      body: {
        input: {
          command: 'echo "这是测试内容" > test.txt'
        },
        status: 'completed',
        output: {
          duration: 1250,
          success: true,
          content: 'Command executed successfully',
          exitCode: 0
        },
        durationMs: 1250
      }
    },
    timestamp: new Date().toISOString()
  },
  // 场景 6: File Write 工具
  {
    id: 'tool_file_write_001',
    type: 'TOOL' as const,
    toolCall: {
      id: 'file_write_001',
      header: {
        type: 'tool-call',
        subtype: 'file_write',
        toolName: 'file_write',
        toolDisplayName: 'Write File',
        icon: '✏️',
        timestamp: Date.now()
      },
      body: {
        input: {
          file_path: 'test.txt',
          content: '这是测试内容'
        },
        status: 'completed',
        output: {
          success: true,
          path: 'test.txt'
        }
      }
    },
    timestamp: new Date().toISOString()
  },
  // 场景 7: Todo 列表
  {
    id: 'todo_001',
    type: 'TODO' as const,
    todo: {
      id: 'todo_item_001',
      content: '分析需求',
      status: 'completed'
    },
    timestamp: new Date().toISOString()
  },
  {
    id: 'todo_002',
    type: 'TODO' as const,
    todo: {
      id: 'todo_item_002',
      content: '编写代码',
      status: 'in_progress'
    },
    timestamp: new Date().toISOString()
  },
  {
    id: 'todo_003',
    type: 'TODO' as const,
    todo: {
      id: 'todo_item_003',
      content: '测试验证',
      status: 'pending'
    },
    timestamp: new Date().toISOString()
  },
  // 场景 8: 失败的工具调用
  {
    id: 'tool_bash_failed_001',
    type: 'TOOL' as const,
    toolCall: {
      id: 'bash_failed_001',
      header: {
        type: 'tool-call',
        subtype: 'bash',
        toolName: 'bash',
        toolDisplayName: 'Terminal Command',
        icon: '⌨️',
        timestamp: Date.now()
      },
      body: {
        input: {
          command: 'invalid_command_that_does_not_exist'
        },
        status: 'failed',
        error: 'Command not found: invalid_command_that_does_not_exist'
      }
    },
    timestamp: new Date().toISOString()
  }
];

// 模拟加载测试消息
export function loadTestMessages() {
  logger.info('TestRunner', 'Loading test messages', { count: testMessages.length });
  return testMessages;
}

// 打印测试报告
export function printTestReport() {
  console.log('='.repeat(60));
  console.log('Happy AI 前端组件联调测试报告');
  console.log('='.repeat(60));
  console.log('');

  const report = {
    totalMessages: testMessages.length,
    userMessages: testMessages.filter(m => m.type === 'USER').length,
    assistantMessages: testMessages.filter(m => m.type === 'ASSISTANT').length,
    toolCalls: testMessages.filter(m => m.type === 'TOOL').length,
    todos: testMessages.filter(m => m.type === 'TODO').length
  };

  console.log('消息统计:');
  console.log(`  - 总消息数：${report.totalMessages}`);
  console.log(`  - 用户消息：${report.userMessages}`);
  console.log(`  - 助手消息：${report.assistantMessages}`);
  console.log(`  - 工具调用：${report.toolCalls}`);
  console.log(`  - Todo 事项：${report.todos}`);
  console.log('');

  // 工具调用详情
  const toolMessages = testMessages.filter(m => m.type === 'TOOL');
  console.log('工具调用详情:');
  toolMessages.forEach(tm => {
    const toolName = (tm.toolCall as any)?.header?.subtype || 'unknown';
    const toolState = (tm.toolCall as any)?.body?.status || 'unknown';
    console.log(`  - ${toolName}: ${toolState}`);
  });
  console.log('');

  console.log('='.repeat(60));
  console.log('测试准备就绪，请在浏览器中查看组件渲染效果');
  console.log('='.repeat(60));

  return report;
}

// 导出测试数据
export default {
  testMessages,
  loadTestMessages,
  printTestReport
};
