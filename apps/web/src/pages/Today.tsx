import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { useAssistantPage } from '../ai/assistant';

export function Today() {
  const { user } = useAuth();
  useAssistantPage({ page: 'Today', suggestions: ['What can you help me with?'] });
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <PageHeader title={`${greet}, ${user?.name.split(' ')[0]}`} subtitle="Your day will show up here." />;
}
