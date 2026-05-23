import { useEffect, useState } from "react";
import { AppShell } from "./layouts/AppShell";
import { checkHealth } from "./services/api";

type HealthState = "checking" | "online" | "offline";

export function App() {
  const [healthState, setHealthState] = useState<HealthState>("checking");

  useEffect(() => {
    checkHealth()
      .then(() => setHealthState("online"))
      .catch(() => setHealthState("offline"));
  }, []);

  return <AppShell healthState={healthState} />;
}
