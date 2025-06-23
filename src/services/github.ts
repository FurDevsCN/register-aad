import { Bindings, GitHubTokenResponse, GitHubUser } from "../types";
import axios, { CreateAxiosDefaults } from "axios";

function createAxiosInstance(baseURL: string | undefined, env: Bindings) {
  const config: CreateAxiosDefaults = {
    baseURL,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  };

  const proxy = env.HTTPS_PROXY || env.HTTP_PROXY;
  if (proxy) {
    try {
      const proxyUrl = new URL(proxy);
      console.log(`[GitHub Service] Using proxy: ${proxy}`);
      config.proxy = {
        protocol: proxyUrl.protocol.replace(':', ''),
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port || '80'),
      };
    } catch (error) {
      console.warn(`[GitHub Service] Invalid proxy URL: ${proxy}`);
    }
  } else {
    console.log('[GitHub Service] No proxy configured');
  }

  return axios.create(config);
}

export async function getGitHubToken(
  code: string,
  clientId: string,
  clientSecret: string,
  env: Bindings
): Promise<GitHubTokenResponse> {
  console.log(`[GitHub Service] Getting token for code: ${code.substring(0, 4)}...`);
  
  try {
    const client = createAxiosInstance("https://github.com", env);
    const response = await client.post<GitHubTokenResponse & { error?: string }>(
      "/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        }
      }
    );

    console.log("[GitHub Service] Token response received");
    
    if (response.data.error) {
      console.error(`[GitHub Service] GitHub API error: ${response.data.error}`);
      throw new Error(`GitHub API error: ${response.data.error}`);
    }

    return response.data;
  } catch (error) {
    console.error("[GitHub Service] Error in getGitHubToken:", error);
    if (axios.isAxiosError(error)) {
      console.error("[GitHub Service] Response data:", error.response?.data);
    }
    throw error;
  }
}

export async function getGitHubUser(accessToken: string, env: Bindings): Promise<GitHubUser> {
  console.log("[GitHub Service] Getting user info");
  
  try {
    const client = createAxiosInstance("https://api.github.com", env);
    const response = await client.get<GitHubUser>(
      "/user",
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        }
      }
    );

    console.log(`[GitHub Service] User info received for: ${response.data.login}`);
    return response.data;
  } catch (error) {
    console.error("[GitHub Service] Error in getGitHubUser:", error);
    if (axios.isAxiosError(error)) {
      console.error("[GitHub Service] Response data:", error.response?.data);
    }
    throw error;
  }
}

export async function checkOrgMembership(
  accessToken: string,
  org: string,
  username: string,
  env: Bindings
): Promise<boolean> {
  console.log(`[GitHub Service] Checking org membership for ${username} in ${org}`);
  
  try {
    const client = createAxiosInstance("https://api.github.com", env);
    const response = await client.get(
      `/orgs/${org}/members/${username}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
        validateStatus: (status) => status === 204 || status === 404
      }
    );

    console.log(`[GitHub Service] Org membership status: ${response.status}`);
    return response.status === 204;
  } catch (error) {
    console.error("[GitHub Service] Error in checkOrgMembership:", error);
    if (axios.isAxiosError(error)) {
      console.error("[GitHub Service] Response data:", error.response?.data);
    }
    throw error;
  }
} 