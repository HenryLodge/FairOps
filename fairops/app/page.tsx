import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";

const CLAIMS_NAMESPACE = "https://localhost:3000";

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

    // Authenticated but no recognized role — show message (do not redirect to /dashboard or we get a redirect loop)
    return (
      <div className="app-container">
        <div className="main-card-wrapper">
          <h1 className="main-title">FairOps</h1>
          <div className="action-card">
            <p className="action-text">
              You don&apos;t have an assigned role yet. Contact the organizer to get access as a vendor or organizer.
            </p>
            <LogoutButton />
          </div>
        </div>
      </div>
    );
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
