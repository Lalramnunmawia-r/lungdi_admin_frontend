"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
type PasswordForm = z.infer<typeof passwordSchema>;

type Step =
  | { name: "password" }
  | { name: "mfa"; mfaToken: string }
  | { name: "enroll"; mfaToken: string; otpauthUrl: string; secret: string };

export default function LoginPage() {
  const { login, verifyMfa, enrollTotp, confirmTotp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onPasswordSubmit(values: PasswordForm) {
    setSubmitting(true);
    try {
      const { mfaToken, totpEnrolled } = await login(values.email, values.password);
      if (totpEnrolled) {
        setStep({ name: "mfa", mfaToken });
      } else {
        const { otpauthUrl, secret } = await enrollTotp(mfaToken);
        setStep({ name: "enroll", mfaToken, otpauthUrl, secret });
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.name === "password") return;
    setSubmitting(true);
    try {
      if (step.name === "mfa") {
        await verifyMfa(step.mfaToken, code);
      } else {
        await confirmTotp(step.mfaToken, code);
      }
      router.push("/");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Verification failed");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          {/* Logo mark slot — swap in a real SVG here, ~20x20, left of the wordmark */}
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Lungdi <span className="font-normal text-muted-foreground">Admin</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step.name === "password" && "Sign in to continue"}
            {step.name === "mfa" && "Enter your 6-digit authenticator code"}
            {step.name === "enroll" && "Set up two-factor authentication"}
          </p>
        </div>

        {step.name === "password" && (
          <form
            onSubmit={form.handleSubmit(onPasswordSubmit)}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </form>
        )}

        {step.name === "mfa" && (
          <form
            onSubmit={onCodeSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="code">Authenticator code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-lg tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || code.length !== 6}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Verify
            </Button>
          </form>
        )}

        {step.name === "enroll" && (
          <form
            onSubmit={onCodeSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">
              This account has no authenticator app set up yet. Add this
              account to an authenticator app (1Password, Authy, Google
              Authenticator, …) using the URI below, then enter the code it
              generates.
            </p>
            <div className="space-y-1.5">
              <Label>Setup URI</Label>
              <div className="rounded-md border border-border bg-muted p-2 text-xs break-all text-muted-foreground">
                {step.otpauthUrl}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Manual entry secret</Label>
              <div className="rounded-md border border-border bg-muted p-2 font-mono text-xs text-muted-foreground">
                {step.secret}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enroll-code">Confirmation code</Label>
              <Input
                id="enroll-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-lg tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || code.length !== 6}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Confirm & sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
