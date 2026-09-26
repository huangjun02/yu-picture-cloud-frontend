import { createRouter, createWebHistory } from 'vue-router'
import HealthView from '../views/HealthView.vue'
import UserLoginView from '../views/user/UserLoginView.vue'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'health',
      component: HealthView,
    },
    {
      path: '/user/login',
      name: 'user-login',
      component: UserLoginView,
    },
  ],
})

/**
 * 全局前置守卫：没登录只能待在登录页。
 *
 * 关键点：store 里的登录用户是「内存快照」，刷新页面就没了 ——
 * 所以进来先调一次 fetchLoginUser() 向后端确认（凭 satoken cookie），
 * 否则用户刷新页面会被误判成未登录、无端被踢回登录页。
 *
 * 注意 useUserStore() 必须写在守卫函数内部：模块顶层执行时 Pinia 还没被 app.use() 装上。
 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  if (!userStore.loginUser) {
    await userStore.fetchLoginUser()
  }

  const isLoginPage = to.name === 'user-login'

  if (!isLoginPage && !userStore.loginUser) {
    return { name: 'user-login' }
  }
  if (isLoginPage && userStore.loginUser) {
    // 已登录就别再看登录页
    return { path: '/' }
  }
  return true
})

export default router
