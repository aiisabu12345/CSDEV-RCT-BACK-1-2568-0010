import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";
import authRouter from "./router/authRouter.js";
import bucketRouter from "./router/bucketRouter.js";
import userRouter from "./router/userRouter.js";
import { openAPIRouteHandler } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
const app = new Hono();
app.route('/api/auth', authRouter);
app.route('/api/', bucketRouter);
app.route('/api/user', userRouter);
app.get('/openapi', openAPIRouteHandler(app, {
    documentation: {
        info: {
            title: 'Hono API',
            version: '1.0.0',
            description: 'Greeting API',
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Local Server' },
        ],
    },
}));
app.get('/docs', Scalar({ url: '/openapi' }));
showRoutes(app);
app.onError((err, c) => {
    console.error(err);
    if (err instanceof HTTPException) {
        return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: "Internal server error" }, 500);
});
serve({
    fetch: app.fetch,
    port: 3000,
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
