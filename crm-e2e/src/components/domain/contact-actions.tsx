/**
 * Contact actions (DESIGN_SYSTEM §8, Known limitation K5): Call opens `tel:+91…`, WhatsApp opens `wa.me/91…` with an
 * optional prefilled message (in the success tone, WhatsApp's green), Email opens `mailto:`. A WhatsApp click is logged
 * as an activity on the lead (when the user may edit it); a call is logged from the log-activity dialog with its result.
 */
import type { ReactNode } from 'react'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Lead } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'
import { mailtoLink, telLink, waLink } from '@/lib/whatsapp'
import { logContact } from '@/services/activities'

export function ContactActions({ lead, message, size = 'icon-sm', showEmail, onCall, className, labels }: {
  lead: Pick<Lead, 'id' | 'name' | 'phone' | 'email' | 'ownerId'>
  /** Prefilled WhatsApp text. */
  message?: string
  size?: 'icon-sm' | 'icon' | 'sm'
  showEmail?: boolean
  /** After the dialer opens (e.g. ask for the call result). */
  onCall?: () => void
  className?: string
  /** Show text labels next to icons. */
  labels?: boolean
}) {
  const { t } = useTranslation('domain')
  const { can } = usePermission()
  const mayLog = can('lead.edit', lead)
  const btnSize = labels ? 'sm' : size
  const item = (key: string, label: string, href: string, icon: ReactNode, onClick?: () => void, extra?: string) => (
    <Tooltip key={key}>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size={btnSize} className={extra}>
          <a href={href} target={key === 'wa' ? '_blank' : undefined} rel="noopener noreferrer" aria-label={labels ? undefined : label} onClick={(e) => { e.stopPropagation(); onClick?.() }}>
            {icon}
            {labels && <span>{label}</span>}
          </a>
        </Button>
      </TooltipTrigger>
      {!labels && <TooltipContent>{label}</TooltipContent>}
    </Tooltip>
  )
  if (!lead.phone && !lead.email) return null
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {lead.phone && item('call', t('contact.call', { name: lead.name }), telLink(lead.phone), <Phone />, onCall)}
      {lead.phone && item(
        'wa', t('contact.whatsapp', { name: lead.name }), waLink(lead.phone, message), <MessageCircle />,
        () => { if (mayLog) logContact(lead.id, { channel: 'whatsapp', text: message }) },
        'text-success hover:bg-success-soft hover:text-success',
      )}
      {showEmail && lead.email && item('mail', t('contact.email', { name: lead.name }), mailtoLink(lead.email), <Mail />)}
    </div>
  )
}
