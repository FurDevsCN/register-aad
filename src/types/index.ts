import { User } from "../services/db";

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_ORG: string;
  AAD_CLIENT_ID: string;
  AAD_CLIENT_SECRET: string;
  AAD_TENANT_ID: string;
  AAD_MAIL_DOMAIN: string;
  AAD_LICENSE_SKU_ID: string;
  JWT_SECRET: string;
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
}

export type GitHubTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
};

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
};

export type UserStatus = 'unverified' | 'verified' | 'unlinked' | 'active';

export type Variables = {
  user: User;
};

export type OIDCConfig = {
  token_endpoint: string;
  authorization_endpoint: string;
  userinfo_endpoint: string;
};

export type AADTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token: string;
};

export type AADUserInfo = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  [key: string]: unknown;
}; 