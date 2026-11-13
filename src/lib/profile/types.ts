// src/lib/profile/types.ts
export type UserProfile = {
  id: string;
  username: string;
  /** Better Auth's user.name is the public-facing display name; username is internal. */
  display_name: string;
  email: string;
  role: string;
  avatar_color: string;
  first_name: string;
  last_name: string;

  enabled: boolean;
  is_banned: boolean;
  can_view_private: boolean;

  // Application permissions, always verified on the server.
  is_owner?: boolean;
  is_whitelist_admin?: boolean;
};
