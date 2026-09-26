import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getLoginUser, login as loginApi, logout as logoutApi } from '@/api/user'
import type { LoginParams, LoginUserVO } from '@/api/user'

/**
 * 当前登录用户的状态。
 *
 * 为什么放 store 而不是留在组件里：路由守卫、顶部用户区、各业务页面都要读它，
 * 用 props 层层传递会很快失控。store 是「跨组件的单一数据源」。
 *
 * 注意分工：真正的登录态是后端发的那张 satoken cookie（浏览器自动携带），
 * 这里存的只是「用户信息快照」，用于渲染。刷新页面快照会丢，靠 fetchLoginUser 重新问后端要。
 */
export const useUserStore = defineStore('user', () => {
  const loginUser = ref<LoginUserVO | null>(null)

  /** 登录：接口成功后把用户信息存进 store */
  async function login(params: LoginParams) {
    const vo = await loginApi(params)
    loginUser.value = vo
    return vo
  }

  /**
   * 恢复登录态：刷新页面后调一次。
   * 没登录时后端会返回 40100，这里吞掉错误返回 null ——
   * 它是「探测」而不是「必须成功」的操作，不该让调用方处理异常。
   */
  async function fetchLoginUser() {
    try {
      loginUser.value = await getLoginUser()
    } catch {
      loginUser.value = null
    }
    return loginUser.value
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      // 即使接口失败也要清本地状态，否则界面会停在"已登录"的假象上
      loginUser.value = null
    }
  }

  return { loginUser, login, fetchLoginUser, logout }
})
