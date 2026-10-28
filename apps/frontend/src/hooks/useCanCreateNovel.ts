import { useAuth } from './useAuth';

export function useCanCreateNovel() {
  const { user, loading } = useAuth();
  const canCreate =
    user?.roles.some(
      (role) => role === 'writer' || role === 'admin',
    ) ?? false;

  return { canCreate, loading };
}
