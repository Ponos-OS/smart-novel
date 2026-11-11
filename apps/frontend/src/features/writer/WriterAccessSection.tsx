import { useState } from 'react';

import { useMyWriterQuery } from '../../generated/graphql';
import { Role } from '../../generated/shared';
import { useAuth } from '../../hooks/useAuth';
import { isWriterOrHigher } from '../../lib/role';
import { RequestWriterAccessDialog } from './RequestWriterAccessDialog';
import { WriterAccessCard } from './WriterAccessCard';

/**
 * @description Only for a user whose highest role is `user`; writers and admins, and visitors who are not signed in, get nothing and no request is made.
 */
export function WriterAccessSection() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canRequest =
    roles.includes(Role.user) && !isWriterOrHigher(roles);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useMyWriterQuery(
    {},
    { enabled: canRequest },
  );

  if (!canRequest || isLoading || isError) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Writer access
      </h2>
      <WriterAccessCard
        request={data?.myWriter ?? null}
        onRequest={() => setIsDialogOpen(true)}
      />
      {isDialogOpen && (
        <RequestWriterAccessDialog
          onRequested={() => {
            setIsDialogOpen(false);
            refetch();
          }}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </section>
  );
}
