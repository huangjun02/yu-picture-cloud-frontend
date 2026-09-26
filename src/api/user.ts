import { get, post } from './request'

/** 登录请求参数（对应后端 UserLoginRequest） */
export interface LoginParams {
  userAccount: string
  userPassword: string
}

/**
 * 脱敏后的登录用户信息（对应后端 LoginUserVO，绝不返回 userPassword）
 *
 * ⚠️ id 是 string 而不是 number：后端用雪花算法生成 19 位 id，
 * 超出 JS Number 的安全整数范围（2^53-1 = 9007199254740991，16 位），
 * 写成 number 会静默丢精度：2103879065756463105 → 2103879065756463000。
 * 这种错不报异常，只表现为「拿着 id 查不到数据」，极难排查 —— 所以两端都当字符串处理。
 */
export interface LoginUserVO {
  id: string
  userAccount: string
  userName?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
  createTime?: string
}

/**
 * POST /api/user/login
 * 登录成功后后端把 satoken 写进 cookie（withCredentials: true 已开）
 */
export function login(params: LoginParams): Promise<LoginUserVO> {
  return post<LoginUserVO>('/user/login', params)
}

/** GET /api/user/get/login → 当前登录用户（刷新页面后靠它恢复登录态） */
export function getLoginUser(): Promise<LoginUserVO> {
  return get<LoginUserVO>('/user/get/login')
}

/** POST /api/user/logout → 退出登录（后端清会话 + 客户端会话 cookie） */
export function logout(): Promise<boolean> {
  return post<boolean>('/user/logout')
}
