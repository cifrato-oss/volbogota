import { env } from "@/server/config/env";

export type HealthStatus = {
  status: "ok";
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
};

/**
 * Liveness snapshot for load balancers, uptime monitors and deploy smoke tests.
 * Keep it dependency-free: it must answer even when downstream services are down.
 */
export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
