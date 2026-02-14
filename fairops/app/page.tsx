import { auth0 } from "@/lib/auth0";
import { getProfileByAuth0Sub } from "@/lib/profile";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";

const CLAIMS_NAMESPACE = "https://localhost:3000";

export default async function Home() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (user) {
    const jwtRoles: string[] =
      (user[`${CLAIMS_NAMESPACE}/roles`] as string[] | undefined) ??
      (user["localhost:3000/roles"] as string[] | undefined) ??
      [];

    if (jwtRoles.includes("organizer")) redirect("/dashboard");
    if (jwtRoles.includes("vendor")) redirect("/vendor");

    const profile = await getProfileByAuth0Sub(user.sub);
    if (profile?.role === "organizer") redirect("/dashboard");
    if (profile?.role === "vendor") redirect("/vendor");

    redirect("/setup");
  }

  // Not authenticated — show login page
  return (
    <div className="app-container">
      <div className="main-card-wrapper">
        <img
          src="https://cdn.auth0.com/quantum-assets/dist/latest/logos/auth0/auth0-lockup-en-ondark.png"
          alt="Auth0 Logo"
          className="auth0-logo"
        />
        <h1 className="main-title">FairOps</h1>

        <div className="action-card">
          <p className="action-text">
            Welcome! Please log in to access your dashboard.
          </p>
          <LoginButton />
        </div>
      </div>
    </div>
  );
}
