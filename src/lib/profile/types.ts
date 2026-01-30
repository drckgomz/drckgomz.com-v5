// src/lib/profile/types.ts
export type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar_color: string;
  first_name: string;
  last_name: string;

  // add these (exist in DB schema)
  is_owner?: boolean;
  is_whitelist_admin?: boolean;
};
