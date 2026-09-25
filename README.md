# 智能协同云图库 · 前端

> 智能协同云图库的前端（Vue 3 + TypeScript + Ant Design Vue）。
> 配套后端：[yu-picture-cloud](https://github.com/huangjun02/yu-picture-cloud)

## 技术栈

| 用途 | 选型 |
|---|---|
| 框架 | Vue 3.5（Composition API + `<script setup>`） |
| 构建 | Vite 8 |
| 语言 | TypeScript 6 |
| UI 组件 | Ant Design Vue 4.2 |
| 路由 | Vue Router 5 |
| 状态管理 | Pinia 4 |
| HTTP | axios 1.20（统一封装 + 拦截器） |

## 快速开始

### 1. 环境要求

Node.js `^22.18.0` 或 `>=24.12.0`

### 2. 安装依赖

```sh
npm install
```

### 3. 启动开发服务器

```sh
npm run dev
```

访问 http://localhost:5173 —— 首页会自动请求后端 `/api/health` 并显示联调结果。

> **注意**：需要先启动后端（8123 端口）。顺序反了会先显示「联调失败」，点「重新检查」按钮即可恢复。

### 4. 构建生产版本

```sh
npm run build
```

## 开发代理

`vite.config.ts` 把 `/api` 前缀的请求转发给后端：

```ts
server: {
  port: 5173,
  proxy: {
    '/api': { target: 'http://localhost:8123', changeOrigin: true },
  },
}
```

后端 `context-path` 本身就是 `/api`，所以**不需要 rewrite** —— 请求路径前后天然对齐。

这解决的是浏览器同源策略带来的跨域问题：浏览器以为自己在访问 5173，实际由 Vite 在背后转发到 8123。

## 项目结构

```
src/
├── api/
│   ├── request.ts        axios 实例 + 响应拦截器（统一拆包 / 错误提示）
│   └── health.ts         健康检查接口
├── router/index.ts       路由表
├── types/api.d.ts        BaseResponse 类型（对齐后端）
├── views/HealthView.vue  联调检查页
├── App.vue               ConfigProvider（中文语言包）
└── main.ts               Ant Design Vue 全局注册
```

## 与后端的接口约定

后端所有接口统一返回 `{ code, data, message }`。`src/api/request.ts` 的响应拦截器负责拆包：

| 条件 | 行为 |
|---|---|
| `code === 0` | 直接把 `data` 交给页面（页面无需写 `res.data.data`） |
| `code !== 0` | 弹出 `message` 错误提示并 reject |

好处是错误处理集中在一处，后续新增接口不必重复判断。

## 开发进度

- [x] **项目初始化** —— 脚手架、Ant Design Vue 接入、axios 封装、开发代理、联调页
- [ ] 用户模块页面（注册 / 登录）
- [ ] 图片列表与详情页
- [ ] 空间管理页
