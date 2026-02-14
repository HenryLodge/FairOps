import { auth0 } from "@/lib/auth0";
import { getProfileByAuth0Sub } from "@/lib/profile";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";

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
              <span className="landing-hero-title-accent">all events</span>
            </h1>
            <p className="landing-hero-desc">
              The ultimate way to organize and operate every event. Built for organizers who need
              clarity, not complexity.
            </p>
            <div className="landing-hero-actions">
              <LoginButton />
              <a href="/auth/login?screen_hint=signup" className="btn btn--secondary">
                Create Account
              </a>
            </div>
          </div>

          <div className="landing-hero-visual">
            <svg
              className="landing-coaster"
              viewBox="0 0 520 600"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Track rail */}
              <path
                d="M20 300 C60 300, 80 280, 100 240 C120 200, 130 120, 160 80 C190 40, 210 30, 240 60 C270 90, 280 160, 310 200 C340 240, 360 260, 400 240 C440 220, 460 180, 500 170"
                stroke="var(--color-text-tertiary)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Inner rail (parallel track) */}
              <path
                d="M20 310 C60 310, 80 290, 100 250 C120 210, 130 130, 160 90 C190 50, 210 40, 240 70 C270 100, 280 170, 310 210 C340 250, 360 270, 400 250 C440 230, 460 190, 500 180"
                stroke="var(--color-text-tertiary)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.5"
              />

              {/* Support pillars */}
              <line x1="100" y1="240" x2="100" y2="400" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />
              <line x1="160" y1="80" x2="160" y2="450" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />
              <line x1="240" y1="60" x2="240" y2="500" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />
              <line x1="310" y1="200" x2="310" y2="420" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />
              <line x1="400" y1="240" x2="400" y2="370" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />
              <line x1="500" y1="170" x2="500" y2="340" stroke="var(--color-text-tertiary)" strokeWidth="3" opacity="0.4" />

              {/* Roller coaster car 1 (going up the hill) — positioned on the climb */}
              <g transform="translate(138, 98) rotate(-55)">
                {/* Car body */}
                <rect x="-14" y="-10" width="28" height="16" rx="5" fill="var(--color-accent)" />
                {/* Windshield */}
                <rect x="-9" y="-8" width="10" height="6" rx="2" fill="var(--color-bg)" opacity="0.3" />
                {/* Wheel */}
                <circle cx="-6" cy="8" r="3" fill="var(--color-bg-elevated)" stroke="var(--color-accent)" strokeWidth="1.5" />
                <circle cx="6" cy="8" r="3" fill="var(--color-bg-elevated)" stroke="var(--color-accent)" strokeWidth="1.5" />
                {/* Headrest glow */}
                <rect x="4" y="-9" width="7" height="5" rx="2" fill="var(--color-accent)" opacity="0.7" />
              </g>

              {/* Roller coaster car 2 (near the top) */}
              <g transform="translate(154, 75) rotate(-52)">
                <rect x="-14" y="-10" width="28" height="16" rx="5" fill="var(--color-accent)" />
                <rect x="-9" y="-8" width="10" height="6" rx="2" fill="var(--color-bg)" opacity="0.3" />
                <circle cx="-6" cy="8" r="3" fill="var(--color-bg-elevated)" stroke="var(--color-accent)" strokeWidth="1.5" />
                <circle cx="6" cy="8" r="3" fill="var(--color-bg-elevated)" stroke="var(--color-accent)" strokeWidth="1.5" />
                <rect x="4" y="-9" width="7" height="5" rx="2" fill="var(--color-accent)" opacity="0.7" />
              </g>

              {/* Accent glow behind cars */}
              <circle cx="145" cy="85" r="40" fill="var(--color-accent)" opacity="0.06" />

              {/* Speed lines near the descent */}
              <line x1="270" y1="85" x2="290" y2="80" stroke="var(--color-accent)" strokeWidth="1" opacity="0.3" />
              <line x1="265" y1="95" x2="285" y2="92" stroke="var(--color-accent)" strokeWidth="1" opacity="0.2" />
              <line x1="268" y1="105" x2="282" y2="103" stroke="var(--color-accent)" strokeWidth="1" opacity="0.15" />
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}
