import { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { Bindings, Variables } from "../types";
import { getUserWithAAD } from "../services/db";

export const authMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  let token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) {
    token = getCookie(c, 'token');
  }

  if (!token && !c.req.path.startsWith("/api/user/login")) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }
  if (token) {
    try {
      const decoded = await verify(token, c.env.JWT_SECRET);
      const user = await getUserWithAAD(c.env.DB, decoded.id as string);
      if (!user) {
        return c.json({ code: 401, message: "User not found" }, 401);
      }
      c.set("user", user);
    } catch (e) {
      return c.json({ code: 401, message: "Invalid token" }, 401);
    }
  }
  await next();
}; 