"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AdminUserListResponse } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AccountStatusPill,
  VerificationStatusPill,
} from "@/components/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { UserDrawer } from "@/components/users/user-drawer";

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debouncedSetQ = useDebouncedCallback(setQ, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["users", { q, status, cursor }],
    queryFn: () =>
      api.get<AdminUserListResponse>("/admin/users", {
        q: q || undefined,
        status: status === "all" ? undefined : status,
        cursor,
      }),
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
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and act on accounts</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or phone…"
            className="pl-8"
            onChange={(e) => {
              setCursor(undefined);
              setCursorStack([]);
              debouncedSetQ(e.target.value);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            if (!v) return;
            setStatus(v);
            setCursor(undefined);
            setCursorStack([]);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            )}
            {data?.users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => setSelectedUserId(user.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={user.profilePictureSmallUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(user.name ?? "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name ?? "Unnamed"}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {user.phoneNumber}
                </TableCell>
                <TableCell>
                  <AccountStatusPill status={user.status} />
                </TableCell>
                <TableCell>
                  <VerificationStatusPill status={user.verificationStatus} />
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {formatDate(user.createdAt)}
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

      <UserDrawer userId={selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)} />
    </div>
  );
}
