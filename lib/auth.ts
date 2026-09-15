import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: `openid email profile ${GMAIL_SEND_SCOPE}`,
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      const dbUser = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, image: user.image },
        create: { email: user.email, name: user.name, image: user.image },
      });

      // Google only returns a refresh_token on the first consent grant (or
      // when prompt=consent forces re-consent). Persist it, encrypted, so
      // Gmail sending doesn't depend on Auth.js's in-memory token handling.
      if (account?.provider === "google" && account.refresh_token) {
        const encrypted = encryptSecret(account.refresh_token);
        await prisma.gmailAccount.upsert({
          where: { userId: dbUser.id },
          update: {
            email: user.email,
            refreshTokenEncrypted: encrypted.ciphertext,
            refreshTokenIv: encrypted.iv,
            refreshTokenAuthTag: encrypted.authTag,
            scopes: typeof account.scope === "string" ? account.scope.split(" ") : [],
          },
          create: {
            userId: dbUser.id,
            email: user.email,
            refreshTokenEncrypted: encrypted.ciphertext,
            refreshTokenIv: encrypted.iv,
            refreshTokenAuthTag: encrypted.authTag,
            scopes: typeof account.scope === "string" ? account.scope.split(" ") : [],
          },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
