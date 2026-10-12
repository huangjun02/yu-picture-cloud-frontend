/**
 * 标签的读写工具。库里存的是 **JSON 数组字符串**（`["风景","城市"]`），
 * 这是后端契约（`ImageQueryRequest.tags` 的数组分支、`/image/options` 都按它解析）。
 *
 * <p>为什么不直接在组件里 `JSON.parse`：解析逻辑在列表 / 详情 / 编辑 / 主页四处都要用，
 * 抄四份的结果是「某处没做容错，遇到历史脏数据直接抛异常」。
 *
 * <p>容错的那一段是真实存在的：编辑弹窗早期是个纯文本框，用户填「测试」就原样落库，
 * 库里确实躺着裸字符串。解析时不能假设一定是 JSON。
 */
export function parseTags(raw?: string | null): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean)
      }
    } catch {
      // 落到下面的兜底分支
    }
  }
  // 兜底：裸字符串 / 逗号分隔（中英文逗号都认）
  return trimmed
    .replace(/^[[\]"\s]+|[[\]"\s]+$/g, '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** 写回后端：统一成 JSON 数组字符串；空数组给空串（= 明确清空标签） */
export function stringifyTags(tags: string[]): string {
  const cleaned = tags.map((t) => t.trim()).filter(Boolean)
  return cleaned.length ? JSON.stringify(cleaned) : ''
}
