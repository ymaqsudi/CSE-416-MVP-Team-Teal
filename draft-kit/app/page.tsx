import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, DollarSign, Trophy, ChevronRight } from "lucide-react";

const mockLeague = {
  name: "McKenna Fantasy Baseball 2026",
  teams: 12,
  budget: 260,
  remainingBudget: 191,
  rosterSlots: 23,
  filledSlots: 4,
  draftStatus: "In Progress" as const,
};

const quickLinks = [
  {
    label: "All Players",
    href: "/players",
    description: "Browse and search available players",
  },
  {
    label: "My Roster",
    href: "/roster",
    description: "View your current roster and budget",
  },
  { label: "Live Draft", href: "/draft", description: "Enter the draft room" },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {mockLeague.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mockLeague.draftStatus} · {mockLeague.teams} teams · $
          {mockLeague.budget} budget
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining Budget</p>
              <p className="text-2xl font-bold text-primary">
                ${mockLeague.remainingBudget}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Roster Slots</p>
              <p className="text-2xl font-bold text-foreground">
                {mockLeague.filledSlots}
                <span className="text-muted-foreground text-lg font-normal">
                  /{mockLeague.rosterSlots}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Draft Status</p>
              <p className="text-2xl font-bold text-foreground">
                {mockLeague.draftStatus}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* League Settings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          League Settings
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Teams</p>
                <p className="font-semibold mt-0.5">{mockLeague.teams}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Starting Budget</p>
                <p className="font-semibold mt-0.5">${mockLeague.budget}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Roster Size</p>
                <p className="font-semibold mt-0.5">
                  {mockLeague.rosterSlots} slots
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-semibold mt-0.5">Auction</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Quick Links */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
