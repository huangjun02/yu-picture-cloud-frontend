import { createRouter, createWebHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import HealthView from '@/views/HealthView.vue'
import ImageManageView from '@/views/image/ImageManageView.vue'
import ImageUploadView from '@/views/image/ImageUploadView.vue'
import UserLoginView from '@/views/user/UserLoginView.vue'
import UserRegisterView from '@/views/user/UserRegisterView.vue'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/user/login',
      name: 'user-login',
      component: UserLoginView,
    },
    {
      path: '/user/register',
      name: 'user-register',
      component: UserRegisterView,
    },
    {
      // 业务页统一挂在 BasicLayout 下（布局只存在一份，见下方注释）
      path: '/',
      component: BasicLayout,
      children: [
        {
          path: '',
          name: 'image-manage',
          component: ImageManageView,
        },
        {
          path: 'image/upload',
          name: 'image-upload',
          component: ImageUploadView,
        },
        {
          // 联调排查页：不进侧边菜单，需要时直接访问 /health
          path: 'health',
          name: 'health',
          component: HealthView,
        },
      ],
    },
  ],
})

/** 无需登录即可访问的页面 */
const PUBLIC_ROUTES = ['user-login', 'user-register']

/**
 * 全局前置守卫：没登录只能待在登录页 / 注册页。
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

  const isPublic = PUBLIC_ROUTES.includes(String(to.name))

  if (!isPublic && !userStore.loginUser) {
    return { name: 'user-login' }
  }
  if (isPublic && userStore.loginUser) {
    // 已登录就别再看登录/注册页
    return { path: '/' }
  }
  return true
})

export default router
