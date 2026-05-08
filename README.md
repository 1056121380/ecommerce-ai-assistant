# 电商AI助手

<div align=”center”>

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

Windows 桌面应用，用于连接大语言模型，辅助完成电商运营、选品分析、热词分析、直播带货数据分析和销售数据诊断。

[功能特性](#功能特性) • [快速开始](#快速开始) • [使用指南](#使用指南) • [开发文档](#开发文档)

</div>

---

## 功能特性

### 🤖 多模型支持

- ✅ OpenAI 兼容接口（GPT-4、GPT-3.5 等）
- ✅ Anthropic Claude
- ✅ MiniMax
- ✅ Kimi (Moonshot)
- ✅ 硅基流动 (SiliconFlow)
- ✅ Ollama 本地模型

### 📊 数据分析能力

- **选品分析**: 市场需求、竞争强度、利润空间、内容潜力评估
- **热词分析**: 趋势判断、机会词挖掘、标题建议、投放建议
- **带货数据分析**: GMV 评估、转化漏斗诊断、商品判断、优化建议
- **智能对话**: 支持预设 Prompt 模板，快速切换分析场景

### 🔒 安全特性

- API Key 通过 Tauri 后端写入系统凭据存储（Windows Credential Manager）
- 不明文保存在前端 localStorage
- 对话历史和分析结果本地存储
- 支持数据导入导出，无需云端同步

### 🛠️ 开发者友好

- 支持 API 连接测试、请求诊断
- 详细的错误摘要和响应预览
- 支持 CSV、TXT、JSON、Excel 文件导入
- 内置电商数据源注册中心

## 重要说明

⚠️ 当前默认数据源是”内置参考库”和”数据源注册中心”，**不是实时平台抓取结果**。

如果需要真实直播带货榜单、关键词指数、销售数据或店铺数据，需要：
- 接入公开网页 API
- 使用平台授权 API
- 上传用户自己的数据文件

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **UI**: Element Plus + Pinia
- **桌面**: Tauri 2 (Rust)
- **测试**: Vitest

## 快速开始

### 系统要求

- Windows 10/11 (x64)
- 8GB RAM 以上推荐
- 网络连接（用于调用 LLM API）

### 安装使用

1. 下载最新版本的 `电商AI助手.exe`
2. 双击运行（首次运行可能需要管理员权限）
3. 在设置中配置 LLM 模型和 API Key
4. 点击"测试连接"确认配置正确
5. 开始使用各项分析功能

### 配置 API Key

1. 打开应用，点击右上角"设置"图标
2. 选择要使用的 LLM 模型
3. 输入对应的 API Key
4. 点击"保存"（API Key 会安全存储在系统凭据中）
5. 点击"测试连接"验证配置

## 使用指南

### 选品分析

1. 点击"选品分析"标签
2. 上传 CSV 文件或粘贴商品数据
3. 数据格式示例：
   ```csv
   商品名称,销量,价格,评价数
   防晒衣,1000,29.9,500
   露营帐篷,800,199,320
   ```
4. 点击"开始分析"
5. 查看市场容量、竞争度、利润空间等分析结果

### 热词分析

1. 点击"热词分析"标签
2. 上传热词文件或粘贴热词列表
3. 选择平台（抖音/小红书/淘宝）
4. 点击"开始分析"
5. 查看热词分类、趋势判断、机会词推荐

### 带货数据分析

1. 点击"数据分析"标签
2. 上传直播数据或销售数据
3. 选择数据类型（直播数据/商品销售/竞品数据）
4. 点击"开始分析"
5. 查看 GMV 评估、转化漏斗、优化建议

### 智能对话

1. 点击"对话"标签
2. 选择预设模板或自由对话
3. 输入问题，发送消息
4. 查看 AI 回复和建议

## 开发文档

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd ecommerce-ai-assistant

# 安装依赖
npm install

# 启动 Web 开发服务器
npm run dev

# 启动 Tauri 桌面应用
npm run tauri dev
```

### 运行测试

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

生成后的主程序位于：

```text
release/电商AI助手.exe
```

同时脚本会尝试把新版复制到项目根目录：

```text
电商AI助手.exe
```

如果根目录 exe 正在运行，Windows 会锁定文件，此时请关闭旧窗口后使用 `release/电商AI助手.exe`。

### 项目结构

详细的项目结构和开发指南请查看 [CLAUDE.md](./CLAUDE.md)。

## 数据与安全

- ✅ API Key 保存到系统凭据存储（Windows Credential Manager）
- ✅ 对话历史、分析历史和非敏感配置保存到 Tauri 应用数据目录
- ✅ 浏览器预览模式下会回退到 localStorage / sessionStorage
- ⚠️ 公开网页采集和平台 API 接入需要遵守目标网站条款、robots 规则和用户授权边界

## 常见问题

### Q: API 连接失败怎么办？

A: 请检查：
1. API Endpoint 是否正确
2. API Key 是否有效且有余额
3. 网络连接是否正常
4. 是否需要配置代理

### Q: 支持哪些文件格式？

A: 支持 CSV、TXT、JSON、Excel (.xlsx) 格式。

### Q: 数据存储在哪里？

A: 
- API Key: Windows 系统凭据存储
- 对话历史和配置: `%APPDATA%\com.ecommerce.ai.assistant\`

### Q: 如何更新应用？

A: 下载最新版本的 exe 文件，覆盖旧版本即可。数据会自动保留。

### Q: 支持 Mac 或 Linux 吗？

A: 当前版本仅支持 Windows。未来可能会支持其他平台。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。
