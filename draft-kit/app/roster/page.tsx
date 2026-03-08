import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { mockPlayers } from "@/lib/mock-data";

const ROSTER_SLOTS = [
  { position: "C", playerId: "7" },
  { position: "1B", playerId: "20" },
  { position: "2B", playerId: null },
  { position: "3B", playerId: "12" },
  { position: "SS", playerId: "3" },
  { position: "OF", playerId: "1" },
  { position: "OF", playerId: "6" },
  { position: "OF", playerId: null },
  { position: "UTIL", playerId: null },
  { position: "SP", playerId: "18" },
  { position: "SP", playerId: null },
  { position: "SP", playerId: null },
  { position: "RP", playerId: "19" },
  { position: "RP", playerId: null },
  { position: "BN", playerId: null },
  { position: "BN", playerId: null },
];

const BUDGET = 260;
const SPENT = 169;
const REMAINING = BUDGET - SPENT;
const FILLED = ROSTER_SLOTS.filter((s) => s.playerId).length;
const TOTAL_SLOTS = ROSTER_SLOTS.length;
const MAX_BID = REMAINING - (TOTAL_SLOTS - FILLED - 1);

export default function RosterPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {FILLED} of {TOTAL_SLOTS} slots filled
        </p>
      </div>

      {/* Budget Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Remaining Budget</p>
            <p className="text-3xl font-bold text-primary mt-1">${REMAINING}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Spent</p>
            <p className="text-3xl font-bold text-foreground mt-1">${SPENT}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Bid Right Now</p>
            <p className="text-3xl font-bold text-primary mt-1">${MAX_BID}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on remaining slots
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Roster Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Roster Slots</h2>
        <div className="rounded-md border border-border overflow-hidden">
          {ROSTER_SLOTS.map((slot, i) => {
            const player = slot.playerId
              ? mockPlayers.find((p) => p.id === slot.playerId)
              : null;

            return (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-3 text-sm ${
                  i % 2 === 0 ? "bg-background" : "bg-muted/30"
                }`}
              >
                {/* Position */}
                <div className="w-14 shrink-0">
                  <Badge variant="outline" className="font-mono text-xs">
                    {slot.position}
                  </Badge>
                </div>

                {/* Player or empty */}
                {player ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">
                        {player.name}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {player.mlbTeam}
                      </span>
                      <div className="flex gap-1">
                        {player.positions.map((pos) => (
                          <Badge
                            key={pos}
                            variant="outline"
                            className="text-xs"
                          >
                            {pos}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <span className="font-bold text-primary">
                      {/* ${player.estimatedValue} */}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">
                    Empty slot
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
