import { Hono } from "hono";
import { mustAuth } from "../middleware/mustAuth.js";
import { PrismaClient } from "@prisma/client";
import { describeRoute, resolver, validator } from 'hono-openapi';
import * as v from 'valibot';
const responseSchema = v.array(v.object({
    id: v.number(),
    imageName: v.string(),
    size: v.number(),
    createAt: v.string(),
    userId: v.number()
}));
const userRouter = new Hono();
const prisma = new PrismaClient();
userRouter.get('/@me', describeRoute({
    description: 'Fetch all metadata of files uploaded by the authenticated user.',
    responses: {
        200: {
            description: 'List of file metadata retrieved successfully',
            content: {
                'application/json': { schema: resolver(responseSchema) },
            },
        },
    },
}), mustAuth, async (c) => {
    const userId = c.get('userId');
    const allFile = await prisma.image.findMany({ where: { userId: userId } });
    return c.json({ data: allFile });
});
export default userRouter;
