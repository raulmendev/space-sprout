import { defineRailway, project, service } from "railway/iac";

// The game's API on Railway: built from api/Dockerfile at the repo root (it compiles ../shared in),
// next to the Neon database (aws us-west-2). Variables (DATABASE_URL, CORS_ORIGINS) are set in
// Railway, not here: see api/.env.example.
// This repository manages only its own resources in the environment.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "api";

export default defineRailway(() => {
  const api = service("api", {
    // Deploys from GitHub: every merge to main that touches the watch patterns below.
    source: { type: "github", repo: "raulmendev/space-sprout", branch: "main" },
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "api/Dockerfile", watchPatterns: ["api/**", "shared/**", ".railway/**"] },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    replicas: { "us-west2": 1 },
  });

  return project("astro-garden", {
    variables: { managed: false },
    resources: [api],
  });
});
