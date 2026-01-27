// src/app/admin/users/types.ts

export type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;

  role: string; // "user" | "admin"
  can_view_private: boolean;
  is_owner: boolean;
  is_banned: boolean;

  banned_at: string | null;
  banned_reason: string | null;

  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
  avatar_color: string | null;
};

export type MeProfile = {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_owner: boolean;
  is_banned: boolean;
  can_view_private: boolean;
};
