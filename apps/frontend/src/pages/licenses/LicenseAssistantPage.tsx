import { isWriterOrHigher } from '@smart-novel/shared';

import { LicenseDraftingAssistant } from '../../features/license-assistant/LicenseDraftingAssistant';
import { useAuth } from '../../hooks/useAuth';
import { showSuccess } from '../../utils/notification';

export function LicenseAssistantPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isWriterOrHigher(user?.roles ?? [])) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>Only writers can draft a license.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-white">
        Draft a license
      </h1>
      <LicenseDraftingAssistant
        onFinalized={({ name }) =>
          showSuccess(
            `Your license "${name}" is saved. Pick it from the novel's form.`,
          )
        }
      />
    </div>
  );
}
