"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navLinks = [
  { label: "Players", href: "/players" },
  { label: "Roster", href: "/roster" },
  { label: "Draft", href: "/draft" },
  { label: "Transactions", href: "/transactions" },
];

type StoredUser = {
  id: string;
  username: string;
  email: string;
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);

    const storedUser = localStorage.getItem("draftkit_user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        setUser(null);
      }
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("draftkit_token");
    localStorage.removeItem("draftkit_user");
    setUser(null);
    router.push("/login");
  }

  const isAuthPage =
    pathname === "/login" || pathname === "/create-account";

  if (isAuthPage) return null;

  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg text-primary tracking-tight"
        >
          TealCore{" "}
          <span className="text-foreground font-normal">Draft Kit</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}

          {isHydrated && user ? (
            <Link
              href="/league-settings"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === "/league-settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              League Settings
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {!isHydrated ? null : user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.username}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/create-account">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <Separator />
    </header>
  );
}