import { OIDCConfig } from "../types";
import { Client } from "@microsoft/microsoft-graph-client";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let aadConfig: OIDCConfig | null = null;

export async function getAADConfig(tenantId: string): Promise<OIDCConfig> {
  if (aadConfig) return aadConfig;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
  );
  aadConfig = await response.json() as OIDCConfig;
  return aadConfig;
}

export async function getAADUserToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  config: OIDCConfig
) {
  const tokenResponse = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  return await tokenResponse.json();
}

export async function getAADUserInfo(accessToken: string) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  // 使用 $select 参数获取所需字段，包括 id
  return await client.api('/me')
    .select('id,displayName,userPrincipalName,mail')
    .header('Prefer', 'IdType="ImmutableId"')
    .get();
}

export async function getAADUserInfoById(id: string, tenantId: string, clientId: string, clientSecret: string) {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }).toString(),
  });

  const tokenData = await tokenResponse.json() as TokenResponse;
  const accessToken = tokenData.access_token;

  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  return await client.api(`/users/${id}`).get();
}

export async function createAADUser(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  username: string,
  displayName: string,
  email: string,
  licenseSkuId: string
) {
  // 首先获取访问令牌
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }).toString(),
  });

  const tokenData = await tokenResponse.json() as TokenResponse;
  const accessToken = tokenData.access_token;

  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  // 生成随机密码
  const password = crypto.randomUUID();

  const user = {
    accountEnabled: true,
    displayName,
    mailNickname: username,
    userPrincipalName: email,
    usageLocation: "CN",
    passwordProfile: {
      password,
      forceChangePasswordNextSignIn: true,
    },
    passwordPolicies: "DisablePasswordExpiration,DisableStrongPassword",
  };

  const createdUser = await client.api("/users").post(user);

  // 分配许可证
  const licenseBody = {
    addLicenses: [
      {
        disabledPlans: [],
        skuId: licenseSkuId,
      },
    ],
    removeLicenses: [],
  };

  await client
    .api(`/users/${createdUser.id}/assignLicense`)
    .post(licenseBody);

  return {
    userId: createdUser.id,
    password,
  };
}

