import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Bindings, Variables, AADTokenResponse, AADUserInfo } from "../types";
import * as aadService from "../services/aad";
import * as dbService from "../services/db";

type AppType = Hono<{ Bindings: Bindings; Variables: Variables }>;

export const aadRoutes = (app: AppType) => {

  app.get("/api/user/login/aad", async (c) => {
    const user = c.get("user");
    if (!user || user.status !== "unlinked") {
      return c.json({
        code: 400,
        message: "You must first login with GitHub and be verified as an organization member"
      }, 400);
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    setCookie(c, "aad_oauth_state", state, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    });

    setCookie(c, "aad_oauth_nonce", nonce, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    });

    setCookie(c, "github_user_id", user.id, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    });

    const config = await aadService.getAADConfig(c.env.AAD_TENANT_ID);

    const params = new URLSearchParams({
      client_id: c.env.AAD_CLIENT_ID,
      response_type: "code",
      response_mode: "query",
      redirect_uri: `${new URL(c.req.url).origin}/aad/callback`,
      scope: "openid profile User.Read",
      state,
      nonce,
    });

    return c.redirect(`${config.authorization_endpoint}?${params.toString()}`);
  });

  app.get("/api/user/login/aad/callback", async (c) => {
    const { code, state, error, error_description } = c.req.query();
    const savedState = getCookie(c, "aad_oauth_state");
    const nonce = getCookie(c, "aad_oauth_nonce");
    const githubUserId = getCookie(c, "github_user_id");

    // Clear cookies
    setCookie(c, "aad_oauth_state", "", { maxAge: 0 });
    setCookie(c, "aad_oauth_nonce", "", { maxAge: 0 });
    setCookie(c, "github_user_id", "", { maxAge: 0 });

    if (error) {
      return c.json({
        code: 400,
        message: "AAD authentication failed",
        error: error_description
      }, 400);
    }

    if (!state || !savedState || state !== savedState || !nonce || !githubUserId) {
      return c.json({ code: 400, message: "Invalid state or missing data" }, 400);
    }

    const config = await aadService.getAADConfig(c.env.AAD_TENANT_ID);

    const tokenData = await aadService.getAADUserToken(
      code as string,
      `${new URL(c.req.url).origin}/aad/callback`,
      c.env.AAD_CLIENT_ID,
      c.env.AAD_CLIENT_SECRET,
      config
    ) as AADTokenResponse;

    if (!tokenData.access_token) {
      return c.json({ code: 400, message: "Failed to get access token" }, 400);
    }

    const aadUserData = await aadService.getAADUserInfo(tokenData.access_token) as AADUserInfo;

    await dbService.createAADUser(
      c.env.DB,
      githubUserId,
      aadUserData.id
    );

    await dbService.updateUserStatus(c.env.DB, githubUserId, 'active');

    const userData = await dbService.getUserWithAAD(c.env.DB, githubUserId);

    if (!userData) {
      return c.json({ code: 404, message: "User not found" }, 404);
    }

    return c.json({
      code: 0,
      data: {
        user: {
          id: githubUserId,
          name: userData.name,
          status: 'active',
          aad_id: userData.aad_id,
        },
      },
    });
  });

  app.post("/api/user/login/aad/register", async (c) => {
    const user = c.get("user");
    if (!user || user.status !== "unlinked") {
      return c.json({
        code: 400,
        message: "You must first login with GitHub and be verified as an organization member and can't be active"
      }, 400);
    }

    const body = await c.req.json();
    const { username, displayName } = body;

    if (!username || !displayName) {
      return c.json({
        code: 400,
        message: "Username or display name is required",
      }, 400);
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return c.json({
        code: 400,
        message: "Username can only contain letters and numbers",
      }, 400);
    }

    try {
      const email = `${username}@${c.env.AAD_MAIL_DOMAIN}`;

      // 创建 AAD 用户
      const { userId, password } = await aadService.createAADUser(
        c.env.AAD_TENANT_ID,
        c.env.AAD_CLIENT_ID,
        c.env.AAD_CLIENT_SECRET,
        username,
        displayName,
        email,
        c.env.AAD_LICENSE_SKU_ID
      );

      // 更新数据库中的用户信息
      await dbService.createAADUser(
        c.env.DB,
        user.id,
        userId
      );

      await dbService.updateUserStatus(c.env.DB, user.id, 'active');

      const userData = await dbService.getUserWithAAD(c.env.DB, user.id);

      if (!userData) {
        return c.json({ code: 404, message: "User not found" }, 404);
      }

      return c.json({
        code: 0,
        data: {
          user: {
            id: userData.id,
            name: userData.name,
            status: 'active',
            aad_id: userData.aad_id,
          },
          aad: {
            email,
            password,
          },
        },
      });
    } catch (error) {
      console.error("Failed to create AAD user:", error);
      return c.json({
        code: 500,
        message: "Failed to create AAD user",
      }, 500);
    }
  });
}; 