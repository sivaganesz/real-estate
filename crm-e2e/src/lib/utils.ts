import { createCn } from 'cn/config'

/** Joins class names and resolves Tailwind conflicts. Knows the theme's named text sizes (src/index.css). */
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['micro', 'caption', 'label', 'meta', 'ui', 'prompt'] }] } },
})
