import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="prose prose-sm dark:prose-invert max-h-[32rem] max-w-none overflow-y-auto text-gray-800 dark:text-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
