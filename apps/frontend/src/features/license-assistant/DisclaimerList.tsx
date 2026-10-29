import { useId } from 'react';

interface DisclaimerListProps {
  disclaimers: string[];
}

/**
 * @description Always open and never behind a toggle: the assistant sends at least one with every answer, and the author must see it.
 */
export function DisclaimerList({ disclaimers }: DisclaimerListProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h3
        id={headingId}
        className="text-sm font-bold text-gray-900 dark:text-white"
      >
        Disclaimers
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
        {disclaimers.map((disclaimer, index) => (
          <li key={`${index}-${disclaimer}`}>{disclaimer}</li>
        ))}
      </ul>
    </section>
  );
}
