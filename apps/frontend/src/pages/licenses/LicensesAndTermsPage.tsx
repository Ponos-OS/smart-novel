import { isWriterOrHigher } from '@smart-novel/shared';
import { Tabs } from 'radix-ui';
import { Link } from 'react-router-dom';

import { DefaultLicenseTab } from '../../features/license-assistant/DefaultLicenseTab';
import { PlatformTermsTab } from '../../features/platform-terms/PlatformTermsTab';
import { useAuth } from '../../hooks/useAuth';

const TABS = [
  { id: 'terms', label: 'Platform terms', Panel: PlatformTermsTab },
  {
    id: 'default-license',
    label: 'Default license',
    Panel: DefaultLicenseTab,
  },
] as const;

export function LicensesAndTermsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isWriterOrHigher(user?.roles ?? [])) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>Only writers can see the licenses and terms.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-white">
        Licenses and terms
      </h1>
      <p className="mb-4 text-sm">
        <Link
          to="/licenses/draft"
          className="font-medium text-blue-400"
        >
          Draft a license with the assistant
        </Link>
      </p>
      <Tabs.Root defaultValue={TABS[0].id}>
        <Tabs.List
          aria-label="Licenses and terms"
          className="mb-4 flex gap-4 border-b border-gray-700"
        >
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="cursor-pointer border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-gray-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=active]:border-blue-400 data-[state=active]:text-blue-400"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {TABS.map(({ id, Panel }) => (
          <Tabs.Content
            key={id}
            value={id}
            className="rounded-xl border border-gray-700/70 bg-gray-800 p-6"
          >
            <Panel />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
