import { Button } from '../../components/Button';
import { useCanonicalLicensesQuery } from '../../generated/graphql';
import { useMessages } from './i18n';

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
  const t = useMessages();
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
    <section aria-label={t('recommendations.title')} className="mt-4">
      <h3 className="text-sm font-bold text-white">
        {t('recommendations.title')}
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
                  t('recommendations.prefill', { name: nameOf(id) }),
                )
              }
            >
              {t('recommendations.use', { name: nameOf(id) })}
            </Button>
            <Button
              type="button"
              variant="chip"
              color="green"
              onClick={() => onViewLicense(id)}
            >
              {t('recommendations.read', { name: nameOf(id) })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
