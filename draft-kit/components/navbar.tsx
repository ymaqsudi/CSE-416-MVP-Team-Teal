"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navLinks = [
  { label: "Players", href: "/players" },
  { label: "Roster", href: "/roster" },
  { label: "Draft", href: "/draft" },
];

export function Navbar() {
  const pathname = usePathname();

  const isAuthPage = pathname === "/login" || pathname === "/create-account";
  if (isAuthPage) return null;

  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left — logo */}
        <Link
          href="/"
          className="font-bold text-lg text-primary tracking-tight"
        >
          TealCore{" "}
          <span className="text-foreground font-normal">Draft Kit</span>
        </Link>

        {/* Center — nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right — user actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/create-account">Sign up</Link>
          </Button>
        </div>
      </div>
      <Separator />
    </header>
  );
}
