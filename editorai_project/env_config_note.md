# 后端环境变量配置

## 文件位置

已创建：

- `backend/.env.example`
- `backend/.env`

其中 `backend/.env` 用于本地测试，不应提交真实密钥。

## 配置项

```env
AI_PROVIDER=deepseek
AI_API_KEY=
AI_BASE_URL=https://api.deepseek.com
AI_DEFAULT_MODEL=deepseek-chat
AI_TIMEOUT_SECONDS=60
```

## 后端读取逻辑

已新增：

- `backend/app/core/config.py`
- `backend/app/routers/config.py`

后端通过 `pydantic-settings` 读取 `.env`。

## 验证接口

新增接口：

```http
GET /api/config/ai
```

响应不会返回 API Key，只返回是否已配置：

```json
{
  "provider": "deepseek",
  "base_url": "https://api.deepseek.com",
  "default_model": "deepseek-chat",
  "timeout_seconds": 60,
  "has_api_key": false
}
```

## 当前验收结果

- `/api/config/ai` 可访问。
- `/api/health` 可访问，返回 `writerhub-api`。
- 当前运行环境已读取到一组测试模型配置，接口返回 `has_api_key=true`，但不会暴露具体 Key。
