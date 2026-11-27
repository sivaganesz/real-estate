/** The shape every module's routes.tsx exports; app/routes.ts collects them into the registry. */
import type { ComponentType } from 'react'
import type { Params } from 'react-router'
import type { Action } from '@/lib/permissions'

/** 'any' = every signed-in profile. A function decides from the URL params (for example /import/:kind). */
export type RoutePermission = Action | 'any' | ((params: Params) => Action | 'any')

export interface AppRoute {
  /** Absolute path, for example '/leads/:id'. */
  path: string
  permission: RoutePermission
  Component: ComponentType
  /** i18n key for the breadcrumb and the document title. */
  titleKey: string
  /** The parent route's path, for breadcrumbs (for example '/leads' for '/leads/:id'). */
  parent?: string
}
