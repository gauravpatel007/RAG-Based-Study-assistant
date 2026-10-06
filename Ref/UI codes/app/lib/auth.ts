import { SignJWT, jwtVerify } from "jose";

// Safe fallback for development environments
const secretKey = process.env.JWT_SECRET || "odoo-pos-cafe-super-secret-key!2026";
const encodedKey = new TextEncoder().encode(secretKey);

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

/**
 * Creates a JWT token for a user payload.
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Token valid for 7 days
    .sign(encodedKey);
}

/**
 * Verifies a JWT token and returns the decoded payload.
 * Throws an error if invalid.
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
