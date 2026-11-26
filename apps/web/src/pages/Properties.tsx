import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Upload } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Button, Segmented } from '../components/ui';
import { AddProperty } from '../components/AddProperty';
import { Projects } from './ProjectsTab';
import { PropertyList } from './PropertyList';
import { useAssistantPage } from '../ai/assistant';

export function Properties() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'units' | 'projects') ?? 'units';
  const [adding, setAdding] = useState(params.get('add') === '1');

  useAssistantPage({
    page: 'Properties',
    suggestions: can('property.create')
      ? ['Which projects are moving slowly?', 'Add a draft: 3 BHK villa in Medavakkam, 1.2 Cr, 2400 sq.ft land', 'Which properties get the most enquiries?']
      : ['Find 2 BHK apartments under 70 lakhs in Chennai', 'Show available plots in Sunrise Enclave', 'Which ready-to-move homes are under 1 crore?'],
  });

  // All properties / Projects: the first thing on each tab's search row.
  const switcher = (
    <Segmented
      size="lg"
      className="shrink-0 self-stretch"
      value={tab}
      onChange={(v) => setParams(v === 'units' ? {} : { tab: v })}
      options={[
        { value: 'units', label: 'All properties' },
        { value: 'projects', label: 'Projects' },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Everything you can offer, with projects and their units."
        actions={
          can('property.create') && (
            <>
              <Link to="/properties/import">
                <Button icon={<Upload className="h-4 w-4" />} title="Bring in many properties at once from a spreadsheet">
                  Bulk import
                </Button>
              </Link>
              {tab === 'projects' ? (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/projects/new')}>
                  New project
                </Button>
              ) : (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                  Add property
                </Button>
              )}
            </>
          )
        }
      />
      {tab === 'units' ? <PropertyList switcher={switcher} /> : <Projects switcher={switcher} />}
      <AddProperty open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
      {children}
    </button>
  );
}
