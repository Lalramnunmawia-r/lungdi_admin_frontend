"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminReportListResponse } from "@/lib/types";

const NAV: { href: string; label: string; badge?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/moderation", label: "Moderation", badge: true },
  { href: "/users", label: "Users" },
  { href: "/plans", label: "Plans" },
  { href: "/interests", label: "Interests" },
  { href: "/broadcast", label: "Broadcast" },
  { href: "/health", label: "Server Health" },
  { href: "/audit-log", label: "Audit Log" },
];

export function Sidebar() {
  const pathname = usePathname();

  // Pending-count badge on Moderation — a single small page fetch (limit
  // enforced server-side at 25), refreshed at the same cadence as react-query's
  // default staleTime rather than its own poll, so it stays cheap.
  const { data } = useQuery({
    queryKey: ["reports", { status: "pending", badge: true }],
    queryFn: () =>
      api.get<AdminReportListResponse>("/admin/reports", { status: "pending" }),
    refetchInterval: 30_000,
  });
  const pendingCount = data?.reports.length ?? 0;

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        {/* Logo mark slot — swap in a real SVG here, ~18x18, left of the wordmark */}
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Lungdi <span className="font-normal text-sidebar-foreground/60">Admin</span>
        </span>
      </div>

      {/* Text-only nav — no per-item icon. A dense operator tool reads a list
          of labels faster than a list of icon+label pairs, and the icon here
          was doing no identity work an unambiguous label doesn't already do. */}
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <span>{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    active ? "text-primary" : "text-status-danger",
                  )}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
