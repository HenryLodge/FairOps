import { auth0 } from "@/lib/auth0";
import { getProfileByAuth0Sub } from "@/lib/profile";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";

const CLAIMS_NAMESPACE = "https://localhost:3000";

export default async function Home() {
  const session = await auth0.getSession();
  const user = session?.user;

  // If authenticated, redirect to appropriate dashboard
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

  // Landing page
  return (
    <div className="landing">
      {/* Background elements */}
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-glow" aria-hidden="true" />

      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <span className="landing-logo-mark" aria-hidden="true" />
          FairOps
        </div>
        <nav className="landing-nav">
          <LoginButton />
        </nav>
      </header>

      {/* Main content */}
      <main className="landing-main">
        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-hero-content">
            <h1 className="landing-hero-title">
              The operations platform for{" "}
              <span className="landing-hero-title-accent">all carnivals and events</span>
            </h1>
            <p className="landing-hero-desc">
              FairOps is the modern way to manage vendor applications, booth
              assignments, and event logistics. Built for organizers who need
              clarity, not complexity.
            </p>
            <div className="landing-hero-actions">
              <LoginButton />
              <a href="#features" className="btn btn--secondary">
                Create Account
              </a>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-hero-graphic">
              <div className="landing-graphic-ring landing-graphic-ring--1" />
              <div className="landing-graphic-ring landing-graphic-ring--2" />
              <div className="landing-graphic-ring landing-graphic-ring--3" />
              <div className="landing-graphic-center">
                <svg
                  className="landing-graphic-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="landing-graphic-dot landing-graphic-dot--1" />
              <div className="landing-graphic-dot landing-graphic-dot--2" />
              <div className="landing-graphic-dot landing-graphic-dot--3" />
              <div className="landing-graphic-line landing-graphic-line--1" />
              <div className="landing-graphic-line landing-graphic-line--2" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
