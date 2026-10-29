import { Button } from '../../components/Button';

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
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="solid"
        color="blue"
        disabled={!canFinalize || isFinalizing}
        onClick={onFinalize}
      >
        {isFinalizing ? 'Finalizing...' : 'Finalize this license'}
      </Button>
      {isReadyToFinalize && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          The assistant thinks this draft is ready. It is your
          decision.
        </p>
      )}
    </div>
  );
}
