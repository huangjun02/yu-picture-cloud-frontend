import { post } from './request'

/** 登录请求参数（对应后端 UserLoginRequest） */
export interface LoginParams {
  userAccount: string
  userPassword: string
}

/** 脱敏后的登录用户信息（对应后端 LoginUserVO，绝不返回 userPassword） */
export interface LoginUserVO {
  id: number
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

/** GET /api/user/get/login → 当前登录用户（第 3 期实现，用于刷新页面后恢复登录态） */
export function getLoginUser(): Promise<LoginUserVO> {
  return post<LoginUserVO>('/user/get/login')
}
