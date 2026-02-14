import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";

const CLAIMS_NAMESPACE = "localhost:3000";

export default async function Home() {
  const session = await auth0.getSession();
  const user = session?.user;

  // If authenticated, read roles and redirect to the appropriate dashboard
  if (user) {
    const roles: string[] =
      (user[`${CLAIMS_NAMESPACE}/roles`] as string[] | undefined) ?? [];

    if (roles.includes("organizer")) {
      redirect("/dashboard");
    }

    if (roles.includes("vendor")) {
      redirect("/vendor");
    }

    // Authenticated but no recognized role — redirect to dashboard as default
    redirect("/dashboard");
  }

  // Not authenticated — show login page
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Lot Boss
        </h1>
        <LoginButton />
      </main>
    </div>
  );
}
