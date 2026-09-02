"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { AdminInterest } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InterestsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"hobby" | "interest">("interest");
  const queryClient = useQueryClient();

  const { data: interests, isLoading } = useQuery({
    queryKey: ["interests"],
    queryFn: () => api.get<AdminInterest[]>("/admin/interests"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/admin/interests", {
        name,
        type,
        category: category || undefined,
      }),
    onSuccess: () => {
      toast.success("Interest added");
      void queryClient.invalidateQueries({ queryKey: ["interests"] });
      setDialogOpen(false);
      setName("");
      setCategory("");
      setType("interest");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to add");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/interests/${id}`),
    onSuccess: () => {
      toast.success("Interest deleted");
      void queryClient.invalidateQueries({ queryKey: ["interests"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    },
  });

  function confirmDelete(interest: AdminInterest) {
    const impact =
      interest.userCount > 0
        ? ` It is currently selected by ${interest.userCount} profile${interest.userCount === 1 ? "" : "s"} — deleting it removes it from all of them.`
        : "";
    if (window.confirm(`Delete "${interest.name}"?${impact}`)) {
      deleteMutation.mutate(interest.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Interests</h1>
          <p className="text-sm text-muted-foreground">The onboarding interest taxonomy</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New interest
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Profiles</TableHead>
              <TableHead className="w-10" />
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
            {!isLoading && interests?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No interests yet.
                </TableCell>
              </TableRow>
            )}
            {interests?.map((interest) => (
              <TableRow key={interest.id}>
                <TableCell className="font-medium">{interest.name}</TableCell>
                <TableCell className="capitalize">{interest.type}</TableCell>
                <TableCell className="text-muted-foreground">
                  {interest.category ?? "—"}
                </TableCell>
                <TableCell className="font-mono tabular-nums">{interest.userCount}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={deleteMutation.isPending}
                    onClick={() => confirmDelete(interest)}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New interest</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="interest-name">Name</Label>
              <Input
                id="interest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interest-type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as "hobby" | "interest")}>
                <SelectTrigger id="interest-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="hobby">Hobby</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interest-category">Category (optional)</Label>
              <Input
                id="interest-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Hobbies"
                maxLength={50}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
