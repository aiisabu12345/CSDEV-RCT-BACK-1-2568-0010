import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from 'jose';
import { HTTPException } from "hono/http-exception";
import {} from "hono";
import { config } from 'dotenv';
config();
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
export async function generateNewJWTAndSetCookie(c, userId) {
    const [accessToken, refreshToken] = await Promise.all([
        new SignJWT({ userId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("30m")
            .sign(new TextEncoder().encode(JWT_ACCESS_SECRET)),
        new SignJWT({ userId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("30d")
            .sign(new TextEncoder().encode(JWT_REFRESH_SECRET)),
    ]);
    setCookie(c, "accessToken", accessToken);
    setCookie(c, "refreshToken", refreshToken);
}
export const mustAuth = createMiddleware(async (c, next) => {
    const accessToken = getCookie(c, "accessToken");
    if (!accessToken) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }
    const refreshToken = getCookie(c, "refreshToken");
    if (!refreshToken) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }
    try {
        const { payload: { userId }, } = await jwtVerify(accessToken, new TextEncoder().encode(JWT_ACCESS_SECRET));
        c.set("userId", userId);
        await next();
    }
    catch (error) {
        try {
            const { payload: { userId }, } = await jwtVerify(refreshToken, new TextEncoder().encode(JWT_REFRESH_SECRET));
            generateNewJWTAndSetCookie(c, userId);
            c.set("userId", userId);
            await next();
        }
        catch (error) {
            deleteCookie(c, "accessToken", { httpOnly: true, sameSite: 'Lax' });
            deleteCookie(c, "refreshToken", { httpOnly: true, sameSite: 'Lax' });
            throw new HTTPException(401, { message: "Unauthorized" });
        }
    }
});
