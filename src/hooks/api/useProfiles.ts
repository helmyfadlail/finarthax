"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "next-auth/react";

import { upload } from "@imagekit/next";

import { apiClient } from "@/utils";

import type { ApiResponse, User } from "@/types";

interface ProfileData {
  name: string;
  avatar: string | null;
  avatarFileId: string | null;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
}

interface UploadAuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}

async function fetchUploadAuth(): Promise<{ data: UploadAuthParams }> {
  const res = await fetch("/api/imagekit/upload-auth");
  if (!res.ok) throw new Error(`Failed to get upload auth (${res.status})`);

  return res.json();
}

export const useProfiles = () => {
  const queryClient = useQueryClient();
  const { data: session, update: updateSession } = useSession();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => apiClient.get<ApiResponse<User>>("/users/profile"),
    enabled: !!session?.user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileData) => apiClient.put<ApiResponse<User>, ProfileData>("/users/profile", data),
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });

      if (response.data?.name) {
        await updateSession({ ...session, user: { ...session?.user, name: response.data.name } });
      }
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordData) => apiClient.post<ApiResponse<null>, PasswordData>("/users/change-password", data),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File): Promise<{ url: string; fileId: string }> => {
      const { data } = await fetchUploadAuth();

      const response = await upload({
        file,
        fileName: `avatar-${Date.now()}-${file.name}`,
        signature: data.signature,
        expire: data.expire,
        token: data.token,
        publicKey: data.publicKey,
        folder: "/avatars",
      });

      const { url, fileId } = response as { url: string; fileId: string };

      if (!url || !fileId) throw new Error("ImageKit upload response missing url or fileId");

      return { url, fileId };
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async (fileId: string): Promise<void> => {
      if (!fileId) return;

      const res = await fetch(`/api/imagekit/delete/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      if (res.status === 200) return;

      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to delete avatar (${res.status})`);
    },
  });

  return {
    profile: data?.data || null,
    isLoading,
    error,
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    profileError: updateProfileMutation.error,
    changePassword: changePasswordMutation.mutate,
    changePasswordAsync: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
    passwordError: changePasswordMutation.error,
    uploadAvatar: uploadAvatarMutation.mutateAsync,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    uploadAvatarError: uploadAvatarMutation.error,
    deleteAvatar: deleteAvatarMutation.mutateAsync,
    isDeletingAvatar: deleteAvatarMutation.isPending,
    deleteAvatarError: deleteAvatarMutation.error,
  };
};
