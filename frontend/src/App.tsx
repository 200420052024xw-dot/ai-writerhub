import { useEffect, useState } from "react";
import { AppShell } from "./layouts/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { checkHealth, getCurrentUser, logoutUser, type AuthUser } from "./services/api";
import { setActiveStorageUser } from "./services/userStorage";

type HealthState = "checking" | "online" | "offline";

export function App() {
  const [healthState, setHealthState] = useState<HealthState>("checking");
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "anonymous">("checking");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setHealthState("online"))
      .catch(() => setHealthState("offline"));
    getCurrentUser()
      .then((currentUser) => {
        setActiveStorageUser(currentUser.id);
        setUser(currentUser);
        setAuthState("authenticated");
      })
      .catch(() => {
        setActiveStorageUser(null);
        setAuthState("anonymous");
      });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setActiveStorageUser(null);
      setAuthState("anonymous");
    };
    window.addEventListener("writerhub:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("writerhub:unauthorized", handleUnauthorized);
  }, []);

  if (authState === "checking") return <div className="auth-checking-bar" />;
  if (!user || authState === "anonymous") {
    return <AuthPage onAuthenticated={(nextUser) => {
      setActiveStorageUser(nextUser.id);
      setUser(nextUser);
      setAuthState("authenticated");
    }} />;
  }

  return (
    <AppShell
      healthState={healthState}
      onLogout={async () => {
        try {
          await logoutUser();
        } finally {
          setUser(null);
          setActiveStorageUser(null);
          setAuthState("anonymous");
        }
      }}
      onUserChange={setUser}
      user={user}
    />
  );
}
