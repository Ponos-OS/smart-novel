import { Button } from '../../components/Button';
import { useCanonicalLicensesQuery } from '../../generated/graphql';

interface RecommendationChipsProps {
  /** @description Canonical license ids the assistant suggests. */
  recommendations: string[];
  /** @description Puts a sentence about this license into the composer; nothing is sent. */
  onPrefill: (message: string) => void;
  onViewLicense: (licenseId: string) => void;
}

export function RecommendationChips({
  recommendations,
  onPrefill,
  onViewLicense,
}: RecommendationChipsProps) {
  const { data } = useCanonicalLicensesQuery(
    {},
    { enabled: recommendations.length > 0 },
  );

  if (recommendations.length === 0) {
    return null;
  }

  const nameOf = (id: string) =>
    data?.canonicalLicenses.find((license) => license.id === id)
      ?.shortName ?? id;

  return (
    <section aria-label="Suggested licenses" className="mt-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
        Suggested licenses
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {recommendations.map((id) => (
          <li key={id} className="flex gap-1">
            <Button
              type="button"
              variant="chip"
              color="blue"
              onClick={() =>
                onPrefill(
                  `I would like to use ${nameOf(id)} for my novel.`,
                )
              }
            >
              Use {nameOf(id)}
            </Button>
            <Button
              type="button"
              variant="chip"
              color="green"
              onClick={() => onViewLicense(id)}
            >
              Read {nameOf(id)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
