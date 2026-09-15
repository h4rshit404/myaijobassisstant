import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginCard } from "./login-card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4">
      <LoginCard />
    </div>
  );
}
