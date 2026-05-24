"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import { useSession } from "next-auth/react";

import { useProfiles } from "@/hooks";

import { Card, CardContent, CardHeader, CardTitle, Button, Alert, AlertTitle, AlertDescription, useToast, Input, Skeleton, AvatarImg } from "@/components";

import { calculatePasswordStrength, formatInitialName } from "@/utils";

interface ProfileData {
  name: string;
  email: string;
  avatar: string | null;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
  const t = useTranslations("profilesPage");
  const strength = React.useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="w-full h-2 overflow-hidden bg-gray-200 rounded-full">
        <div className={`h-full bg-${strength.color}-500 transition-all duration-300`} style={{ width: `${strength.percentage}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium text-${strength.color}-600`}>
          {t("password.strength")}: {t(`password.strengthLevel.${strength.strength}`)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {(["length", "uppercase", "lowercase", "number", "special"] as const).map((check) => (
          <div key={check} className={`flex items-center gap-2 ${strength.checks[check] ? "text-green-600" : "text-gray-400"}`}>
            {strength.checks[check] ? "✓" : "○"} {t(`password.requirements.${check}`)}
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <Skeleton className="w-64 h-8" />
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-96" />
      ))}
    </div>
  </div>
);

interface ProfileFormProps {
  profile: NonNullable<ReturnType<typeof useProfiles>["profile"]>;
  sessionUser: { name?: string | null; email?: string | null; avatar?: string | null } | undefined;
  updateProfile: ReturnType<typeof useProfiles>["updateProfile"];
  changePassword: ReturnType<typeof useProfiles>["changePassword"];
  uploadAvatar: ReturnType<typeof useProfiles>["uploadAvatar"];
  deleteAvatar: ReturnType<typeof useProfiles>["deleteAvatar"];
  isUpdatingProfile: boolean;
  isChangingPassword: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  profile,
  sessionUser,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  isUpdatingProfile,
  isChangingPassword,
  isUploadingAvatar,
  isDeletingAvatar,
}) => {
  const t = useTranslations("profilesPage");
  const { addToast } = useToast();

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = React.useState<ProfileData>(() => ({
    name: profile.name || sessionUser?.name || "",
    email: profile.email || sessionUser?.email || "",
    avatar: profile.avatar || sessionUser?.avatar || null,
  }));

  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(() => profile.avatar || sessionUser?.avatar || null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);

  const [passwordData, setPasswordData] = React.useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const hasProfileChanges = React.useMemo(() => profileData.name !== (profile.name || "") || avatarFile !== null || profileData.avatar !== profile.avatar, [profileData, profile, avatarFile]);

  const isProcessing = isUpdatingProfile || isUploadingAvatar || isDeletingAvatar;

  const handleProfileChange = React.useCallback((field: keyof ProfileData, value: string) => setProfileData((prev) => ({ ...prev, [field]: value })), []);

  const handlePasswordChange = React.useCallback((field: keyof PasswordData, value: string) => setPasswordData((prev) => ({ ...prev, [field]: value })), []);

  const handleAvatarClick = React.useCallback(() => fileInputRef.current?.click(), []);

  const handleAvatarChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        addToast({ message: t("avatar.validation.invalidType"), type: "error" });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        addToast({ message: t("avatar.validation.sizeTooLarge"), type: "error" });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setAvatarFile(file);
      };
      reader.readAsDataURL(file);
    },
    [addToast, t],
  );

  const handleRemoveAvatar = React.useCallback(async () => {
    if (profileData.avatar) {
      await deleteAvatar(profileData.avatar);
    }

    updateProfile(
      { name: profileData.name.trim(), avatar: null },
      {
        onSuccess: () => {
          addToast({ message: t("avatar.success.removed"), type: "success" });
          setAvatarPreview(null);
          setAvatarFile(null);
          setProfileData((prev) => ({ ...prev, avatar: null }));
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (error: Error) => {
          addToast({ message: error.message || t("avatar.error.remove"), type: "error" });
        },
      },
    );
  }, [profileData, deleteAvatar, updateProfile, addToast, t]);

  const handleProfileUpdate = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (!profileData.name.trim()) {
        addToast({ message: t("profile.validation.nameRequired"), type: "error" });
        return;
      }
      if (profileData.name.length < 2) {
        addToast({ message: t("profile.validation.nameMinLength"), type: "error" });
        return;
      }

      let avatarUrl = profileData.avatar;

      if (avatarFile) {
        if (profileData.avatar) await deleteAvatar(profileData.avatar);
        avatarUrl = await uploadAvatar(avatarFile);
      }

      updateProfile(
        { name: profileData.name.trim(), avatar: avatarUrl || null },
        {
          onSuccess: () => {
            addToast({ message: t("profile.success.updated"), type: "success" });
            setAvatarFile(null);
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("profile.error.update"), type: "error" });
          },
        },
      );
    },
    [profileData, avatarFile, uploadAvatar, deleteAvatar, updateProfile, addToast, t],
  );

  const handlePasswordSubmit = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (!passwordData.currentPassword) {
        addToast({ message: t("password.validation.currentRequired"), type: "error" });
        return;
      }
      if (!passwordData.newPassword) {
        addToast({ message: t("password.validation.newRequired"), type: "error" });
        return;
      }
      if (passwordData.newPassword.length < 8) {
        addToast({ message: t("password.validation.minLength"), type: "error" });
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        addToast({ message: t("password.validation.noMatch"), type: "error" });
        return;
      }

      const strength = calculatePasswordStrength(passwordData.newPassword);
      if (strength.strength === "weak") {
        addToast({ message: t("password.validation.tooWeak"), type: "warning" });
        return;
      }

      if (passwordData.currentPassword === passwordData.newPassword) {
        addToast({ message: t("password.validation.mustDiffer"), type: "error" });
        return;
      }

      changePassword(
        { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword },
        {
          onSuccess: () => {
            addToast({ message: t("password.success.changed"), type: "success" });
            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("password.error.change"), type: "error" });
          },
        },
      );
    },
    [passwordData, changePassword, addToast, t],
  );

  const handleCancelProfileChanges = React.useCallback(() => {
    setProfileData({
      name: profile.name || "",
      email: profile.email || "",
      avatar: profile.avatar || null,
    });
    setAvatarPreview(profile.avatar || null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [profile]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">👤 {t("profile.title")}</CardTitle>
              <p className="mt-1 text-sm text-primary-600">{t("profile.description")}</p>
            </div>
            {hasProfileChanges && <span className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">{t("profile.unsavedChanges")}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 pb-6 border-b">
              <div className="relative group">
                <div className="w-32 h-32 overflow-hidden rounded-full shadow-border bg-primary-50">
                  {avatarPreview ? (
                    <AvatarImg src={avatarPreview} alt={profileData.name || "Profile"} size="3xl" className="shrink-0" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-3xl font-bold text-primary-700">{profileData.name ? formatInitialName(profileData.name) : "👤"}</div>
                  )}
                </div>
                <div
                  onClick={handleAvatarClick}
                  className="absolute inset-0 flex items-center justify-center transition-opacity bg-black bg-opacity-50 rounded-full opacity-0 cursor-pointer group-hover:opacity-100"
                >
                  <span className="text-sm font-medium text-white">{t("avatar.changePhoto")}</span>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleAvatarClick} disabled={isProcessing}>
                  📷 {t("avatar.upload")}
                </Button>
                {(avatarPreview || avatarFile) && (
                  <Button type="button" variant="ghost" onClick={handleRemoveAvatar} disabled={isProcessing} isLoading={isDeletingAvatar}>
                    🗑️ {t("avatar.remove")}
                  </Button>
                )}
              </div>

              <div className="text-center">
                <p className="text-xs text-primary-600">{t("avatar.recommended")}</p>
                <p className="text-xs text-primary-500">{t("avatar.requirements")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                label={`${t("profile.name")} *`}
                placeholder={t("profile.namePlaceholder")}
                value={profileData.name}
                onChange={(e) => handleProfileChange("name", e.target.value)}
                maxLength={100}
                required
              />

              <div>
                <Input type="email" label={t("profile.email")} value={profileData.email} disabled />
                <p className="mt-1 text-xs text-primary-600">🔒 {t("profile.emailNote")}</p>
              </div>

              {hasProfileChanges && (
                <Alert variant="info">
                  <AlertTitle>📝 {t("profile.unsavedChangesTitle")}</AlertTitle>
                  <AlertDescription>{t("profile.unsavedChangesDescription")}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                {hasProfileChanges && (
                  <Button type="button" variant="ghost" onClick={handleCancelProfileChanges} disabled={isProcessing}>
                    {t("profile.cancel")}
                  </Button>
                )}
                <Button onClick={handleProfileUpdate} variant="primary" isLoading={isProcessing} disabled={!hasProfileChanges}>
                  {isUploadingAvatar ? t("profile.uploading") : hasProfileChanges ? t("profile.saveChanges") : t("profile.noChanges")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🔒 {t("security.title")}</CardTitle>
          <p className="mt-1 text-sm text-primary-600">{t("security.description")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(
              [
                { field: "currentPassword", show: showCurrentPassword, toggle: setShowCurrentPassword, labelKey: "security.currentPassword", placeholderKey: "security.currentPasswordPlaceholder" },
                { field: "newPassword", show: showNewPassword, toggle: setShowNewPassword, labelKey: "security.newPassword", placeholderKey: "security.newPasswordPlaceholder" },
              ] as const
            ).map(({ field, show, toggle, labelKey, placeholderKey }) => (
              <div key={field} className="relative">
                <Input
                  type={show ? "text" : "password"}
                  label={`${t(labelKey)} *`}
                  placeholder={t(placeholderKey)}
                  value={passwordData[field]}
                  onChange={(e) => handlePasswordChange(field, e.target.value)}
                  required
                />
                <button type="button" className="absolute right-3 top-9 text-primary-600 hover:text-primary-900" onClick={() => toggle((v) => !v)}>
                  {show ? "🙈" : "👁️"}
                </button>
              </div>
            ))}

            {passwordData.newPassword && <PasswordStrengthIndicator password={passwordData.newPassword} />}

            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                label={`${t("security.confirmPassword")} *`}
                placeholder={t("security.confirmPasswordPlaceholder")}
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                required
              />
              <button type="button" className="absolute right-3 top-9 text-primary-600 hover:text-primary-900" onClick={() => setShowConfirmPassword((v) => !v)}>
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {passwordData.confirmPassword && (
              <div className={`text-sm ${passwordData.newPassword === passwordData.confirmPassword ? "text-green-600" : "text-red-600"}`}>
                {passwordData.newPassword === passwordData.confirmPassword ? `✓ ${t("password.match")}` : `✗ ${t("password.noMatch")}`}
              </div>
            )}

            <Alert variant="warning">
              <AlertTitle>🛡️ {t("security.tipsTitle")}</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                  {(["unique", "combine", "avoid", "manager"] as const).map((tip) => (
                    <li key={tip}>{t(`security.tips.${tip}`)}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handlePasswordSubmit}
                variant="primary"
                isLoading={isChangingPassword}
                disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {t("security.changePassword")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export const Profiles: React.FC = () => {
  const t = useTranslations("profilesPage");
  const { data: session } = useSession();
  const { profile, isLoading, updateProfile, isUpdatingProfile, changePassword, isChangingPassword, uploadAvatar, isUploadingAvatar, deleteAvatar, isDeletingAvatar } = useProfiles();

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary-900">{t("title")}</h1>
        <p className="mt-1 text-primary-600">{t("subtitle")}</p>
      </div>

      {profile && (
        <ProfileForm
          key={profile.id ?? profile.email}
          profile={profile}
          sessionUser={session?.user}
          updateProfile={updateProfile}
          changePassword={changePassword}
          uploadAvatar={uploadAvatar}
          deleteAvatar={deleteAvatar}
          isUpdatingProfile={isUpdatingProfile}
          isChangingPassword={isChangingPassword}
          isUploadingAvatar={isUploadingAvatar}
          isDeletingAvatar={isDeletingAvatar}
        />
      )}
    </div>
  );
};
