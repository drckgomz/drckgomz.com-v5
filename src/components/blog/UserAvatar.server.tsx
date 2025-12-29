// src/components/blog/UserAvatar.server.tsx
import { getUserProfile } from "@/lib/profile/getUserProfile";
import UserAvatarClient from "./UserAvatar.client";

export default async function UserAvatarServer() {
  const profile = await getUserProfile();
  return <UserAvatarClient profile={profile} />;
}
