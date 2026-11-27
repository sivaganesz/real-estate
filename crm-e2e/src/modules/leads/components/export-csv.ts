/** Downloads leads as a UTF-8 CSV (Excel-friendly BOM; formula-safe cells via lib/lead-queries toCsv). */
import type { TFunction } from 'i18next'
import { fmtDate } from '@/lib/format'
import { toCsv } from '@/lib/lead-queries'
import { phoneDisplay } from '@/lib/phone'
import type { LeadRow } from './use-lead-items'

export function downloadLeadsCsv(list: LeadRow[], t: TFunction, now: Date) {
  const header = ['ID', t('leads:col.lead'), t('leads:form.phone'), t('leads:form.email'), t('leads:col.source'), t('leads:col.stage'), t('leads:col.temperature'),
    t('leads:col.score'), t('leads:form.budgetMin'), t('leads:form.budgetMax'), t('leads:form.cities'), t('leads:form.localities'), t('leads:form.configurations'),
    t('leads:col.owner'), t('leads:col.created')]
  const body = list.map((r) => {
    const q = r.lead.requirement
    return [r.lead.id, r.lead.name, phoneDisplay(r.lead.phone), r.lead.email, t(`catalogue:source.${r.lead.source}`), t(`catalogue:stage.${r.lead.stage}`),
      t(`catalogue:temperature.${r.temperature}`), r.score, q.budgetMin, q.budgetMax, q.cities.join('; '), q.localities.join('; '), q.configurations.join('; '),
      r.ownerName ?? '', fmtDate(r.lead.createdAt)]
  })
  const blob = new Blob([`﻿${toCsv(header, body)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${fmtDate(now.toISOString()).replace(/\s+/g, '-')}.csv`
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
