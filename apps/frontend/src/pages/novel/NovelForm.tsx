import { lazy, Suspense, useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { type LicenseSummary } from '../../features/novel-license/license-notice';
import { LicenseField } from '../../features/novel-license/LicenseField';
import {
  type LicenseDraftInput,
  NovelState,
} from '../../generated/graphql';
import { CategoryPicker } from './CategoryPicker';
import { RequestCategoryDialog } from './RequestCategoryDialog';

const LicenseDraftingAssistant = lazy(async () => ({
  default: (
    await import('../../features/license-assistant/LicenseDraftingAssistant')
  ).LicenseDraftingAssistant,
}));

export interface NovelFormValues {
  name: string;
  description: string;
  state: NovelState;
  categories: string[];
  licenseDraft?: LicenseDraftInput;
  /** @description A license the author finalized with the assistant; exclusive with `licenseDraft`. */
  licenseId?: string;
}

interface NovelFormProps {
  initialValues?: NovelFormValues;
  /** @description The license the novel has or will get; the field is hidden until it is known. */
  license?: LicenseSummary;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: NovelFormValues) => void;
  onCancel: () => void;
}

const EMPTY_VALUES: NovelFormValues = {
  name: '',
  description: '',
  state: NovelState.Ongoing,
  categories: [],
};

const INPUT_CLASSES =
  'w-full rounded-lg border px-3 py-2 disabled:opacity-50 border-gray-600 bg-gray-900 text-white';

export function NovelForm({
  initialValues = EMPTY_VALUES,
  license,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: NovelFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(
    initialValues.description,
  );
  const [state, setState] = useState(initialValues.state);
  const [categories, setCategories] = useState(
    initialValues.categories,
  );

  const [licenseDraft, setLicenseDraft] = useState<
    LicenseDraftInput | undefined
  >();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [requestedName, setRequestedName] = useState<string | null>(
    null,
  );
  // Remounting the picker clears what was typed once a category was requested.
  const [pickerKey, setPickerKey] = useState(0);
  const [assistantLicense, setAssistantLicense] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const canSubmit =
    !isSubmitting &&
    (!!assistantLicense ||
      !licenseDraft ||
      licenseDraft.title.length > 0) &&
    name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      state,
      categories,
      ...(assistantLicense
        ? { licenseId: assistantLicense.id }
        : { licenseDraft }),
    });
  };

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            placeholder="Novel name"
            className={INPUT_CLASSES}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={5}
            placeholder="A short description"
            className={INPUT_CLASSES}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            State
          </span>
          <select
            value={state}
            onChange={(event) =>
              setState(event.target.value as NovelState)
            }
            disabled={isSubmitting}
            className={INPUT_CLASSES}
          >
            <option value={NovelState.Ongoing}>Ongoing</option>
            <option value={NovelState.Finished}>Finished</option>
          </select>
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Categories
          </span>
          <CategoryPicker
            key={pickerKey}
            value={categories}
            onChange={setCategories}
            disabled={isSubmitting}
            onRequestCategory={setRequestedName}
          />
        </div>

        {license && assistantLicense && (
          <div className="space-y-2">
            <p className="text-sm text-white">
              License: <strong>{assistantLicense.name}</strong>{' '}
              (drafted with the assistant)
            </p>
            <Button
              type="button"
              variant="outline"
              color="gray"
              disabled={isSubmitting}
              onClick={() => setAssistantLicense(null)}
            >
              Use another license
            </Button>
          </div>
        )}
        {license && !assistantLicense && (
          <LicenseField
            key={license.id}
            license={license}
            disabled={isSubmitting}
            onDraftChange={setLicenseDraft}
            onDraftWithAssistant={() => setIsAssistantOpen(true)}
          />
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            color="gray"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="solid"
            color="blue"
            disabled={!canSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
      {requestedName !== null && (
        <RequestCategoryDialog
          initialName={requestedName}
          onClose={() => setRequestedName(null)}
          onRequested={() => {
            setRequestedName(null);
            setPickerKey((key) => key + 1);
          }}
        />
      )}
      {license && isAssistantOpen && (
        <Dialog
          title="Draft a license"
          isWide
          onClose={() => setIsAssistantOpen(false)}
        >
          <Suspense
            fallback={
              <p role="status" className="text-sm">
                Loading the assistant...
              </p>
            }
          >
            <LicenseDraftingAssistant
              baseLicense={{ id: license.id, name: license.name }}
              onFinalized={(finalized) => {
                setAssistantLicense({
                  id: finalized.id,
                  name: finalized.name,
                });
                setIsAssistantOpen(false);
              }}
            />
          </Suspense>
        </Dialog>
      )}
    </>
  );
}
