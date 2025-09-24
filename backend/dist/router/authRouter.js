import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import argon2 from "@node-rs/argon2";
import { HTTPException } from "hono/http-exception";
import { generateNewJWTAndSetCookie } from "../middleware/mustAuth.js";
import * as v from 'valibot';
import { describeRoute, resolver, validator } from 'hono-openapi';
const prisma = new PrismaClient();
const authRouter = new Hono();
const AuthSchema = v.object({
    userName: v.pipe(v.string(), v.minLength(3, 'username must be 3 or more characters long.')),
    password: v.pipe(v.string(), v.minLength(6, 'password must be 6 or more characters long.'))
});
const inputAuth = validator('json', AuthSchema);
authRouter.post('/sign-up', describeRoute({
    description: 'sign up',
    responses: {
        200: {
            description: 'signed up',
            content: {
                'application/json': { schema: resolver(v.object({ message: v.string() })) },
            },
        },
        400: {
            description: 'Duplicate username',
            content: {
                'application/json': { schema: resolver(v.object({ message: v.string() })) },
            },
        }
    },
}), inputAuth, async (c) => {
    const data = await c.req.valid('json');
    const exists = await prisma.user.findUnique({ where: { userName: data.userName } });
    if (exists)
        throw new HTTPException(400, { message: 'Username already exists' });
    const hashed = await argon2.hash(data.password);
    await prisma.user.create({ data: { userName: data.userName, password: hashed } });
    return c.json({ message: 'Signed up successfully' });
});
authRouter.post('/login', describeRoute({
    description: 'login',
    responses: {
        200: {
            description: 'logged in',
            content: {
                'application/json': { schema: resolver(v.object({ message: v.string() })) },
            },
        },
        401: {
            description: 'Invalid credentials',
            content: {
                'application/json': { schema: resolver(v.object({ message: v.string() })) },
            },
        },
    },
}), inputAuth, async (c) => {
    const data = await c.req.valid('json');
    const user = await prisma.user.findUnique({ where: { userName: data.userName } });
    if (!user || !(await argon2.verify(user.password, data.password))) {
        throw new HTTPException(401, { message: 'Invalid credentials' });
    }
    generateNewJWTAndSetCookie(c, user.id);
    return c.json({ message: 'Logged in successfully' });
});
export default authRouter;
