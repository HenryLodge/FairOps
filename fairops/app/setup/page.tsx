import { auth0 } from '@/lib/auth0';
import { getProfileByAuth0Sub } from '@/lib/profile';
import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/setup/SetupForm';

const CLAIMS_NAMESPACE = 'https://localhost:3000';

export default async function SetupPage() {
  const session = await auth0.getSession();
  if (!session?.user) {
    redirect('/auth/login');
  }

  const user = session.user;
  const jwtRoles: string[] =
    (user[`${CLAIMS_NAMESPACE}/roles`] as string[] | undefined) ??
    (user['localhost:3000/roles'] as string[] | undefined) ??
    [];

  if (jwtRoles.includes('organizer')) redirect('/dashboard');
  if (jwtRoles.includes('vendor')) redirect('/vendor');

  const profile = await getProfileByAuth0Sub(user.sub);
  if (profile?.role === 'organizer') redirect('/dashboard');
  if (profile?.role === 'vendor') redirect('/vendor');

  return (
    <div className="app-container">
      <div className="main-card-wrapper">
        <h1 className="main-title">Account setup</h1>
        <p className="action-text" style={{ marginTop: 0 }}>
          Choose your role and add a few details to get started.
        </p>
        <SetupForm />
      </div>
    </div>
  );
}
