import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

export function CompanySettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Business details used across the admin portal, emails and (later) the website and AI agent"
      />
      <ComingSoon
        step="Step 1.7"
        summary="Company info is the only Settings tab in Phase 1."
        items={[
          'Logo upload with preview',
          'Company name and short description',
          'Office address with optional map pin',
          'Phones, WhatsApp number, public email, enquiry notification emails',
        ]}
      />
    </>
  );
}
