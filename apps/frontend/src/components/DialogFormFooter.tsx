import { Button } from './Button';

interface DialogFormFooterProps {
  refusal: string | null;
  refusalId: string;
  isPending: boolean;
  submitLabel: string;
  submitColor?: 'blue' | 'red';
  submitDisabled?: boolean;
  onCancel: () => void;
}

export function DialogFormFooter({
  refusal,
  refusalId,
  isPending,
  submitLabel,
  submitColor = 'blue',
  submitDisabled = isPending,
  onCancel,
}: DialogFormFooterProps) {
  return (
    <>
      {refusal && (
        <p
          id={refusalId}
          role="alert"
          className="text-sm text-red-300"
        >
          {refusal}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          color="gray"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="solid"
          color={submitColor}
          disabled={submitDisabled}
        >
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
