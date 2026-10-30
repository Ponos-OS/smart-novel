import { createElement, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DraftBodyProps {
  text: string;
}

type Level = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * @description A license starts with a level-one heading, and the pane around it already has its own headings, so the text's headings are moved three levels down (never past level six) instead of putting another page title inside a pane.
 */
function demoted(level: Level) {
  const tag = `h${Math.min(level + 3, 6)}`;

  return function DemotedHeading({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    return createElement(tag, null, children);
  };
}

const components: Components = {
  h1: demoted(1),
  h2: demoted(2),
  h3: demoted(3),
  h4: demoted(4),
  h5: demoted(5),
  h6: demoted(6),
};

/**
 * @description Memoized on the text: an answer that left the draft alone hands over an equal text, and the rendered draft must not be rebuilt, which would flash it.
 */
export const DraftBody = memo(function DraftBody({
  text,
}: DraftBodyProps) {
  return (
    <div className="prose prose-sm prose-invert max-h-[32rem] max-w-none overflow-y-auto text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
