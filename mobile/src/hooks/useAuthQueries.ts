import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from './useOfflineMutation';
import { auth, messages } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function useSignup() {
  const queryClient = useQueryClient();
  const { login } = useAuth();
  return useOfflineMutation(
    ['auth', 'signup'],
    (data: { name: string; email: string; password: string }) => auth.signup(data),
    {
      onSuccess: (response) => {
        const { token, user } = response.data;
        login(token, user);
      },
    }
  );
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuth();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => auth.login(data),
    onSuccess: (response) => {
      const { token, user } = response.data;
      login(token, user);
    },
  });
}

export function useSendOTP() {
  return useOfflineMutation(
    ['auth', 'sendOTP'],
    (data: { phone: string }) => auth.sendOTP(data),
  );
}

export function useResendOTP() {
  return useOfflineMutation(
    ['auth', 'resendOTP'],
    (data: { phone: string }) => auth.resendOTP(data),
  );
}

export function useVerifyOTP() {
  const queryClient = useQueryClient();
  const { login } = useAuth();
  return useOfflineMutation(
    ['auth', 'verifyOTP'],
    (data: { phone: string; code: string }) => auth.verifyOTP(data),
    {
      onSuccess: (response) => {
        const { token, user, userExists } = response.data;
        if (userExists && token && user) {
          login(token, user);
        }
      },
    }
  );
}

export function useSetName() {
  const queryClient = useQueryClient();
  const { login } = useAuth();
  return useOfflineMutation(
    ['auth', 'setName'],
    (data: { registrationToken: string; name: string }) => auth.setName(data),
    {
      onSuccess: (response) => {
        const { token, user } = response.data;
        login(token, user);
      },
    }
  );
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  return useMutation({
    mutationFn: () => auth.logout?.() || Promise.resolve(),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
  });
}

export function useRegisterPushToken() {
  return useOfflineMutation(
    ['auth', 'pushRegister'],
    (data: { token: string }) => auth.pushRegister(data),
  );
}