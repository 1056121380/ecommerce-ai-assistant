# 电商AI助手 - 开发指南

## 项目概述

这是一个基于 Tauri 2 + Vue 3 + TypeScript 的桌面应用，用于连接大语言模型进行电商数据分析。

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Element Plus + Pinia
- **后端**: Tauri 2 (Rust)
- **测试**: Vitest
- **打包**: Tauri Bundler

## 项目结构

```
ecommerce-ai-assistant/
├── src/                      # Vue 前端代码
│   ├── components/          # 可复用组件
│   ├── views/              # 页面视图
│   ├── stores/             # Pinia 状态管理
│   ├── services/           # 业务逻辑服务
│   │   ├── llm.ts         # LLM API 调用封装
│   │   ├── storage.ts     # 本地存储封装
│   │   ├── analyzer.ts    # 数据分析逻辑
│   │   └── fileImport.ts  # 文件导入处理
│   ├── router.ts          # 路由配置
│   └── main.ts            # 应用入口
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs        # 主要逻辑和 Tauri 命令
│   │   └── main.rs       # 入口文件
│   ├── Cargo.toml        # Rust 依赖
│   └── tauri.conf.json   # Tauri 配置
├── public/                # 静态资源
├── scripts/               # 构建脚本
└── SPEC.md               # 详细规范文档
```

## 核心功能模块

### 1. LLM 服务 (src/services/llm.ts)

支持多个 LLM 提供商：
- OpenAI 兼容接口
- Anthropic Claude
- MiniMax
- Kimi (Moonshot)
- 硅基流动 (SiliconFlow)
- Ollama 本地模型

**关键特性**:
- 流式和非流式响应
- 自动重试和降级
- 请求诊断和错误处理
- 超时控制 (45秒)

### 2. 存储服务 (src/services/storage.ts)

**API Key 存储**:
- Tauri 环境: 使用系统凭据存储 (Windows Credential Manager)
- 浏览器环境: 降级到 sessionStorage
- Base64 编码传输

**应用数据存储**:
- Tauri 环境: 应用数据目录
- 浏览器环境: localStorage

**允许的数据文件**:
- `llm_config.json` - LLM 配置
- `chat_sessions.json` - 对话历史
- `analysis_results.json` - 分析结果
- `data_source_cache.json` - 数据源缓存
- `public_data_cache.json` - 公开数据缓存

### 3. Rust 后端命令 (src-tauri/src/lib.rs)

**已实现的 Tauri 命令**:
- `greet(name)` - 测试命令
- `save_app_data(file_name, content)` - 保存应用数据
- `load_app_data(file_name)` - 加载应用数据
- `save_api_key(account, api_key)` - 保存 API Key 到系统凭据
- `load_api_key(account)` - 从系统凭据加载 API Key
- `delete_api_key(account)` - 删除 API Key
- `post_json(endpoint, headers, body, timeout_secs)` - HTTP POST 请求
- `get_text(endpoint, timeout_secs)` - HTTP GET 请求（仅限白名单域名）

**安全限制**:
- 数据文件访问受白名单限制
- 公开数据源 GET 请求仅允许特定域名
- 所有请求强制 HTTPS（公开数据源）

## 开发工作流

### 本地开发

```bash
# 安装依赖
npm install

# 启动 Web 开发服务器
npm run dev

# 启动 Tauri 桌面应用
npm run tauri dev
```

### 测试

```bash
# 运行单元测试
npm run test

# 类型检查 + 构建测试
npm run check
```

### 构建发布

```bash
# 生成可执行文件
npm run release:exe

# 生成 ZIP 包
npm run release:zip
```

构建产物位于 `release/` 目录。

## 代码规范

### TypeScript

- 使用严格模式
- 优先使用 `interface` 而非 `type`
- 导出的函数和类必须有 JSDoc 注释
- 避免使用 `any`，使用 `unknown` 代替

### Vue 组件

- 使用 Composition API (`<script setup>`)
- Props 和 Emits 必须定义类型
- 使用 `defineProps` 和 `defineEmits`
- 组件文件名使用 PascalCase

### Rust

- 遵循 Rust 标准命名规范
- 所有公开函数添加文档注释
- 使用 `Result<T, String>` 返回错误
- 避免 `unwrap()`，使用 `?` 或 `map_err`

## 常见问题

### API 连接失败

1. 检查 API Endpoint 是否正确
2. 检查 API Key 是否有效
3. 检查网络连接和代理设置
4. 查看诊断面板的详细错误信息

### Tauri 命令调用失败

1. 确认命令已在 `lib.rs` 中注册
2. 检查参数类型是否匹配
3. 查看 Rust 控制台的错误日志

### 构建失败

1. 确保 Rust 工具链已安装
2. 确保 Node.js 版本 >= 18
3. 清理缓存: `rm -rf node_modules dist src-tauri/target`
4. 重新安装: `npm install`

## 扩展开发

### 添加新的 LLM 提供商

1. 在 `src/stores/settings.ts` 添加模型配置
2. 在 `src/services/llm.ts` 添加 API 调用逻辑
3. 更新 UI 选择器

### 添加新的分析模块

1. 在 `src/views/` 创建新视图组件
2. 在 `src/router.ts` 添加路由
3. 在 `src/services/analyzer.ts` 添加分析逻辑
4. 在导航菜单添加入口

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/lib.rs` 定义命令函数
2. 在 `invoke_handler` 中注册命令
3. 在前端通过 `invoke('command_name', args)` 调用

## 安全注意事项

- **永远不要**在前端代码中硬编码 API Key
- **永远不要**将 `.env` 文件提交到版本控制
- API Key 仅通过系统凭据存储或 sessionStorage
- 用户上传的文件在处理前需要验证格式
- 所有外部 API 请求都有超时限制
- 公开数据源访问受域名白名单限制

## 性能优化建议

- 使用 `v-memo` 优化大列表渲染
- 对话历史限制最大条数（MiniMax: 8条）
- 使用防抖处理用户输入
- 大文件导入使用 Web Worker
- 启用 Vite 的代码分割

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

请查看 LICENSE 文件了解详情。
