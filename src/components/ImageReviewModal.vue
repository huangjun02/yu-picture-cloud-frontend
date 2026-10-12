<template>
  <a-modal
    :open="open"
    title="图片审核"
    :confirm-loading="submitting"
    :footer="null"
    width="520px"
    @cancel="close"
  >
    <div v-if="image" class="review-head">
      <a-image
        :src="image.thumbnailUrl ?? image.url"
        :width="64"
        :height="64"
        style="object-fit: cover; border-radius: 6px"
      />
      <div class="review-head-text">
        <div class="review-name">{{ image.name || '未命名图片' }}</div>
        <div class="review-sub">
          当前状态：<a-tag :color="currentMeta.color">{{ currentMeta.text }}</a-tag>
        </div>
      </div>
    </div>

    <a-form layout="vertical" style="margin-top: 16px">
      <!--
        重复审核的两种姿势：
        - 勾选（默认）：审核人 / 时间 / 意见全部以本次为准
        - 不勾选：只改状态，上一次的审核信息留作历史参考
      -->
      <a-form-item>
        <a-checkbox v-model:checked="resetReviewParams">重置审核参数（审核人 / 时间 / 意见）</a-checkbox>
        <div class="reset-hint">
          {{
            resetReviewParams
              ? '以本次审核人为准，写入当前时间；通过时不保留意见'
              : '仅修改审核状态，保留上一次的审核人 / 时间 / 意见'
          }}
        </div>
      </a-form-item>

      <!-- 不写意见的时候不显示输入框：让你填一个"填了也不会落库"的值是假交互 -->
      <a-form-item v-if="resetReviewParams" label="审核意见（拒绝时必填）">
        <a-textarea
          v-model:value="reason"
          :rows="3"
          :maxlength="200"
          show-count
          placeholder="例如：内容不合适 / 与图库主题无关"
        />
      </a-form-item>
    </a-form>

    <div class="review-actions">
      <a-button type="primary" :loading="submitting" @click="submit(1)">
        <CheckOutlined />
        通过
      </a-button>
      <a-button danger :loading="submitting" @click="submit(2)">
        <CloseOutlined />
        拒绝
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons-vue'

import { reviewImage, type ImageVO } from '@/api/image'

/**
 * 审核弹窗：图片管理列表 / 详情页 / 审核工作台三处共用一份。
 *
 * <p>三处都要「通过 / 拒绝（拒绝必填原因）」这套动作，各写一遍的结果是
 * 规则在三个地方慢慢漂移（比如某处忘了校验必填，直接吃后端 40000）。
 * 抽成组件后规则只有一份，父组件只需要在 reviewed 事件里重新拉列表。
 */
const props = defineProps<{
  open: boolean
  image: ImageVO | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  reviewed: []
}>()

const submitting = ref(false)
/** 审核意见：拒绝时必填（仅在「重置审核参数」时才需要） */
const reason = ref('')
/** 是否重置全部审核参数（默认重置 —— 单次审核的直觉行为） */
const resetReviewParams = ref(true)

// 每次打开都回到初始状态：残留的旧原因/旧开关很容易被顺手提交上去
watch(
  () => props.open,
  (v) => {
    if (v) {
      reason.value = ''
      resetReviewParams.value = true
    }
  },
)

const currentMeta = computed(() => {
  switch (props.image?.reviewStatus) {
    case 1:
      return { text: '已通过', color: 'success' }
    case 2:
      return { text: '已拒绝', color: 'error' }
    default:
      return { text: '待审核', color: 'warning' }
  }
})

function close() {
  emit('update:open', false)
}

async function submit(status: 1 | 2) {
  const id = props.image?.id
  if (!id) return

  // 拒绝必须写理由：后端也强制，但前端先拦一道，用户不用等一次往返才知道。
  // 「不重置参数」时不需要原因 —— 那条意见压根不落库（后端也不要求）
  const text = reason.value.trim()
  if (status === 2 && resetReviewParams.value && !text) {
    antMessage.warning('拒绝必须填写原因')
    return
  }

  submitting.value = true
  try {
    await reviewImage({
      id,
      reviewStatus: status,
      // 通过时不带意见（传空串会被当成「有意见但为空」，语义上不如不带）
      ...(status === 2 && resetReviewParams.value ? { reviewMessage: text } : {}),
      resetReviewParams: resetReviewParams.value,
    })
    antMessage.success(status === 1 ? '已通过' : '已拒绝')
    close()
    emit('reviewed')
  } catch {
    // 拦截器已提示（无权限 / 参数错误 / 图片不存在）
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.reset-hint {
  margin-top: 2px;
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.review-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: #fafafa;
}

.review-name {
  font-size: 15px;
  font-weight: 600;
  color: rgb(0 0 0 / 88%);
  word-break: break-all;
}

.review-sub {
  margin-top: 4px;
  font-size: 13px;
  color: rgb(0 0 0 / 45%);
}

.review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
