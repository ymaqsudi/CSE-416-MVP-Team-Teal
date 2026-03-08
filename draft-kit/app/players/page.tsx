"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { mockPlayers, Player, Position } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const ALL_POSITIONS: Position[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "MI",
  "CI",
  "U",
  "P",
];

const riskColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Med: "bg-yellow-100 text-yellow-800 border-yellow-200",
  High: "bg-red-100 text-red-800 border-red-200",
};

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "All">("All");

  const filtered = useMemo(() => {
    return mockPlayers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.mlbTeam ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesPosition =
        position === "All" || p.positions.includes(position);
      return matchesSearch && matchesPosition;
    });
  }, [search, position]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Players</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} players available
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-32">
              {position === "All" ? "All Positions" : position}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setPosition("All")}>
              All Positions
            </DropdownMenuItem>
            {ALL_POSITIONS.map((pos) => (
              <DropdownMenuItem key={pos} onClick={() => setPosition(pos)}>
                {pos}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Player</TableHead>
              <TableHead className="font-semibold">Team</TableHead>
              <TableHead className="font-semibold">Position(s)</TableHead>
              <TableHead className="font-semibold">Risk</TableHead>
              <TableHead className="font-semibold text-right">
                Est. Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-12"
                >
                  No players found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((player: Player) => (
                <TableRow
                  key={player.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <TableCell>
                    <Link
                      href={`/players/${player.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {player.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {player.mlbTeam ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {player.positions.map((pos) => (
                        <Badge key={pos} variant="outline" className="text-xs">
                          {pos}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {player.risk ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskColors[player.risk]}`}
                      >
                        {player.risk}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    —
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
