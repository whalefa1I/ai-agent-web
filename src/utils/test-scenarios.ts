/**
 * 联调测试脚本 - 模拟后端 API 返回各种消息类型
 * 用于测试前端组件渲染效果
 */

// 模拟测试数据
const testScenarios = [
  {
    name: '场景 1: 用户消息 + 助手回复',
    messages: [
      {
        id: 'msg_001',
        type: 'USER',
        content: '你好，请帮我创建一个测试文件',
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_002',
        type: 'ASSISTANT',
        content: '# 测试文件创建\n\n我已经为你创建了一个测试文件。\n\n```python\nprint("Hello World")\n```',
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    name: '场景 2: Bash 工具调用',
    messages: [
      {
        id: 'msg_003',
        type: 'USER',
        content: '执行 ls -la 命令',
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_004',
        type: 'TOOL',
        toolCall: {
          id: 'tool_001',
          name: 'bash',
          title: 'Terminal Command',
          args: { command: 'ls -la' },
          state: 'completed',
          result: {
            stdout: 'total 48\ndrwxr-xr-x  1 admin admin 4096 Apr  8 12:00 .\ndrwxr-xr-x  1 admin admin 4096 Apr  8 12:00 ..',
            stderr: '',
            exitCode: 0
          }
        },
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    name: '场景 3: Task 工具 - checkbox 样式',
    messages: [
      {
        id: 'msg_005',
        type: 'USER',
        content: '创建一个任务，先创建文件，再修改内容',
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_006',
        type: 'TOOL',
        toolCall: {
          id: 'task_001',
          name: 'TaskCreate',
          title: '创建测试文件',
          args: {
            subject: '创建测试文件',
            description: '创建一个包含测试内容的文件',
            activeForm: 'Creating test file...'
          },
          state: 'completed',
          result: {
            success: true,
            metadata: {
              task: {
                id: 'task_abc123',
                subject: '创建测试文件',
                status: 'completed'
              }
            }
          }
        },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_007',
        type: 'TOOL',
        toolCall: {
          id: 'task_002',
          name: 'TaskUpdate',
          title: 'Update: task_abc123',
          args: {
            task_id: 'task_abc123',
            status: 'in_progress',
            subject: '创建测试文件'
          },
          state: 'completed',
          result: {
            success: true,
            metadata: {
              task: {
                id: 'task_abc123',
                subject: '创建测试文件',
                status: 'in_progress'
              }
            }
          }
        },
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    name: '场景 4: Todo 列表',
    messages: [
      {
        id: 'msg_008',
        type: 'TODO',
        todo: {
          id: 'todo_001',
          content: '分析需求',
          status: 'completed'
        },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_009',
        type: 'TODO',
        todo: {
          id: 'todo_002',
          content: '编写代码',
          status: 'in_progress'
        },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_010',
        type: 'TODO',
        todo: {
          id: 'todo_003',
          content: '测试验证',
          status: 'pending'
        },
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    name: '场景 5: 文件操作工具',
    messages: [
      {
        id: 'msg_011',
        type: 'TOOL',
        toolCall: {
          id: 'tool_002',
          name: 'file_read',
          title: 'README.md',
          args: { file_path: '/path/to/README.md' },
          state: 'completed',
          result: {
            content: '# Project README\n\nThis is a test project.'
          }
        },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_012',
        type: 'TOOL',
        toolCall: {
          id: 'tool_003',
          name: 'file_write',
          title: 'test.txt',
          args: { file_path: '/path/to/test.txt', content: 'Hello World' },
          state: 'completed',
          result: {
            success: true,
            path: '/path/to/test.txt'
          }
        },
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    name: '场景 6: 工具执行状态测试',
    messages: [
      {
        id: 'msg_013',
        type: 'TOOL',
        toolCall: {
          id: 'tool_004',
          name: 'bash',
          title: 'Long Running Command',
          args: { command: 'sleep 10' },
          state: 'running'
        },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg_014',
        type: 'TOOL',
        toolCall: {
          id: 'tool_005',
          name: 'bash',
          title: 'Failed Command',
          args: { command: 'invalid_command' },
          state: 'failed',
          result: {
            error: 'Command not found'
          }
        },
        timestamp: new Date().toISOString()
      }
    ]
  }
];

// 打印测试场景
console.log('='.repeat(60));
console.log('Happy AI 前端组件联调测试脚本');
console.log('='.repeat(60));
console.log('');

testScenarios.forEach((scenario, index) => {
  console.log(`\n${scenario.name}`);
  console.log('-'.repeat(40));
  scenario.messages.forEach(msg => {
    console.log(`  [${msg.type}] ${msg.id}`);
    if (msg.toolCall) {
      console.log(`    Tool: ${msg.toolCall.name}, State: ${msg.toolCall.state}`);
    }
    if (msg.todo) {
      console.log(`    Todo: ${msg.todo.content} - ${msg.todo.status}`);
    }
  });
});

console.log('');
console.log('='.repeat(60));
console.log('测试场景已准备就绪');
console.log('请在浏览器控制台查看前端组件渲染日志');
console.log('='.repeat(60));

export { testScenarios };
