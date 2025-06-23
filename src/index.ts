import { Hono } from "hono";
import { Bindings, Variables } from "./types";
import { authMiddleware } from "./middlewares/auth";
import { githubRoutes } from "./routes/github";
import { aadRoutes } from "./routes/aad";
import { userRoutes } from "./routes/user";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get("/api/health", (c) => {
  return c.json({
    code: 0,
    message: "ok",
  });
});

app.use("/api/user/*", authMiddleware);

githubRoutes(app);
aadRoutes(app);
userRoutes(app);

export default app;
