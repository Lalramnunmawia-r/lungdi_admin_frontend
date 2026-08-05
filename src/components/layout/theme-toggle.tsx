"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  // Icon shows the destination, not the current state (Sun = "go light").
  // resolvedTheme is undefined until next-themes reads localStorage on the
  // client; falling through to Sun for that first render matches
  // defaultTheme="dark" in the provider, so there's no icon flip on the
  // common path once it resolves.
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-8"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "light" ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </Button>
  );
}
