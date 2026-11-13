import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toMe, Me } from '../services/social';

export const useMe = (): Me => {
  const { user } = useAuth();
  return useMemo(() => toMe(user), [user?.id, user?.name, user?.avatar]);
};
