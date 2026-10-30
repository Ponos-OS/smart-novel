import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { WordExplanation } from '../generated/graphql';
import { useWordExplain } from '../hooks/useWordExplain';
import { showInfo } from '../utils/notification';
import {
  findWordAtIndex,
  getWordFromText,
  normalizeWord,
} from '../utils/word-segmentation';

interface MarkdownRendererProps {
  content: string;
}

interface SelectionTarget {
  context: string;
  rect: DOMRect;
  word: string;
}

const explainHintKey = 'word-explain-tip-v1';

const explainDebounceMs = Math.max(
  450,
  Math.min(
    600,
    Number(import.meta.env.VITE_EXPLAIN_SELECTION_DEBOUNCE_MS),
  ),
);

const contextWindowSize = Number(
  import.meta.env.VITE_EXPLAIN_CONTEXT_CHAR_SIZE,
);

const isNodeInsideContainer = (node: Node, container: HTMLElement) =>
  node === container || container.contains(node);

const nodeToElement = (node: Node | null) => {
  if (!node) {
    return null;
  }

  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
};

const isInSkipZone = (node: Node | null, container: HTMLElement) => {
  const element = nodeToElement(node);
  if (!element) {
    return false;
  }

  const skipped = element.closest('code, pre, a');
  return !!skipped && isNodeInsideContainer(skipped, container);
};

const getNearestContextBlock = (
  node: Node | null,
  container: HTMLElement,
) => {
  const element = nodeToElement(node);
  if (!element) {
    return null;
  }

  const block = element.closest(
    'p, li, blockquote, h1, h2, h3, h4, h5, h6',
  );

  return block && isNodeInsideContainer(block, container)
    ? block
    : null;
};

const getSelectionRect = (range: Range) => {
  const rect = range.getBoundingClientRect();

  if (rect.width || rect.height) {
    return rect;
  }

  const firstClientRect = range.getClientRects()[0];
  return firstClientRect ?? rect;
};

const trimContextAroundWord = (context: string, word: string) => {
  if (!context || context.length <= contextWindowSize) {
    return context;
  }

  const lowered = context.toLowerCase();
  const loweredWord = word.toLowerCase();
  const index = lowered.indexOf(loweredWord);

  if (index < 0) {
    return context.slice(0, contextWindowSize);
  }

  const half = Math.floor(contextWindowSize / 2);
  const start = Math.max(0, index - half);
  const end = Math.min(context.length, start + contextWindowSize);

  return context.slice(start, end);
};

function snapRangeToWord(range: Range, locale: string): Range | null {
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const textNode = range.startContainer as Text;
  const text = textNode.data;

  if (!text.trim()) {
    return null;
  }

  const index = Math.min(
    Math.max(range.startOffset - 1, 0),
    text.length - 1,
  );
  const segment = findWordAtIndex(text, index, locale);

  if (!segment) {
    return null;
  }

  const nextRange = document.createRange();
  nextRange.setStart(textNode, segment.start);
  nextRange.setEnd(textNode, segment.end);
  return nextRange;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { explain } = useWordExplain();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const bubbleButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectionDebounceRef = useRef<number | null>(null);

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  const [showBubble, setShowBubble] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTarget, setActiveTarget] =
    useState<SelectionTarget | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [result, setResult] = useState<WordExplanation | null>(null);

  const locale = navigator.language || 'en';

  const clearSelectionUi = useCallback(() => {
    setShowBubble(false);
    setActiveTarget(null);
  }, []);

  const requestExplanation = useCallback(
    async (target: SelectionTarget) => {
      setLoading(true);
      setErrorMessage(null);

      const explainResult = await explain({
        word: target.word,
        context: target.context,
      });

      if (explainResult.rateLimited) {
        setLoading(false);
        showInfo(
          'Explain requests are temporarily rate-limited. Try again in a moment.',
        );
        return;
      }

      if (explainResult.error) {
        setLoading(false);
        if (explainResult.error === 'Request cancelled.') {
          return;
        }

        setErrorMessage(explainResult.error);
        return;
      }

      setResult(explainResult.data ?? null);
      setLoading(false);
    },
    [explain],
  );

  const openDialog = useCallback(
    (target: SelectionTarget) => {
      setDialogOpen(true);
      setResult(null);
      void requestExplanation(target);
    },
    [requestExplanation],
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const setTargetFromRange = useCallback(
    (
      range: Range,
      shouldSnapWordBoundary: boolean,
    ): SelectionTarget | null => {
      const container = containerRef.current;
      if (!container) {
        return null;
      }

      if (
        !isNodeInsideContainer(
          range.commonAncestorContainer,
          container,
        )
      ) {
        return null;
      }

      if (isInSkipZone(range.commonAncestorContainer, container)) {
        return null;
      }

      let resolvedRange = range;
      if (shouldSnapWordBoundary) {
        const snappedRange = snapRangeToWord(range, locale);
        if (snappedRange) {
          resolvedRange = snappedRange;

          // Keep native selection aligned with snapped word for mobile handles.
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(snappedRange);
          }
        }
      }

      const selectionText = resolvedRange.toString().trim();
      const resolvedWord = normalizeWord(
        getWordFromText(selectionText, locale) ?? selectionText,
      );

      if (!resolvedWord) {
        return null;
      }

      const contextBlock = getNearestContextBlock(
        resolvedRange.startContainer,
        container,
      );
      const contextText = contextBlock?.textContent?.trim() ?? '';
      const context = trimContextAroundWord(
        contextText,
        resolvedWord,
      );

      if (!context) {
        return null;
      }

      const rect = getSelectionRect(resolvedRange);
      return {
        word: resolvedWord,
        context,
        rect,
      };
    },
    [locale],
  );

  const processStableSelection = useCallback(() => {
    const selection = window.getSelection();

    if (
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0
    ) {
      clearSelectionUi();
      return;
    }

    const range = selection.getRangeAt(0);
    const target = setTargetFromRange(range, isMobile);

    if (!target) {
      clearSelectionUi();
      return;
    }

    setActiveTarget(target);
    setShowBubble(true);
  }, [clearSelectionUi, isMobile, setTargetFromRange]);

  const handleSelectionChange = useCallback(() => {
    if (selectionDebounceRef.current) {
      window.clearTimeout(selectionDebounceRef.current);
    }

    setShowBubble(false);
    selectionDebounceRef.current = window.setTimeout(
      processStableSelection,
      explainDebounceMs,
    );
  }, [processStableSelection]);

  const handlePowerClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const target = event.target as Node;
      if (!isNodeInsideContainer(target, container)) {
        return;
      }

      if (isInSkipZone(target, container)) {
        return;
      }

      // Use caret Range APIs so we can resolve a full word without token spans.
      const caretRange = document.caretRangeFromPoint
        ? document.caretRangeFromPoint(event.clientX, event.clientY)
        : null;

      if (!caretRange) {
        return;
      }

      const wordRange = snapRangeToWord(caretRange, locale);
      const resolvedRange = wordRange ?? caretRange;

      const targetData = setTargetFromRange(resolvedRange, true);
      if (!targetData) {
        return;
      }

      const selection = window.getSelection();
      if (selection && wordRange) {
        selection.removeAllRanges();
        selection.addRange(wordRange);
      }

      event.preventDefault();
      setShowBubble(false);
      setActiveTarget(targetData);
      openDialog(targetData);
    },
    [isMobile, locale, openDialog, setTargetFromRange],
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const handleMedia = () => setIsMobile(media.matches);

    handleMedia();
    media.addEventListener('change', handleMedia);
    return () => media.removeEventListener('change', handleMedia);
  }, []);

  useEffect(() => {
    const onSelectionChange = () => handleSelectionChange();

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener(
        'selectionchange',
        onSelectionChange,
      );
      if (selectionDebounceRef.current) {
        window.clearTimeout(selectionDebounceRef.current);
      }
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    if (!showBubble) {
      return;
    }

    bubbleButtonRef.current?.focus();
  }, [showBubble]);

  useEffect(() => {
    const message = isMobile
      ? 'Tip: Long-press to select a word, then tap Explain.'
      : 'Tip: Ctrl/Cmd+Click any word to explain it.';

    if (localStorage.getItem(explainHintKey)) {
      return;
    }

    showInfo(message);
    localStorage.setItem(explainHintKey, '1');
  }, [isMobile]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    const onOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dialogRef.current?.contains(target)) {
        return;
      }

      closeDialog();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onOutsidePointer);
    document.addEventListener('touchstart', onOutsidePointer);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onOutsidePointer);
      document.removeEventListener('touchstart', onOutsidePointer);
    };
  }, [closeDialog, dialogOpen]);

  const bubbleStyle = (() => {
    if (!activeTarget) {
      return { left: 0, top: 0 };
    }

    return {
      left: Math.max(
        12,
        Math.min(
          window.innerWidth - 88,
          activeTarget.rect.left + activeTarget.rect.width / 2 - 36,
        ),
      ),
      top: Math.max(12, activeTarget.rect.top - 44),
    };
  })();

  const popoverStyle = (() => {
    if (!activeTarget) {
      return { left: 16, top: 16 };
    }

    const desiredTop = activeTarget.rect.bottom + 10;
    const desiredLeft = activeTarget.rect.left;

    return {
      left: Math.max(
        8,
        Math.min(window.innerWidth - 360, desiredLeft),
      ),
      top: Math.max(
        8,
        Math.min(window.innerHeight - 260, desiredTop),
      ),
    };
  })();

  const underlineStyle = (() => {
    if (!activeTarget) {
      return { left: 0, top: 0, width: 0 };
    }

    return {
      left: Math.max(8, activeTarget.rect.left),
      top: Math.max(8, activeTarget.rect.bottom + 1),
      width: Math.max(18, activeTarget.rect.width),
    };
  })();

  const renderExplainContent = () => (
    <div aria-live="polite" className="space-y-3">
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-700" />
        </div>
      ) : errorMessage ? (
        <p className="text-sm text-red-400">{errorMessage}</p>
      ) : result ? (
        <>
          <p className="text-sm text-gray-200">
            <span className="font-semibold">Meaning: </span>
            {result.meaning}
          </p>
          <p className="text-sm text-gray-200">
            <span className="font-semibold">Simple: </span>
            {result.simplifiedExplanation}
          </p>
          <p className="text-xs text-gray-300">
            <span className="font-medium">Synonyms:</span>{' '}
            {result.synonyms.length
              ? result.synonyms.join(', ')
              : 'None'}
          </p>
          <p className="text-xs text-gray-300">
            <span className="font-medium">Antonyms:</span>{' '}
            {result.antonyms.length
              ? result.antonyms.join(', ')
              : 'None'}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-300">
          Select a word and press Explain.
        </p>
      )}
    </div>
  );

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onClick={handlePowerClick}
        className="prose prose-slate max-w-none font-serif selection:bg-transparent selection:text-inherit prose-invert prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-[1.0625rem] prose-p:leading-8 prose-a:text-blue-300 hover:prose-a:text-blue-200"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // If enabling raw HTML in the future, add a sanitize plugin hook here.
        >
          {content}
        </ReactMarkdown>
      </div>

      {(showBubble || dialogOpen) && activeTarget ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-30 h-[3px] rounded-full bg-gradient-to-r from-pink-500 via-yellow-400 to-blue-500"
          style={underlineStyle}
        />
      ) : null}

      {showBubble && activeTarget ? (
        <button
          ref={bubbleButtonRef}
          type="button"
          onClick={() => {
            setShowBubble(false);
            openDialog(activeTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setShowBubble(false);
              openDialog(activeTarget);
            }
          }}
          className="fixed z-40 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          style={bubbleStyle}
        >
          Explain
        </button>
      ) : null}

      {dialogOpen ? (
        isMobile ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/40"
            aria-hidden={false}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="word-explain-title"
              className="w-full rounded-t-2xl border p-4 shadow-xl border-gray-700 bg-gray-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3
                  id="word-explain-title"
                  className="text-base font-semibold text-gray-100"
                >
                  Explain “{activeTarget?.word}”
                </h3>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded p-1 hover:text-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={closeDialog}
                >
                  ✕
                </button>
              </div>
              {renderExplainContent()}
            </div>
          </div>
        ) : (
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="word-explain-title"
            className="fixed z-50 w-[340px] rounded-xl border p-4 shadow-xl border-gray-700 bg-gray-900"
            style={popoverStyle}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3
                id="word-explain-title"
                className="text-base font-semibold text-gray-100"
              >
                Explain “{activeTarget?.word}”
              </h3>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 hover:text-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={closeDialog}
              >
                ✕
              </button>
            </div>
            {renderExplainContent()}
          </div>
        )
      ) : null}
    </div>
  );
}
