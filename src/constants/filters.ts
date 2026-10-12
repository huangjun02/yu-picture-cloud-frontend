/**
 * 分类 / 标签筛选的候选值。
 *
 * <p><b>为什么既有预设、又合并库里的真实值：</b>
 * <ul>
 *   <li>只用库里的值（原来的做法）：库还是空的时候筛选栏**整条是空的**，
 *       用户进来看到的是一片空白 —— 「能筛」变成了「你得先有数据才能筛」</li>
 *   <li>只用预设值：用户自己填的分类/标签在筛选栏里**找不到**
 *       （分类名是用户上传时随手写的，写不全所有可能）</li>
 * </ul>
 * 两者取并集才对：预设保证「一进来就有东西可点」，数据来的保证
 * 「你自己填过的也能筛出来」。顺序是预设在前（固定不动，位置稳定好找），
 * 库里多出来的值追加在后。
 *
 * <p>想改预设清单只动这一个文件（参考课程的官方前台用的是同一套演示值）。
 */
export const PRESET_CATEGORIES = ['模板', '电商', '表情包', '素材', '海报']

export const PRESET_TAGS = ['热门', '搞笑', '生活', '高清', '艺术', '校园', '背景', '简历', '创意']

/**
 * 合并预设值与数据里的值（去重、保持顺序）。
 *
 * @param preset  预设值（顺序稳定）
 * @param fromData 库里出现过的值（可为空 / 含 null / 含空串）
 */
export function mergeOptions(
  preset: string[],
  fromData?: (string | null | undefined)[] | null,
): string[] {
  const merged = new Set<string>(preset)
  for (const value of fromData ?? []) {
    const trimmed = value?.trim()
    if (trimmed) merged.add(trimmed)
  }
  return [...merged]
}
