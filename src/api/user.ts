import { get, post } from './request'
import type { components } from '@/api/generated/schema'

/**
 * 用户接口。
 *
 * 类型改为从后端接口定义生成（`npm run gen:api`）—— 之前此处手写了一份 LoginUserVO，
 * 那是「同一份契约写两遍」：后端加字段时前端不报错，只会静默缺字段。
 *
 * 关于 id 为什么是 string 而不是 number：后端用雪花算法生成 19 位 id，
 * 超出 JS Number 的安全整数范围（2^53-1 ≈ 9e15，16 位）—— 写成 number 会静默丢精度：
 * 2103879065756463105 → 2103879065756463000。这种错不报异常，只表现为
 * 「拿着 id 查不到数据」，极难排查，所以两端一律当字符串。
 * 现在这条约定由生成的类型强制保证（schema 里 id 就是 string）。
 */
export type LoginUserVO = components['schemas']['LoginUserVO']
export type LoginParams = components['schemas']['UserLoginRequest']
export type RegisterParams = components['schemas']['UserRegisterRequest']

/**
 * POST /api/user/login
 * 登录成功后后端把 satoken 写进 cookie（withCredentials: true 已开）
 */
export function login(params: LoginParams): Promise<LoginUserVO> {
  return post<LoginUserVO>('/user/login', params)
}

/**
 * POST /api/user/register
 * 成功返回新用户的 id（字符串化的雪花 id）
 */
export function register(params: RegisterParams): Promise<string> {
  return post<string>('/user/register', params)
}

/** GET /api/user/get/login → 当前登录用户（刷新页面后靠它恢复登录态） */
export function getLoginUser(): Promise<LoginUserVO> {
  return get<LoginUserVO>('/user/get/login')
}

/** POST /api/user/logout → 退出登录（后端清会话 + 客户端会话 cookie） */
export function logout(): Promise<boolean> {
  return post<boolean>('/user/logout')
}
