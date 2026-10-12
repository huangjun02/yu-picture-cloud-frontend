import { createRouter, createWebHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import HealthView from '@/views/HealthView.vue'
import HomeView from '@/views/HomeView.vue'
import ImageDetailView from '@/views/image/ImageDetailView.vue'
import ImageManageView from '@/views/image/ImageManageView.vue'
import ImageReviewView from '@/views/image/ImageReviewView.vue'
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
          // 主页 = 已通过审核的图片墙（浏览/搜索）
          path: '',
          name: 'home',
          component: HomeView,
        },
        {
          // 我的图片（管理员则是全库管理）：表格视角，看得到待审核 / 被拒状态
          path: 'image/manage',
          name: 'image-manage',
          component: ImageManageView,
        },
        {
          path: 'image/upload',
          name: 'image-upload',
          component: ImageUploadView,
        },
        {
          // 图片详情独立成页（参考「左预览 + 右信息」范式）——
          // 弹窗放大图在小屏上上下都挤，独立页面才有空间把属性摊开讲清楚
          path: 'image/detail/:id',
          name: 'image-detail',
          component: ImageDetailView,
        },
        {
          // 审核工作台：只给管理员（meta 标记 + 下面的守卫双重把关）
          path: 'image/review',
          name: 'image-review',
          component: ImageReviewView,
          meta: { requiresAdmin: true },
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
  // 管理员页面的前端拦截：后端才是权威（reviewImage 自己会校验角色），
  // 这里挡的是「普通用户手敲 /image/review 进去看到一堆报错弹窗」的体验问题
  if (to.meta.requiresAdmin && userStore.loginUser?.userRole !== 'admin') {
    return { path: '/' }
  }
  return true
})

export default router
