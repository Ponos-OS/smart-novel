import { useState } from 'react';

import { Button } from '../../components/Button';
import { NovelState } from '../../generated/graphql';

export interface NovelFormValues {
  name: string;
  author: string;
  description: string;
  state: NovelState;
  categories: string[];
}

interface NovelFormProps {
  initialValues?: NovelFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: NovelFormValues) => void;
  onCancel: () => void;
}

const EMPTY_VALUES: NovelFormValues = {
  name: '',
  author: '',
  description: '',
  state: NovelState.Ongoing,
  categories: [],
};

const INPUT_CLASSES =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white';

export function NovelForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: NovelFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [author, setAuthor] = useState(initialValues.author);
  const [description, setDescription] = useState(
    initialValues.description,
  );
  const [state, setState] = useState(initialValues.state);
  const [categories, setCategories] = useState(
    initialValues.categories.join(', '),
  );

  const canSubmit =
    !isSubmitting &&
    name.trim().length > 0 &&
    author.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      name: name.trim(),
      author: author.trim(),
      description: description.trim(),
      state,
      categories: categories
        .split(',')
        .map((category) => category.trim())
        .filter(Boolean),
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Author
        </span>
        <input
          type="text"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          disabled={isSubmitting}
          placeholder="Author"
          className={INPUT_CLASSES}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Categories
        </span>
        <input
          type="text"
          value={categories}
          onChange={(event) => setCategories(event.target.value)}
          disabled={isSubmitting}
          placeholder="fantasy, adventure"
          className={INPUT_CLASSES}
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Separate with commas. New categories are created.
        </span>
      </label>

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
  );
}
