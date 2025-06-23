// index.ts
// TypeScript interfaces and types

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface ConfigState {
  workspaceId: string | null;
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface ClickUpUser {
  id: string;
  username: string;
  email: string;
  color: string;
  profilePicture: string;
  initials: string;
  role: number;
  custom_role?: string;
  last_active?: string;
  date_joined?: string;
  date_invited?: string;
}