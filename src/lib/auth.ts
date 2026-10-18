/**
 * NextAuth v5 configuration
 * Single-operator app: email + password login only.
 * No public registration. Session expires after 8 hours of inactivity.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { config } from "@/db/schema";
import { eq } from "drizzle-orm";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.error("[auth] Invalid credentials input shape:", parsed.error);
          return null;
        }

        const email = parsed.data.email.trim();
        const password = parsed.data.password.trim();

        const adminEmail = process.env.ADMIN_EMAIL?.trim() || "kirattejay21@gmail.com";
        let adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();

        // If environment variable was not loaded or corrupted by $, fetch from DB config table
        if (!adminHash || !adminHash.startsWith("$2")) {
          try {
            const dbHash = await db.query.config.findFirst({
              where: eq(config.key, "admin_password_hash"),
            });
            if (dbHash?.value) {
              adminHash = dbHash.value.trim();
            }
          } catch (e) {
            console.error("[auth] Failed to query db for password hash:", e);
          }
        }

        if (!adminHash) {
          console.error("[auth] No admin password hash found in env or database.");
          return null;
        }

        if (email.toLowerCase() !== adminEmail.toLowerCase()) {
          console.warn(`[auth] Email mismatch: received '${email}', expected '${adminEmail}'`);
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, adminHash);
        if (!passwordMatch) {
          console.warn("[auth] Password does not match hash.");
          return null;
        }

        console.log(`[auth] Successfully authenticated ${adminEmail}`);
        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,   // 8 hours
    updateAge: 60 * 60,    // refresh token every 1 hour
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
