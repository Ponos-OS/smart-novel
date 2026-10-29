import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  useMyPlatformTermsStatusQuery,
  usePlatformTermsQuery,
} from '../../generated/graphql';

export function PlatformTermsTab() {
  const { data: termsData, isLoading: isTermsLoading } =
    usePlatformTermsQuery();
  const { data: statusData } = useMyPlatformTermsStatusQuery();
  const terms = termsData?.platformTerms;
  const status = statusData?.myPlatformTermsStatus;

  if (isTermsLoading) {
    return <p>Loading the platform terms...</p>;
  }

  if (!terms) {
    return <p role="alert">Failed to fetch the platform terms</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
        Version {terms.version}.{' '}
        {status?.acceptedAt ? (
          <>
            You accepted these terms on{' '}
            <time dateTime={status.acceptedAt}>
              {new Date(status.acceptedAt).toLocaleDateString()}
            </time>
            .
          </>
        ) : (
          'You have not accepted this version yet.'
        )}
      </p>
      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {terms.markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
