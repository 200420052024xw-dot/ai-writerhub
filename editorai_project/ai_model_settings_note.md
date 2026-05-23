# AI 模型配置调整说明

## 需求

在设置中增加模型 Key 设置。用户需要可以输入：

- API Key
- Base URL
- 默认模型

同时提供常用厂商预设，并允许用户自行设置。

## 已实现

前端新增设置页模型配置能力：

- 新增 `frontend/src/pages/SettingsPage.tsx`
- 新增 `frontend/src/services/modelSettings.ts`
- 在左侧导航“设置”中接入模型配置页
- 配置保存到浏览器 `localStorage`
- API Key 支持隐藏 / 显示切换
- 用户修改 Base URL 或默认模型时自动切换为“自定义”模式

## 预设厂商

当前提供以下预设：

- OpenAI
  - Base URL: `https://api.openai.com/v1`
  - 默认模型: `gpt-4.1-mini`
- DeepSeek
  - Base URL: `https://api.deepseek.com`
  - 默认模型: `deepseek-chat`
- 通义千问 DashScope
  - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - 默认模型: `qwen-plus`
- 智谱 GLM
  - Base URL: `https://open.bigmodel.cn/api/paas/v4`
  - 默认模型: `glm-4-plus`
- 火山方舟
  - Base URL: `https://ark.cn-beijing.volces.com/api/v3`
  - 默认模型: `doubao-seed-1-6`
- Moonshot AI
  - Base URL: `https://api.moonshot.cn/v1`
  - 默认模型: `moonshot-v1-8k`
- 自定义
  - 用户自行填写 Base URL 和默认模型

## 安全约定

当前阶段只做前端配置入口，API Key 暂存在浏览器本地存储中。后续接真实 AI 能力时，建议：

- 生产环境不要让前端直接调用模型厂商接口。
- 前端只提交任务和配置引用。
- FastAPI 后端负责读取密钥、调用模型和返回结果。
- API Key 应通过环境变量、加密存储或用户级安全配置管理。

## 验收

- `npm run build`：通过。
- `GET http://127.0.0.1:5173`：返回 HTTP 200。
- Vite 当前从 `F:\text_editor\frontend` 运行。
