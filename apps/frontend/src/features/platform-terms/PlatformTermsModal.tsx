import { Check } from 'lucide-react';
import { Checkbox, Dialog as RadixDialog } from 'radix-ui';
import { useRef, useState } from 'react';
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

/**
 * @description The writer must accept or log out: Escape and a click outside do not close it.
 */
export function PlatformTermsModal({
  markdown,
  isAccepting = false,
  error,
  onAccept,
  onLogout,
}: PlatformTermsModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const agreeRef = useRef<HTMLButtonElement>(null);

  return (
    <RadixDialog.Root open>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-950/70 backdrop-blur-sm" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            agreeRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-gray-700/70 bg-gray-800 p-6 shadow-2xl shadow-black/40"
        >
          <RadixDialog.Title className="mb-4 text-lg font-bold text-white">
            Platform terms
          </RadixDialog.Title>
          <div className="prose prose-sm prose-invert mb-4 min-h-0 flex-1 overflow-y-auto text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
          <p className="mb-4 text-sm text-gray-300">
            Want to see the default license first?{' '}
            <Link
              to="/licenses"
              className="font-medium text-blue-400"
            >
              Read the licenses and terms
            </Link>
            .
          </p>
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-200">
            <Checkbox.Root
              id="platform-terms-agreement"
              ref={agreeRef}
              checked={hasAgreed}
              onCheckedChange={(checked) =>
                setHasAgreed(checked === true)
              }
              disabled={isAccepting}
              className="flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded border border-gray-500 bg-gray-900 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Checkbox.Indicator>
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <label
              htmlFor="platform-terms-agreement"
              className="cursor-pointer"
            >
              I have read and agree to the platform terms
            </label>
          </div>
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
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
