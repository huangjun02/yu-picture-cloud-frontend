<template>
  <AuthShell title="创建账号" subtitle="注册后即可拥有自己的图片空间">
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-form-item label="账号" name="userAccount">
        <a-input
          v-model:value="formState.userAccount"
          size="large"
          placeholder="4-20 位，不含特殊字符"
          allow-clear
        >
          <template #prefix><UserOutlined /></template>
        </a-input>
      </a-form-item>

      <a-form-item label="密码" name="userPassword">
        <a-input-password
          v-model:value="formState.userPassword"
          size="large"
          placeholder="至少 8 位"
        >
          <template #prefix><LockOutlined /></template>
        </a-input-password>
      </a-form-item>

      <a-form-item label="确认密码" name="checkPassword">
        <a-input-password
          v-model:value="formState.checkPassword"
          size="large"
          placeholder="再输入一次密码"
        >
          <template #prefix><SafetyOutlined /></template>
        </a-input-password>
      </a-form-item>

      <a-button
        type="primary"
        size="large"
        block
        html-type="submit"
        :loading="submitting"
        class="submit-btn"
      >
        注册
      </a-button>
    </a-form>

    <div class="auth-extra">
      <span />
      <span class="auth-switch">
        已有账号？<router-link to="/user/login">返回登录</router-link>
      </span>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons-vue'

import AuthShell from '@/components/AuthShell.vue'
import { register, type RegisterParams } from '@/api/user'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive<RegisterParams>({
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})

/**
 * 前端只挡「明显不合法」，真正的校验永远在后端（UserServiceImpl#userRegister）。
 * 两边规则保持一致是为了体验（少一次往返），不是为了安全 —— 前端校验可以被绕过。
 */
const rules: Record<string, Rule[]> = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, max: 20, message: '账号长度为 4-20 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不少于 8 位', trigger: 'blur' },
  ],
  checkPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (value && value !== formState.userPassword) {
          return Promise.reject('两次输入的密码不一致')
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

async function handleSubmit() {
  submitting.value = true
  try {
    await register({ ...formState })
    message.success('注册成功，请登录')
    await router.push('/user/login')
  } catch {
    // 错误提示由 axios 拦截器统一弹出，这里不重复
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.submit-btn {
  margin-top: 4px;
}
</style>
