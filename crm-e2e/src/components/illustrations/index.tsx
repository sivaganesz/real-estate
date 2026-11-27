/**
 * Empty-state illustrations (DESIGN_SYSTEM §9): duotone architectural line art, 160×120, themed through tokens only.
 * Strokes border-strong with key strokes in primary, fills primary-soft, one marigold spot, and a faint jaali dot
 * lattice in the background circle. Decorative: aria-hidden.
 */
import { useId, type ReactNode, type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export type IllustrationProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }
export type Illustration = (props: IllustrationProps) => ReactNode

const LINE = 'fill-none stroke-border-strong [stroke-width:1.5] [stroke-linecap:round] [stroke-linejoin:round]'
const KEY = 'fill-none stroke-primary [stroke-width:1.75] [stroke-linecap:round] [stroke-linejoin:round]'
const SOFT = 'fill-primary-soft'
const CARD = 'fill-card'
const SPOT = 'fill-highlight'

function Frame({ size = 120, className, children, ...rest }: IllustrationProps & { children: ReactNode }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 160 120" height={size} width={(size * 4) / 3} aria-hidden="true" focusable="false" className={cn('shrink-0', className)} {...rest}>
      <defs>
        <pattern id={`jaali-${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="0.9" className="fill-border" />
        </pattern>
      </defs>
      <circle cx="80" cy="60" r="52" fill={`url(#jaali-${id})`} opacity="0.4" />
      <circle cx="80" cy="60" r="52" className="fill-none stroke-border" />
      {children}
    </svg>
  )
}

export const EmptyLeads: Illustration = (p) => (
  <Frame {...p}>
    <rect x="44" y="34" width="56" height="40" rx="6" className={`${CARD} ${LINE}`} />
    <rect x="56" y="44" width="56" height="40" rx="6" className={`${SOFT} ${KEY}`} />
    <circle cx="72" cy="58" r="6" className={LINE} />
    <path d="M64 74c2-5 14-5 16 0M86 56h18M86 64h12" className={LINE} />
    <circle cx="114" cy="40" r="9" className={SPOT} />
    <path d="M114 35v10M109 40h10" className="stroke-highlight-foreground [stroke-width:1.75] [stroke-linecap:round]" />
  </Frame>
)

export const EmptyProperties: Illustration = (p) => (
  <Frame {...p}>
    <path d="M48 86V48l22-14 22 14v38" className={`${SOFT} ${KEY}`} />
    <path d="M92 86V58h22v28M40 86h82" className={LINE} />
    <path d="M60 58h6M74 58h6M60 70h6M74 70h6M100 66h6M100 76h6" className={LINE} />
    <circle cx="116" cy="38" r="7" className={`${SPOT}`} />
    <path d="M110 44l-12 12m4-2 3 3m-1-7 3 3" className={KEY} />
  </Frame>
)

export const EmptyMatches: Illustration = (p) => (
  <Frame {...p}>
    <path d="M44 50h22a8 8 0 0 0 16 0h0v34H44z" className={`${SOFT} ${KEY}`} />
    <path d="M82 50h34v34H90a8 8 0 0 0-8-8z" className={`${CARD} ${LINE}`} />
    <path d="M52 76V64l9-6 9 6v12" className={KEY} />
    <circle cx="100" cy="62" r="5" className={LINE} />
    <path d="M92 76c2-5 14-5 16 0" className={LINE} />
    <circle cx="82" cy="36" r="5" className={SPOT} />
  </Frame>
)

export const EmptyCalendar: Illustration = (p) => (
  <Frame {...p}>
    <rect x="46" y="36" width="68" height="52" rx="6" className={`${CARD} ${LINE}`} />
    <path d="M46 50h68" className={KEY} />
    <path d="M60 30v12M100 30v12" className={KEY} />
    <path d="M58 62h8M74 62h8M90 62h8M58 74h8M74 74h8" className={LINE} />
    <path d="M100 70c0-6 10-6 10 0 0 5-5 10-5 10s-5-5-5-10z" className={`${SPOT}`} />
  </Frame>
)

export const EmptyTasks: Illustration = (p) => (
  <Frame {...p}>
    <rect x="52" y="30" width="56" height="62" rx="6" className={`${CARD} ${LINE}`} />
    <path d="M60 46l4 4 7-8M60 62l4 4 7-8" className={KEY} />
    <path d="M78 46h22M78 62h22M62 78h38" className={LINE} />
    <circle cx="118" cy="36" r="3" className={SPOT} />
    <circle cx="40" cy="44" r="2.5" className={SPOT} />
    <circle cx="122" cy="80" r="2" className={SPOT} />
  </Frame>
)

export const EmptyPipeline: Illustration = (p) => (
  <Frame {...p}>
    <rect x="40" y="34" width="24" height="54" rx="4" className={`${CARD} ${LINE}`} />
    <rect x="68" y="34" width="24" height="54" rx="4" className={`${CARD} ${LINE}`} />
    <rect x="96" y="34" width="24" height="54" rx="4" className={`${CARD} ${LINE}`} />
    <rect x="44" y="40" width="16" height="10" rx="2" className={`${SOFT} ${KEY}`} />
    <rect x="72" y="40" width="16" height="10" rx="2" className={`${SOFT} ${KEY}`} />
    <rect x="72" y="54" width="16" height="10" rx="2" className={LINE} />
    <rect x="100" y="40" width="16" height="10" rx="2" className={SPOT} />
  </Frame>
)

export const EmptyImport: Illustration = (p) => (
  <Frame {...p}>
    <path d="M42 70h20l4 8h28l4-8h20v18H42z" className={`${SOFT} ${KEY}`} />
    <rect x="62" y="30" width="36" height="42" rx="4" className={`${CARD} ${LINE}`} />
    <path d="M62 42h36M74 30v42M86 30v42M62 54h36" className={LINE} />
    <path d="M110 46V30m-6 6 6-6 6 6" className={KEY} />
    <rect x="66" y="46" width="6" height="5" rx="1" className={SPOT} />
  </Frame>
)

export const EmptyNotifications: Illustration = (p) => (
  <Frame {...p}>
    <path d="M62 80V60a18 18 0 0 1 36 0v20l6 6H56z" className={`${SOFT} ${KEY}`} />
    <path d="M74 90a6 6 0 0 0 12 0" className={LINE} />
    <path d="M104 34h10l-10 10h10M116 22h7l-7 7h7" className={LINE} />
    <circle cx="80" cy="40" r="3" className={SPOT} />
  </Frame>
)

export const NoAccess: Illustration = (p) => (
  <Frame {...p}>
    <rect x="54" y="28" width="52" height="64" rx="4" className={`${CARD} ${LINE}`} />
    <path d="M60 92V34h40v58" className={LINE} />
    <rect x="68" y="58" width="24" height="20" rx="4" className={`${SOFT} ${KEY}`} />
    <path d="M73 58v-6a7 7 0 0 1 14 0v6" className={KEY} />
    <circle cx="80" cy="67" r="2.5" className={SPOT} />
  </Frame>
)

export const ErrorState: Illustration = (p) => (
  <Frame {...p}>
    <rect x="50" y="36" width="60" height="48" rx="8" className={`${SOFT} ${KEY}`} />
    <path d="M80 36l-6 14 10 6-8 12 4 16" className={LINE} />
    <path d="M60 50h8M92 70h8" className={LINE} />
    <circle cx="112" cy="34" r="5" className={SPOT} />
  </Frame>
)

export const NoResults: Illustration = (p) => (
  <Frame {...p}>
    <rect x="44" y="34" width="52" height="44" rx="4" className={`${CARD} ${LINE}`} />
    <path d="M44 56h26V34M70 56v22" className={LINE} />
    <circle cx="96" cy="66" r="14" className={`${SOFT} ${KEY}`} />
    <path d="M106 76l12 12" className={KEY} />
    <path d="M92 66h8" className={LINE} />
    <circle cx="52" cy="42" r="3" className={SPOT} />
  </Frame>
)

export const EmptyToday: Illustration = (p) => (
  <Frame {...p}>
    <circle cx="104" cy="40" r="10" className={SPOT} />
    <path d="M104 22v-4M120 40h4M116 28l3-3" className="stroke-highlight [stroke-width:1.5] [stroke-linecap:round]" />
    <path d="M46 88V56l18-12 18 12v32" className={`${SOFT} ${KEY}`} />
    <path d="M82 88V66h28v22M38 88h84M58 70h12" className={LINE} />
  </Frame>
)

export const EmptyReports: Illustration = (p) => (
  <Frame {...p}>
    <path d="M44 88h76M48 88V30" className={LINE} />
    <rect x="56" y="62" width="12" height="26" rx="2" className={`${SOFT} ${KEY}`} />
    <rect x="74" y="50" width="12" height="38" rx="2" className={`${SOFT} ${KEY}`} />
    <rect x="92" y="40" width="12" height="48" rx="2" className={SPOT} />
    <path d="M56 50l18-10 18 6 18-14" className={LINE} />
  </Frame>
)

export const EmptyTeam: Illustration = (p) => (
  <Frame {...p}>
    <rect x="42" y="44" width="34" height="42" rx="5" className={`${CARD} ${LINE}`} />
    <rect x="84" y="36" width="34" height="50" rx="5" className={`${SOFT} ${KEY}`} />
    <circle cx="59" cy="60" r="6" className={LINE} />
    <circle cx="101" cy="54" r="7" className={KEY} />
    <path d="M51 78h16M91 72h20M95 79h12" className={LINE} />
    <rect x="96" y="30" width="10" height="6" rx="2" className={SPOT} />
  </Frame>
)

export const EmptySettings: Illustration = (p) => (
  <Frame {...p}>
    <rect x="44" y="34" width="72" height="52" rx="6" className={`${CARD} ${LINE}`} />
    <path d="M54 48h52M54 60h52M54 72h52" className={LINE} />
    <circle cx="70" cy="48" r="5" className={`${SOFT} ${KEY}`} />
    <circle cx="94" cy="60" r="5" className={`${SOFT} ${KEY}`} />
    <circle cx="62" cy="72" r="5" className={SPOT} />
  </Frame>
)

export const EmptyClients: Illustration = (p) => (
  <Frame {...p}>
    <path d="M44 44h24l6 6h42v38H44z" className={`${SOFT} ${KEY}`} />
    <rect x="52" y="56" width="56" height="26" rx="3" className={`${CARD} ${LINE}`} />
    <circle cx="68" cy="69" r="5" className={SPOT} />
    <path d="M73 69h22m-6 0v5m6-5v4" className={KEY} />
  </Frame>
)

export const EmptyActivity: Illustration = (p) => (
  <Frame {...p}>
    <path d="M62 28v64" className={LINE} />
    <circle cx="62" cy="40" r="6" className={`${SOFT} ${KEY}`} />
    <circle cx="62" cy="60" r="6" className={`${CARD} ${LINE}`} />
    <circle cx="62" cy="80" r="6" className={SPOT} />
    <path d="M76 38h34M76 44h22M76 58h30M76 64h18M76 78h34" className={LINE} />
  </Frame>
)
