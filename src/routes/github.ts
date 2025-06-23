import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getCookie, setCookie } from "hono/cookie";
import { Bindings, Variables, UserStatus } from "../types";
import * as githubService from "../services/github";
import * as dbService from "../services/db";

type AppType = Hono<{ Bindings: Bindings; Variables: Variables }>;

export const githubRoutes = (app: AppType) => {
  app.get("/api/user/login/github", async (c) => {
    try {
      const state = crypto.randomUUID();
      setCookie(c, "oauth_state", state, {
        httpOnly: true,
        secure: true,
        path: "/",
        maxAge: 60 * 10,
      });

      const params = new URLSearchParams({
        client_id: c.env.GITHUB_CLIENT_ID,
        redirect_uri: `${new URL(c.req.url).origin}/github/callback`,
        scope: "read:user read:org",
        state,
      });

      return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
    } catch (error) {
      console.error("[GitHub Routes] Error in login route:", error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  });

  app.get("/api/user/login/github/callback", async (c) => {
    try {
      const { code, state } = c.req.query();
      const savedState = getCookie(c, "oauth_state");

      if (!code) {
        console.error("[GitHub Routes] No code provided in callback");
        return c.json({ code: 400, message: "No authorization code provided" }, 400);
      }

      if (!state || !savedState || state !== savedState) {
        console.error("[GitHub Routes] Invalid state in callback");
        return c.json({ code: 400, message: "Invalid state" }, 400);
      }

      console.log("[GitHub Routes] Getting GitHub token");
      const tokenData = await githubService.getGitHubToken(
        code as string,
        c.env.GITHUB_CLIENT_ID,
        c.env.GITHUB_CLIENT_SECRET,
        c.env
      );

      if (!tokenData.access_token) {
        console.error("[GitHub Routes] No access token in response");
        return c.json({ code: 400, message: "Failed to get access token" }, 400);
      }

      console.log("[GitHub Routes] Getting GitHub user data");
      const userData = await githubService.getGitHubUser(tokenData.access_token, c.env);
      let status: UserStatus = 'unverified';

      console.log(`[GitHub Routes] Checking org membership for ${userData.login}`);
      const isMember = await githubService.checkOrgMembership(
        tokenData.access_token,
        c.env.GITHUB_ORG,
        userData.login,
        c.env
      );

      if (isMember) {
        status = 'verified';
        console.log(`[GitHub Routes] Updating org member verification for ${userData.login}`);
        await dbService.updateOrgMemberVerification(
          c.env.DB,
          userData.id.toString(),
          c.env.GITHUB_ORG
        );

        console.log(`[GitHub Routes] Checking AAD link status for ${userData.login}`);
        const aadUser = await dbService.getAADUser(c.env.DB, userData.id.toString());
        status = aadUser ? 'active' : 'unlinked';
      }

      console.log(`[GitHub Routes] Creating/updating user ${userData.login}`);
      await dbService.createOrUpdateUser(
        c.env.DB,
        userData.id.toString(),
        userData.name || userData.login,
        status
      );

      const token = await sign({
        id: userData.id.toString(),
      }, c.env.JWT_SECRET);

      console.log(`[GitHub Routes] Login successful for ${userData.login}`);
      setCookie(c, "token", token, {
        httpOnly: true,
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return c.json({
        code: 0,
        data: {
          token,
          user: {
            id: userData.id,
            name: userData.name || userData.login,
            status,
          },
        },
      });
    } catch (error) {
      console.error("[GitHub Routes] Error in callback route:", error);
      return c.json({
        code: 500,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

  app.post("/api/user/refresh-org-status", async (c) => {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ code: 401, message: "Unauthorized" }, 401);
      }

      const lastVerification = await dbService.getLastVerification(c.env.DB, user.id);

      if (lastVerification) {
        const lastVerifiedAt = new Date(lastVerification.last_verified_at as string);
        const now = new Date();
        const diffInMinutes = (now.getTime() - lastVerifiedAt.getTime()) / 1000 / 60;

        if (diffInMinutes < 1) {
          return c.json({
            code: 429,
            message: "Please wait at least 1 minute between verification attempts",
            data: {
              nextVerificationAllowedAt: new Date(lastVerifiedAt.getTime() + 60 * 1000).toISOString(),
            }
          }, 429);
        }
      }

      // Since we can't refresh the token, we'll ask the user to re-login
      return c.json({
        code: 401,
        message: "Please re-login to verify your organization membership",
        data: {
          redirectUrl: "/api/user/login/github"
        }
      }, 401);
    } catch (error) {
      console.error("[GitHub Routes] Error in refresh-org-status route:", error);
      return c.json({
        code: 500,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });
}; 