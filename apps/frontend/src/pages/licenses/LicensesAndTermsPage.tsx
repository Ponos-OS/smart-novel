import { isWriterOrHigher } from '@smart-novel/shared';
import { type KeyboardEvent, useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(0);

  if (loading) {
    return null;
  }

  if (!isWriterOrHigher(user?.roles ?? [])) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-600 dark:text-red-400">
        <p>Only writers can see the licenses and terms.</p>
      </div>
    );
  }

  const moveTab = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];

    if (!step) {
      return;
    }

    const next = (index + step + TABS.length) % TABS.length;
    setActiveIndex(next);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };

  const { Panel } = TABS[activeIndex];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        Licenses and terms
      </h1>
      <p className="mb-4 text-sm">
        <Link
          to="/licenses/draft"
          className="font-medium text-blue-600 dark:text-blue-400"
        >
          Draft a license with the assistant
        </Link>
      </p>
      <div
        role="tablist"
        aria-label="Licenses and terms"
        className="mb-4 flex gap-4 border-b border-gray-200 dark:border-gray-700"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={index === activeIndex}
            aria-controls={`panel-${tab.id}`}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(event) => moveTab(event, index)}
            className={`cursor-pointer border-b-2 px-1 pb-2 text-sm font-medium ${
              index === activeIndex
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-700 dark:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${TABS[activeIndex].id}`}
        aria-labelledby={`tab-${TABS[activeIndex].id}`}
        className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <Panel />
      </div>
    </div>
  );
}
