"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminAuditLogListResponse } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default function AuditLogPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", { cursor }],
    queryFn: () =>
      api.get<AdminAuditLogListResponse>("/admin/audit-log", { cursor }),
  });

  function goNext() {
    if (!data?.nextCursor) return;
    setCursorStack((s) => [...s, cursor]);
    setCursor(data.nextCursor);
  }

  function goPrev() {
    const prev = cursorStack[cursorStack.length - 1];
    setCursorStack((s) => s.slice(0, -1));
    setCursor(prev);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action, attributed and timestamped
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No admin actions recorded yet.
                </TableCell>
              </TableRow>
            )}
            {data?.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{entry.adminName}</div>
                  <div className="text-xs text-muted-foreground">{entry.adminEmail}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.targetType}
                  {entry.targetId && (
                    <span className="block truncate" title={entry.targetId}>
                      {entry.targetId}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                  title={JSON.stringify(entry.metadata, null, 2)}
                >
                  {JSON.stringify(entry.metadata)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.ip ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={cursorStack.length === 0}
          onClick={goPrev}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.nextCursor}
          onClick={goNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
