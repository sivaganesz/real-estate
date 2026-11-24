/**
 * UI kit — the theme and every shared component on one page, for review while the rebuild is under way.
 * A temporary developer page: its demo labels are plain English, not translated.
 */
import { useState } from 'react'
import { Building2, CalendarCheck, Check, FileX, LayoutGrid, List, Plus, Share2, Sparkles, TriangleAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Callout } from '@/components/app/callout'
import { Chip } from '@/components/app/chip'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { DataTable } from '@/components/app/data-table'
import { EmptyState } from '@/components/app/empty-state'
import { FilterBar } from '@/components/app/filter-bar'
import { KeyValueGrid } from '@/components/app/key-value-grid'
import { Meter } from '@/components/app/meter'
import { Page, PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { Segmented } from '@/components/app/segmented'
import { SidePanel } from '@/components/app/side-panel'
import { StatCard } from '@/components/app/stat-card'
import { StatusChip } from '@/components/app/status-chip'
import type { Tone } from '@/components/app/tone'
import { UserAvatar } from '@/components/app/user-avatar'
import { inrShort } from '@/lib/format'
import { useStore } from '@/store/db'
import { useCrumbs } from '@/components/layout/crumbs'
import type { Property } from '@/data/types'

const SWATCHES: { name: string; cls: string; token: string }[] = [
  { name: 'Primary', cls: 'bg-primary', token: '--primary' },
  { name: 'Accent (primary soft)', cls: 'bg-accent', token: '--accent' },
  { name: 'Background', cls: 'bg-background', token: '--background' },
  { name: 'Card', cls: 'bg-card', token: '--card' },
  { name: 'Muted', cls: 'bg-muted', token: '--muted' },
  { name: 'Border', cls: 'bg-border', token: '--border' },
  { name: 'Foreground', cls: 'bg-foreground', token: '--foreground' },
  { name: 'Muted text', cls: 'bg-muted-foreground', token: '--muted-foreground' },
  { name: 'Ribbon', cls: 'bg-ribbon', token: '--ribbon' },
]
const TONES: Tone[] = ['neutral', 'primary', 'success', 'warning', 'danger', 'info', 'violet']
/** The named small sizes from src/index.css, plus Tailwind's own. */
const TYPE_SCALE: { cls: string; px: string; use: string }[] = [
  { cls: 'text-xl font-bold', px: '20', use: 'Page title' },
  { cls: 'text-base font-semibold', px: '16', use: 'Section title' },
  { cls: 'text-sm', px: '14', use: 'Body text' },
  { cls: 'text-ui', px: '13', use: 'text-ui — tabs, filter pills, breadcrumbs' },
  { cls: 'text-meta', px: '12.5', use: 'text-meta — chips, IDs, secondary actions' },
  { cls: 'text-xs', px: '12', use: 'text-xs — hints, chip labels' },
  { cls: 'text-label', px: '11.5', use: 'text-label — table headings, tab counts' },
  { cls: 'text-caption', px: '11', use: 'text-caption — sidebar groups, counts' },
  { cls: 'text-micro', px: '10', use: 'text-micro — tiny markers' },
]
/** The live value of a theme colour, so the kit never shows a stale hex. */
const tokenValue = (name: string) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim())

export function UiKitPage() {
  useCrumbs([{ label: 'UI kit' }])
  const { db } = useStore()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'available' | 'drafts' | 'all'>('available')
  const [layout, setLayout] = useState<'cards' | 'table'>('cards')
  const [panel, setPanel] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const rows = db.properties.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5)

  return (
    <Page>
      <PageHeader title="UI kit" description="The light-blue theme and the shared components every section is built from. Temporary page for review."
        actions={<><Button variant="outline">Secondary</Button><Button><Sparkles /> Primary action</Button></>} />

      <div className="flex flex-col gap-5">
        <SectionCard title="Colours" description="Defined once in src/index.css; screens use the token names, never raw colours.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-lg border">
                <div className={`h-14 ${s.cls}`} />
                <div className="p-2 text-xs"><p className="font-medium">{s.name}</p><p className="font-mono text-muted-foreground">{s.token} {tokenValue(s.token)}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-4 mb-2 text-sm font-medium">Status tones</p>
          <div className="flex flex-wrap gap-2">{TONES.map((t) => <StatusChip key={t} tone={t}>{t}</StatusChip>)}</div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Type" description="Inter for English; Noto Sans Tamil for Tamil.">
            <div className="flex flex-col gap-2">
              {TYPE_SCALE.map((s) => (
                <p key={s.cls} className="flex items-baseline gap-3">
                  <span className="w-9 shrink-0 font-mono text-caption text-muted-foreground">{s.px}</span>
                  <span className={s.cls}>{s.use}</span>
                </p>
              ))}
              <p className="text-sm text-muted-foreground">Muted text for descriptions and hints.</p>
              <p className="text-sm">சொத்துகள் · விற்பனை மேலாளர் · வெளியிடு — தமிழ் எழுத்துரு மாதிரி</p>
              <p className="font-mono text-xs text-muted-foreground">PROP-1001 · monospace for codes</p>
            </div>
          </SectionCard>

          <SectionCard title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="lg"><Share2 /> Large</Button>
              <Button><Share2 /> Default</Button>
              <Button size="sm"><Share2 /> Small</Button>
              <Button size="icon" variant="outline" aria-label="Share"><Share2 /></Button>
              <Button disabled>Disabled</Button>
            </div>
            <p className="mt-4 mb-2 text-sm font-medium">Chips — options, suggestions, "add" actions</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip pressed><Check /> Lift</Chip>
              <Chip><Plus /> Gym</Chip>
              <Chip dashed><Plus /> Add amenities</Chip>
              <Chip tone="violet" size="sm" pressed>Price out of range <b>1</b></Chip>
              <Chip tone="violet" size="sm">Approval documents pending <b>2</b></Chip>
              <Chip tone="violet" size="sm" dashed>2 BHK flat in Chennai</Chip>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Status chips" description="Soft (default), outline and dot — the same tones everywhere.">
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="success">Available</StatusChip>
            <StatusChip tone="violet">Under negotiation</StatusChip>
            <StatusChip tone="info">Reserved</StatusChip>
            <StatusChip tone="warning">On hold</StatusChip>
            <StatusChip tone="neutral">Sold</StatusChip>
            <StatusChip tone="neutral" variant="outline">Draft</StatusChip>
            <StatusChip tone="warning" icon={<TriangleAlert />}>RERA · document pending</StatusChip>
            <StatusChip tone="success" variant="dot">Strong match</StatusChip>
            <StatusChip tone="danger" variant="dot">Overdue</StatusChip>
          </div>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active leads" value="13" sub="2 new today" icon={Users} />
          <StatCard label="Available properties" value="10" sub="3 need attention" icon={Building2} tone="success" />
          <StatCard label="Visits this week" value="4" sub="1 today" icon={CalendarCheck} tone="violet" />
          <StatCard label="Documents pending" value="1" sub="Building approval" icon={FileX} tone="warning" />
        </div>

        <SectionCard title="Callouts">
          <div className="flex flex-col gap-2">
            <Callout tone="info" title="Matching">3 leads fit this property. Notify their executives?</Callout>
            <Callout tone="warning" title="Building approval — document pending">The badge isn't shown to customers until the document is uploaded.</Callout>
            <Callout tone="success">Published. 2 leads fit this property.</Callout>
            <Callout tone="danger" title="Can't publish yet">Still needed: floor.</Callout>
          </div>
        </SectionCard>

        <SectionCard title="Filter bar, tabs and view switch" action={<Segmented variant="pill" label="Layout" value={layout} onChange={setLayout}
          segments={[{ value: 'cards', label: '', icon: <LayoutGrid />, ariaLabel: 'Cards' }, { value: 'table', label: '', icon: <List />, ariaLabel: 'Table' }]} />}>
          <FilterBar value={q} onChange={setQ} label="Search properties" placeholder="Search by title" size="lg"
            filters={
              <Select defaultValue="any">
                <SelectTrigger className="w-40 bg-card" aria-label="City"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Any city</SelectItem><SelectItem value="mdu">Madurai</SelectItem><SelectItem value="che">Chennai</SelectItem></SelectContent>
              </Select>
            } />
          <div className="mt-4 border-b">
            <Segmented label="Views" value={tab} onChange={setTab}
              segments={[{ value: 'available', label: 'Available', count: 10 }, { value: 'drafts', label: 'Drafts', count: 2 }, { value: 'all', label: 'All', count: 14 }]} />
          </div>
        </SectionCard>

        <DataTable<Property> label="Sample properties" rows={rows} rowKey={(p) => p.id}
          onRowClick={() => undefined}
          empty={<EmptyState compact icon={Building2} title="No properties match" />}
          columns={[
            { key: 'title', header: 'Property', cell: (p) => <span className="font-medium">{p.title}</span> },
            { key: 'loc', header: 'Location', hideOnPhone: true, cell: (p) => <span className="text-muted-foreground">{p.location.locality}, {p.location.city}</span> },
            { key: 'price', header: 'Price', align: 'right', cell: (p) => inrShort(p.price) },
            { key: 'status', header: 'Status', cell: (p) => <StatusChip tone={p.status === 'available' ? 'success' : p.status === 'draft' ? 'neutral' : 'info'}>{p.status}</StatusChip> },
          ]} />

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Facts, meters and people">
            <KeyValueGrid items={[
              { label: 'Purpose', value: 'For sale' }, { label: 'Plot area', value: '1,200 sq.ft.' }, { label: 'Facing', value: 'East' },
              { label: 'Road width', value: '30 ft' }, { label: 'Empty value', value: '' }, { label: 'Water', value: 'Municipal + borewell' },
            ]} />
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm"><span className="w-28">Listing 80%</span><Meter value={80} /></div>
              <div className="flex items-center gap-3 text-sm"><span className="w-28">Readiness 45</span><Meter value={45} tone="warning" /></div>
              <div className="flex items-center gap-3 text-sm"><span className="w-28">Match 92</span><Meter value={92} tone="success" /></div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {['Arun', 'Meena Krishnan', 'Rajesh Kumar', 'Fatima Begum', 'Priya S'].map((n) => <UserAvatar key={n} name={n} />)}
            </div>
          </SectionCard>

          <SectionCard title="Form controls">
            <div className="grid gap-3">
              <div className="grid gap-1.5"><Label htmlFor="kit-title">Title</Label><Input id="kit-title" placeholder="2 BHK flat in Porur" /></div>
              <div className="grid gap-1.5"><Label htmlFor="kit-notes">Notes</Label><Textarea id="kit-notes" placeholder="Anything the team should know" /></div>
              <div className="flex items-center gap-2"><Checkbox id="kit-rera" /><Label htmlFor="kit-rera">RERA registered</Label></div>
              <div className="flex items-center gap-2"><Switch id="kit-feat" /><Label htmlFor="kit-feat">Featured</Label></div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Empty state, panels and dialogs">
          <EmptyState icon={Building2} title="No drafts" action={<Button variant="outline">Add a property</Button>}>
            Drafts appear here until the required facts are in.
          </EmptyState>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPanel(true)}>Open side panel</Button>
            <Button variant="outline" onClick={() => setConfirm(true)}>Open confirm dialog</Button>
          </div>
        </SectionCard>
      </div>

      <SidePanel open={panel} onOpenChange={setPanel} title="Share with a lead" description="From the right on desktop, from the bottom on a phone."
        footer={<Button className="w-full" onClick={() => setPanel(false)}>Send on WhatsApp</Button>}>
        {['Arun', 'Meena Krishnan', 'Rajesh Kumar'].map((n) => (
          <div key={n} className="flex items-center gap-3 rounded-lg border p-2.5">
            <UserAvatar name={n} /><span className="flex-1 font-medium">{n}</span><StatusChip tone="success">Strong · 92</StatusChip>
          </div>
        ))}
      </SidePanel>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Mark as sold?" confirmLabel="Mark as sold" danger onConfirm={() => undefined}>
        It leaves the Available list and stops matching new leads.
      </ConfirmDialog>
    </Page>
  )
}
