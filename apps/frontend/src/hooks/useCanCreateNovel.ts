import { isWriterOrHigher } from '../lib/role';
import { useAuth } from './useAuth';

export function useCanCreateNovel() {
  const { user, loading } = useAuth();
  const canCreate = isWriterOrHigher(user?.roles ?? []);

  return { canCreate, loading };
}
