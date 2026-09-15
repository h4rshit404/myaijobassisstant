"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginCard() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sign in to myjobassistant</CardTitle>
        <CardDescription>
          We use your Google account both to sign you in and to authorize sending outreach
          emails from your Gmail. You&apos;ll be asked to grant Gmail send permission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}
