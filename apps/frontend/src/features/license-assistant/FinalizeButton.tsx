import { Button } from '../../components/Button';
import { useMessages } from './i18n';

interface FinalizeButtonProps {
  /** @description There is a draft with a text and a name to finalize. */
  canFinalize: boolean;
  isFinalizing: boolean;
  /** @description The assistant's opinion; only a hint, the decision is the author's. */
  isReadyToFinalize: boolean;
  onFinalize: () => void;
}

export function FinalizeButton({
  canFinalize,
  isFinalizing,
  isReadyToFinalize,
  onFinalize,
}: FinalizeButtonProps) {
  const t = useMessages();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="solid"
        color="blue"
        disabled={!canFinalize || isFinalizing}
        onClick={onFinalize}
      >
        {t(isFinalizing ? 'finalize.busy' : 'finalize.button')}
      </Button>
      {isReadyToFinalize && (
        <p className="text-sm text-gray-300">{t('finalize.ready')}</p>
      )}
    </div>
  );
}
