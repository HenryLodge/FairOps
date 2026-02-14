import { requireRole } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import Image from "next/image";

export default async function DashboardPage() {
  const { user, roles } = await requireRole("organizer");

  return (
    <>
      <div className="app-container">
        <div className="main-card-wrapper">
          <h1 className="main-title">Organizer Dashboard</h1>
          <div className="action-card">
            <div className="logged-in-section">
              <Image
                src={user.picture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Ccircle cx='48' cy='48' r='48' fill='%2363b3ed'/%3E%3C/svg%3E"}
                alt={user.name || "User"}
                className="profile-picture"
                width={96}
                height={96}
                unoptimized
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
