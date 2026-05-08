# 电商AI助手

Windows 桌面应用，用于连接大语言模型，辅助完成电商运营、选品分析、热词分析、直播带货数据分析和销售数据诊断。

## 当前能力

- 支持 OpenAI 兼容接口、MiniMax、Kimi、Claude、硅基流动和本地 Ollama。
- 支持 API 连接测试、请求诊断、错误摘要和响应摘要。
- 支持 CSV、TXT、JSON、Excel 文件导入。
- 支持对话、选品分析、热词分析、带货数据分析。
- 内置电商数据源注册中心，会按问题自动注入参考上下文。
- API Key 通过 Tauri 后端写入系统凭据存储，不明文保存在前端 localStorage。

## 重要说明

当前默认数据源是“内置参考库”和“数据源注册中心”，不是实时平台抓取结果。  
如果需要真实直播带货榜单、关键词指数、销售数据或店铺数据，需要继续接入公开网页、授权 API 或用户上传的数据文件。

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus + Pinia
- Tauri 2
- Vitest

## 本地开发

```bash
npm install
npm run dev
```

启动桌面端：

```bash
npm run tauri dev
```

## 检查与构建

```bash
npm run check
```

生成可运行 exe：

```bash
npm run release:exe
```

生成 zip：

```bash
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

## 数据与安全

- API Key 保存到系统凭据存储。
- 对话历史、分析历史和非敏感配置保存到 Tauri 应用数据目录。
- 浏览器预览模式下会回退到 localStorage / sessionStorage。
- 公开网页采集和平台 API 接入需要遵守目标网站条款、robots 规则和用户授权边界。
