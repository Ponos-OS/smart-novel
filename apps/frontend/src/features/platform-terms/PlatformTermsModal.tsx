import { useEffect, useId, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { Button } from '../../components/Button';

interface PlatformTermsModalProps {
  markdown: string;
  isAccepting?: boolean;
  error?: string | null;
  onAccept: () => void;
  onLogout: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

export function PlatformTermsModal({
  markdown,
  isAccepting = false,
  error,
  onAccept,
  onLogout,
}: PlatformTermsModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    agreeRef.current?.focus();
  }, []);

  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      ) ?? [],
    ).sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={trapFocus}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-2xl flex-col rounded-lg p-6 shadow-xl bg-gray-800"
      >
        <h2
          id={titleId}
          className="mb-4 text-lg font-bold text-white"
        >
          Platform terms
        </h2>
        <div className="prose prose-sm prose-invert mb-4 min-h-0 flex-1 overflow-y-auto text-gray-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
        <p className="mb-4 text-sm text-gray-300">
          Want to see the default license first?{' '}
          <Link to="/licenses" className="font-medium text-blue-400">
            Read the licenses and terms
          </Link>
          .
        </p>
        <label className="mb-4 flex items-center gap-2 text-sm text-gray-200">
          <input
            ref={agreeRef}
            type="checkbox"
            checked={hasAgreed}
            onChange={(event) => setHasAgreed(event.target.checked)}
            disabled={isAccepting}
          />
          I have read and agree to the platform terms
        </label>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            color="gray"
            onClick={onLogout}
            disabled={isAccepting}
          >
            Log out
          </Button>
          <Button
            variant="solid"
            color="blue"
            onClick={onAccept}
            disabled={!hasAgreed || isAccepting}
          >
            {isAccepting ? 'Accepting...' : 'Accept'}
          </Button>
        </div>
      </div>
    </div>
  );
}
