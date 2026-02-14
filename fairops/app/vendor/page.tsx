import { requireRole } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function VendorPage() {
  const { user, roles } = await requireRole("vendor");

  return (
    <div className="app-container">
      <div className="main-card-wrapper">
        <h1 className="main-title">Vendor Portal</h1>

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

        <div className="action-card">
          <p className="action-text">
            This is your vendor portal. Booth management and event sign-up
            features will appear here.
          </p>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
