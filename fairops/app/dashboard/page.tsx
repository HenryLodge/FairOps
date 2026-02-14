import { requireRole } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const { user, roles } = await requireRole("organizer");

  return (
    <>
      <div className="app-container">
        <div className="main-card-wrapper">
          <h1 className="main-title">Organizer Dashboard</h1>
          <div className="action-card">
            <div className="logged-in-section">
              <img
                src={user.picture || ""}
                alt={user.name || "User"}
                className="profile-picture"
              />
              <h2 className="profile-name">{user.name}</h2>
              <p className="profile-email">{user.email}</p>
              <p className="action-text">
                Role: <strong>{roles.join(", ")}</strong>
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
      <DashboardContent />
    </>
  );
}
