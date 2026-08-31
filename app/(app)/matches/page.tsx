import Link from "next/link";
import { getMatches } from "@/lib/data";
import { MatchCard } from "@/components/match-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Swords } from "lucide-react";

export const metadata = { title: "Matches — RedSec Ranked" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ranked", label: "Ranked" },
  { key: "quads", label: "Quads" },
  { key: "duos", label: "Duos" },
  { key: "gauntlet", label: "Gauntlet" },
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;

  const matches = await getMatches(
    filter === "ranked"
      ? { rankedOnly: true }
      : filter !== "all"
        ? { mode: filter }
        : {},
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <Link href="/matches/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Log a match
          </Button>
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/matches" : `/matches?filter=${f.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted hover:bg-card-hover",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {matches.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Swords className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No matches logged yet</p>
          <p className="max-w-xs text-xs text-muted">
            Drop into Fort Lyndon, then log your first round from the end-of-round screen.
          </p>
          <Link href="/matches/new">
            <Button size="sm" className="mt-1">
              <Plus className="h-4 w-4" /> Log your first match
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
