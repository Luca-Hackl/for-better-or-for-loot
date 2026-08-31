"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Crosshair,
  LayoutDashboard,
  Swords,
  MapPin,
  Users,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/locations", label: "Drop Zones", icon: MapPin },
  { href: "/head-to-head", label: "Head-to-Head", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  email,
  playerName,
  children,
}: {
  email: string | null;
  playerName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(href)
              ? "bg-primary/15 text-primary"
              : "text-muted hover:bg-card-hover hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 p-4 md:flex">
        <Brand />
        <div className="mt-6">{nav}</div>
        <Link href="/matches/new" className="mt-6">
          <Button className="w-full">
            <Plus className="h-4 w-4" /> Log a match
          </Button>
        </Link>
        <div className="mt-auto pt-6">
          <p className="px-3 text-[11px] italic text-muted-foreground">
            27 years. Still dropping together.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {playerName ?? "Unlinked"}
              </p>
              <p className="truncate text-[11px] text-muted">{email}</p>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="icon" type="submit" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-3 md:hidden">
          <Brand compact />
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>
        {open ? (
          <div className="border-b border-border bg-surface p-4 md:hidden">
            {nav}
            <Link href="/matches/new" onClick={() => setOpen(false)} className="mt-4 block">
              <Button className="w-full">
                <Plus className="h-4 w-4" /> Log a match
              </Button>
            </Link>
            <form action={signOut} className="mt-2">
              <Button variant="outline" type="submit" className="w-full">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </form>
          </div>
        ) : null}

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Crosshair className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">RedSec Ranked</p>
          <p className="text-[11px] text-muted">Squad HQ</p>
        </div>
      )}
    </div>
  );
}
