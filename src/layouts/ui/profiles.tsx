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
  avatarFileId: string | null;
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

  const barColor = strength.strength === "strong" ? "bg-secondary-400" : strength.strength === "medium" ? "bg-primary-400" : strength.strength === "weak" ? "bg-amber-500" : "bg-rose-500";

  const textColor =
    strength.strength === "strong"
      ? "text-secondary-400 dark:text-secondary-400"
      : strength.strength === "medium"
        ? "text-primary-500 dark:text-primary-700"
        : strength.strength === "weak"
          ? "text-amber-600 dark:text-amber-400"
          : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-2">
      <div className="w-full h-2 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-400">
        <div className={`h-full transition-all duration-300 ${barColor}`} style={{ width: `${strength.percentage}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs sm:text-sm font-medium ${textColor}`}>
          {t("password.strength")}: {t(`password.strengthLevel.${strength.strength}`)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 sm:gap-2">
        {(["length", "uppercase", "lowercase", "number", "special"] as const).map((check) => (
          <div key={check} className={`flex items-center gap-1.5 ${strength.checks[check] ? "text-secondary-400 dark:text-secondary-400" : "text-primary-400 dark:text-primary-600"}`}>
            {strength.checks[check] ? "✓" : "○"} {t(`password.requirements.${check}`)}
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="w-40 h-7 sm:w-64 sm:h-8" />
    <div className="space-y-3 sm:space-y-4">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-72 sm:h-96" />
      ))}
    </div>
  </div>
);

interface ProfileFormProps {
  profile: NonNullable<ReturnType<typeof useProfiles>["profile"]>;
  sessionUser: { name?: string | null; email?: string | null; avatar?: string | null; avatarFileId?: string | null } | undefined;
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
    avatarFileId: profile.avatarFileId || sessionUser?.avatarFileId || null,
  }));

  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(() => profile.avatar || sessionUser?.avatar || null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);

  const [passwordData, setPasswordData] = React.useState<PasswordData>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const hasProfileChanges = React.useMemo(
    () => profileData.name !== (profile.name || "") || avatarFile !== null || profileData.avatar !== (profile.avatar || null),
    [profileData.name, profileData.avatar, profile.name, profile.avatar, avatarFile],
  );

  const isProcessing = isUpdatingProfile || isUploadingAvatar || isDeletingAvatar;

  const handleProfileChange = React.useCallback((field: keyof Pick<ProfileData, "name" | "email">, value: string) => setProfileData((prev) => ({ ...prev, [field]: value })), []);
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
    if (avatarFile && !profileData.avatar) {
      setAvatarPreview(profile.avatar || null);
      setAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      if (profileData.avatarFileId) await deleteAvatar(profileData.avatarFileId);
      updateProfile(
        { name: profileData.name.trim(), avatar: null, avatarFileId: null },
        {
          onSuccess: () => {
            addToast({ message: t("avatar.success.removed"), type: "success" });
            setAvatarPreview(null);
            setAvatarFile(null);
            setProfileData((prev) => ({ ...prev, avatar: null, avatarFileId: null }));
            if (fileInputRef.current) fileInputRef.current.value = "";
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("avatar.error.remove"), type: "error" });
          },
        },
      );
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : t("avatar.error.remove"), type: "error" });
    }
  }, [avatarFile, profileData, profile.avatar, deleteAvatar, updateProfile, addToast, t]);

  const handleProfileUpdate = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!profileData.name.trim()) {
        addToast({ message: t("profile.validation.nameRequired"), type: "error" });
        return;
      }
      if (profileData.name.trim().length < 2) {
        addToast({ message: t("profile.validation.nameMinLength"), type: "error" });
        return;
      }

      let avatarUrl = profileData.avatar;
      let avatarFileId = profileData.avatarFileId;

      if (avatarFile) {
        try {
          if (profileData.avatarFileId) await deleteAvatar(profileData.avatarFileId);
          const uploaded = await uploadAvatar(avatarFile);
          avatarUrl = uploaded.url;
          avatarFileId = uploaded.fileId;
        } catch (error) {
          addToast({ message: error instanceof Error ? error.message : t("profile.error.update"), type: "error" });
          return;
        }
      }

      updateProfile(
        { name: profileData.name.trim(), avatar: avatarUrl, avatarFileId },
        {
          onSuccess: () => {
            addToast({ message: t("profile.success.updated"), type: "success" });
            setProfileData((prev) => ({ ...prev, avatar: avatarUrl, avatarFileId }));
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
    setProfileData({ name: profile.name || "", email: profile.email || "", avatar: profile.avatar || null, avatarFileId: profile.avatarFileId || null });
    setAvatarPreview(profile.avatar || null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [profile]);

  const canRemoveAvatar = Boolean(avatarPreview || avatarFile);

  return (
    <>
      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl dark:text-primary-900">👤 {t("profile.title")}</CardTitle>
              <p className="mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("profile.description")}</p>
            </div>
            {hasProfileChanges && (
              <span className="self-start px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">
                {t("profile.unsavedChanges")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col items-center gap-3 pb-4 border-b border-primary-100 dark:border-primary-400 sm:gap-4 sm:pb-6">
              <div className="relative group">
                <div className="w-24 h-24 sm:w-32 sm:h-32 overflow-hidden rounded-full shadow-border bg-primary-50 dark:bg-primary-300">
                  {avatarPreview ? (
                    <AvatarImg src={avatarPreview} alt={profileData.name || "Profile"} size="3xl" className="shrink-0" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-2xl sm:text-3xl font-bold text-primary-600 dark:text-primary-700">
                      {profileData.name ? formatInitialName(profileData.name) : "👤"}
                    </div>
                  )}
                </div>
                <div
                  onClick={handleAvatarClick}
                  className="absolute inset-0 flex items-center justify-center transition-opacity bg-primary-900/50 rounded-full opacity-0 cursor-pointer group-hover:opacity-100"
                >
                  <span className="text-xs sm:text-sm font-medium text-white">{t("avatar.changePhoto")}</span>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAvatarClick} disabled={isProcessing} className="text-xs sm:text-sm">
                  📷 {t("avatar.upload")}
                </Button>
                {canRemoveAvatar && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAvatar} disabled={isProcessing} isLoading={isDeletingAvatar} className="text-xs sm:text-sm">
                    🗑️ {t("avatar.remove")}
                  </Button>
                )}
              </div>

              <div className="text-center">
                <p className="text-xs text-primary-500 dark:text-primary-700">{t("avatar.recommended")}</p>
                <p className="text-xs text-primary-400 dark:text-primary-600">{t("avatar.requirements")}</p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
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
                <p className="mt-1 text-xs text-primary-500 dark:text-primary-700">🔒 {t("profile.emailNote")}</p>
              </div>

              {hasProfileChanges && (
                <Alert variant="info">
                  <AlertTitle>📝 {t("profile.unsavedChangesTitle")}</AlertTitle>
                  <AlertDescription>{t("profile.unsavedChangesDescription")}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:flex-row sm:justify-end sm:gap-3 sm:pt-4">
                {hasProfileChanges && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelProfileChanges} disabled={isProcessing} className="text-xs sm:text-sm">
                    {t("profile.cancel")}
                  </Button>
                )}
                <Button onClick={handleProfileUpdate} variant="primary" size="sm" isLoading={isProcessing} disabled={!hasProfileChanges} className="text-xs sm:text-sm">
                  {isUploadingAvatar ? t("profile.uploading") : hasProfileChanges ? t("profile.saveChanges") : t("profile.noChanges")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl dark:text-primary-900">🔒 {t("security.title")}</CardTitle>
          <p className="mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("security.description")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
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
                <button
                  type="button"
                  className="absolute right-3 top-8 sm:top-9 text-primary-500 dark:text-primary-700 hover:text-primary-900 dark:hover:text-primary-900"
                  onClick={() => toggle((v) => !v)}
                >
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
              <button
                type="button"
                className="absolute right-3 top-8 sm:top-9 text-primary-500 dark:text-primary-700 hover:text-primary-900 dark:hover:text-primary-900"
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {passwordData.confirmPassword && (
              <div
                className={`text-xs sm:text-sm font-medium ${passwordData.newPassword === passwordData.confirmPassword ? "text-secondary-400 dark:text-secondary-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {passwordData.newPassword === passwordData.confirmPassword ? `✓ ${t("password.match")}` : `✗ ${t("password.noMatch")}`}
              </div>
            )}

            <Alert variant="warning">
              <AlertTitle>🛡️ {t("security.tipsTitle")}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1.5 sm:mt-2 space-y-1 text-xs sm:text-sm list-disc list-inside">
                  {(["unique", "combine", "avoid", "manager"] as const).map((tip) => (
                    <li key={tip}>{t(`security.tips.${tip}`)}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end pt-3 border-t border-primary-100 dark:border-primary-400 sm:pt-4">
              <Button
                onClick={handlePasswordSubmit}
                variant="primary"
                size="sm"
                isLoading={isChangingPassword}
                disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="text-xs sm:text-sm w-full sm:w-auto"
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
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
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
