import { memo } from 'react';

interface DraftBodyProps {
  text: string;
}

/**
 * @description Memoized on the text: an answer that left the draft alone hands over an equal text, and the rendered draft must not be rebuilt, which would flash it.
 */
export const DraftBody = memo(function DraftBody({
  text,
}: DraftBodyProps) {
  return (
    <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-sm text-gray-200">
      {text}
    </div>
  );
});
