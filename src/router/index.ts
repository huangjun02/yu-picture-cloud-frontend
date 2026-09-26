import { createRouter, createWebHistory } from 'vue-router'
import HealthView from '../views/HealthView.vue'
import UserLoginView from '../views/user/UserLoginView.vue'

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

export default router
