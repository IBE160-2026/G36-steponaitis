"use client";

import { useQuery } from "@tanstack/react-query";

type Health = { status: string };

async function fetchHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }
  return (await response.json()) as Health;
}

export default function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });

  let status = "Checking backend…";
  if (health.isSuccess) {
    status = `Backend: ${health.data.status}`;
  } else if (health.isError) {
    status = "Backend: unreachable";
  }

  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <h1 className="type-page-title">Smart Warehouse Planner</h1>
      <p role="status" aria-live="polite" className="type-body text-ink-secondary">
        {status}
      </p>
    </div>
  );
}
