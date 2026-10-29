import { Button } from '../../components/Button';
import {
  type CreateLicenseDraftInput,
  type LicenseDraftFieldsFragment,
  useLicenseDraftsQuery,
} from '../../generated/graphql';

interface StartPanelProps {
  /** @description The license of the novel being edited, to customize it. */
  baseLicense?: { id: string; name: string };
  isCreating: boolean;
  error: string | null;
  onCreate: (input: CreateLicenseDraftInput) => void;
  onResume: (draft: LicenseDraftFieldsFragment) => void;
  onDiscard: (id: string) => void;
}

export function StartPanel({
  baseLicense,
  isCreating,
  error,
  onCreate,
  onResume,
  onDiscard,
}: StartPanelProps) {
  const { data } = useLicenseDraftsQuery();
  const drafts =
    data?.licenseDraftsConnection.edges.map(({ node }) => node) ?? [];

  return (
    <section
      aria-label="Start a license draft"
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
        Start a license draft
      </h2>
      <div className="flex flex-wrap gap-3">
        {baseLicense && (
          <Button
            type="button"
            variant="solid"
            color="blue"
            disabled={isCreating}
            onClick={() => onCreate({ licenseId: baseLicense.id })}
          >
            Customize {baseLicense.name}
          </Button>
        )}
        <Button
          type="button"
          variant={baseLicense ? 'outline' : 'solid'}
          color={baseLicense ? 'gray' : 'blue'}
          disabled={isCreating}
          onClick={() => onCreate({})}
        >
          Write my own
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {drafts.length > 0 && (
        <section aria-label="Unfinished drafts" className="mt-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Your unfinished drafts
          </h3>
          <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <span>
                  <strong>{draft.title || 'Untitled draft'}</strong>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">
                    Saved {new Date(draft.updatedAt).toLocaleString()}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="chip"
                    color="blue"
                    onClick={() => onResume(draft)}
                  >
                    Continue {draft.title || 'untitled draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="chip"
                    color="red"
                    onClick={() => onDiscard(draft.id)}
                  >
                    Discard {draft.title || 'untitled draft'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
