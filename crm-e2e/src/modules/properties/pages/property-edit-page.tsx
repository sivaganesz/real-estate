/**
 * Edit a property: the same dynamic form, prefilled; paste-and-fill here edits with AI ("price now 1.15 Cr, semi
 * furnished") and changes only what the text mentions. An executive edits only what they created (route permission
 * 'property.edit' + the record check here); Not found and No access get their own states.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { paths } from '@/app/paths'
import { EmptyProperties, NoAccess } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import type { Property } from '@/domain/types'
import { fromProperty } from '../lib/form'
import { PropertyForm } from '../components/property-form'

export default function PropertyEditPage() {
  const { t } = useTranslation(['properties', 'shell'])
  const { id = '' } = useParams()
  const property = useDb((db) => db.properties.find((p) => p.id === id))
  const { can, explain } = usePermission()
  if (!property) {
    return <EmptyState illustration={EmptyProperties} title={t('properties:detail.notFound')} body={t('properties:detail.notFoundBody', { id })} primary={<Button asChild><Link to={paths.properties()}>{t('properties:detail.backToList')}</Link></Button>} />
  }
  if (!can('property.edit', property)) {
    const why = explain('property.edit')
    return <EmptyState illustration={NoAccess} title={t('properties:detail.cantEdit')} body={t(why.reasonKey, why.params)} primary={<Button asChild><Link to={paths.property(property.id)}>{t('properties:detail.backToProperty')}</Link></Button>} />
  }
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader eyebrow={property.id} title={t('properties:form.editTitle', { title: property.title })} subtitle={t('properties:form.editSubtitle')} />
      <EditForm key={property.id} property={property} />
    </div>
  )
}

/** The form starts from the record as it was when the page opened (keyed by id, so another property starts fresh). */
function EditForm({ property }: { property: Property }) {
  const [initial] = useState(() => fromProperty(property))
  return <PropertyForm initial={initial} propertyId={property.id} initialMeta={property.fieldMeta} />
}
