import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import * as dbService from "../services/db";
import * as aadService from "../services/aad";

type AppType = Hono<{ Bindings: Bindings; Variables: Variables }>;

export const userRoutes = (app: AppType) => {
  app.get("/api/user", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ code: 401, message: "Unauthorized" }, 401);
    }

    const userData = await dbService.getUserWithAAD(c.env.DB, user.id);

    if (!userData) {
      return c.json({ code: 404, message: "User not found" }, 404);
    }

    let responseData = { ...userData };

    if (userData.aad_id) {
      try {
        const aadUserInfo = await aadService.getAADUserInfoById(userData.aad_id, c.env.AAD_TENANT_ID, c.env.AAD_CLIENT_ID, c.env.AAD_CLIENT_SECRET);
        console.log(aadUserInfo);
        responseData.aad_display_name = aadUserInfo.displayName;
      } catch (error) {
        console.error('Failed to fetch AAD user info:', error);
      }
    }

    return c.json({
      code: 0,
      data: responseData,
    });
  });
}; 