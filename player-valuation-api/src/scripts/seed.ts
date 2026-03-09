import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { PlayerModel } from "../models/Player.js";
import { TransactionModel } from "../models/Transaction.js";

const PLAYERS = [
  { name: "Jarren Duran", mlbTeam: "BOS", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 38 },
  { name: "Corbin Carroll", mlbTeam: "ARI", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 32 },
  { name: "Gunnar Henderson", mlbTeam: "BAL", positions: ["SS", "3B"], depthRole: "Starter", risk: "Low", baseValue: 45 },
  { name: "Francisco Lindor", mlbTeam: "NYM", positions: ["SS"], depthRole: "Starter", risk: "Low", baseValue: 40 },
  { name: "Elly De La Cruz", mlbTeam: "CIN", positions: ["SS", "3B"], depthRole: "Starter", risk: "High", baseValue: 36 },
  { name: "Kyle Tucker", mlbTeam: "HOU", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 39 },
  { name: "William Contreras", mlbTeam: "MIL", positions: ["C"], depthRole: "Starter", risk: "Low", baseValue: 28 },
  { name: "Adley Rutschman", mlbTeam: "BAL", positions: ["C"], depthRole: "Starter", risk: "Low", baseValue: 30 },
  { name: "Matt McLain", mlbTeam: "CIN", positions: ["SS", "2B"], depthRole: "Starter", risk: "High", baseValue: 18 },
  { name: "Bobby Witt Jr.", mlbTeam: "KCR", positions: ["SS", "3B"], depthRole: "Starter", risk: "Low", baseValue: 48 },
  { name: "Yordan Alvarez", mlbTeam: "HOU", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 42 },
  { name: "José Ramírez", mlbTeam: "CLE", positions: ["3B"], depthRole: "Starter", risk: "Low", baseValue: 44 },
  { name: "Shohei Ohtani", mlbTeam: "LAD", positions: ["OF"], depthRole: "Starter", risk: "Low", baseValue: 55 },
  { name: "Mookie Betts", mlbTeam: "LAD", positions: ["OF", "SS"], depthRole: "Starter", risk: "Med", baseValue: 41 },
  { name: "Randy Arozarena", mlbTeam: "TBR", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 25 },
  { name: "Zac Gallen", mlbTeam: "ARI", positions: ["P"], depthRole: "Starter", risk: "Med", baseValue: 22 },
  { name: "Gerrit Cole", mlbTeam: "NYY", positions: ["P"], depthRole: "Starter", risk: "High", baseValue: 20 },
  { name: "Spencer Strider", mlbTeam: "ATL", positions: ["P"], depthRole: "Starter", risk: "High", baseValue: 24 },
  { name: "Emmanuel Clase", mlbTeam: "CLE", positions: ["P"], depthRole: "Starter", risk: "Low", baseValue: 16 },
  { name: "Pete Alonso", mlbTeam: "NYM", positions: ["1B"], depthRole: "Starter", risk: "Low", baseValue: 29 },
  { name: "Freddie Freeman", mlbTeam: "LAD", positions: ["1B"], depthRole: "Starter", risk: "Low", baseValue: 35 },
  { name: "Juan Soto", mlbTeam: "NYY", positions: ["OF"], depthRole: "Starter", risk: "Low", baseValue: 46 },
  { name: "Aaron Judge", mlbTeam: "NYY", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 43 },
  { name: "Ronald Acuña Jr.", mlbTeam: "ATL", positions: ["OF"], depthRole: "Starter", risk: "High", baseValue: 40 },
  { name: "Trea Turner", mlbTeam: "PHI", positions: ["SS"], depthRole: "Starter", risk: "Low", baseValue: 33 },
  { name: "Bryce Harper", mlbTeam: "PHI", positions: ["1B", "OF"], depthRole: "Starter", risk: "Med", baseValue: 38 },
  { name: "Fernando Tatis Jr.", mlbTeam: "SDP", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 37 },
  { name: "Vladimir Guerrero Jr.", mlbTeam: "TOR", positions: ["1B"], depthRole: "Starter", risk: "Low", baseValue: 28 },
  { name: "Bo Bichette", mlbTeam: "TOR", positions: ["SS"], depthRole: "Starter", risk: "Med", baseValue: 26 },
  { name: "Julio Rodríguez", mlbTeam: "SEA", positions: ["OF"], depthRole: "Starter", risk: "Low", baseValue: 44 },
  { name: "Cal Raleigh", mlbTeam: "SEA", positions: ["C"], depthRole: "Starter", risk: "Low", baseValue: 18 },
  { name: "Luis Robert Jr.", mlbTeam: "CWS", positions: ["OF"], depthRole: "Starter", risk: "High", baseValue: 30 },
  { name: "Paul Skenes", mlbTeam: "PIT", positions: ["P"], depthRole: "Starter", risk: "Med", baseValue: 21 },
  { name: "Oneil Cruz", mlbTeam: "PIT", positions: ["SS"], depthRole: "Starter", risk: "High", baseValue: 22 },
  { name: "Nolan Jones", mlbTeam: "COL", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 24 },
  { name: "Eury Pérez", mlbTeam: "MIA", positions: ["P"], depthRole: "Starter", risk: "High", baseValue: 19 },
  { name: "Jazz Chisholm Jr.", mlbTeam: "MIA", positions: ["OF", "2B"], depthRole: "Starter", risk: "Med", baseValue: 27 },
  { name: "CJ Abrams", mlbTeam: "WSH", positions: ["SS"], depthRole: "Starter", risk: "Low", baseValue: 26 },
  { name: "Jackson Holliday", mlbTeam: "BAL", positions: ["SS", "2B"], depthRole: "Backup", risk: "High", baseValue: 15 },
  { name: "Evan Carter", mlbTeam: "TEX", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 23 },
  { name: "Josh Jung", mlbTeam: "TEX", positions: ["3B"], depthRole: "Starter", risk: "High", baseValue: 20 },
  { name: "Royce Lewis", mlbTeam: "MIN", positions: ["3B"], depthRole: "Starter", risk: "High", baseValue: 25 },
  { name: "Tarik Skubal", mlbTeam: "DET", positions: ["P"], depthRole: "Starter", risk: "Low", baseValue: 23 },
  { name: "Riley Greene", mlbTeam: "DET", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 24 },
  { name: "Bryan Reynolds", mlbTeam: "PIT", positions: ["OF"], depthRole: "Starter", risk: "Low", baseValue: 28 },
  { name: "Christian Yelich", mlbTeam: "MIL", positions: ["OF"], depthRole: "Starter", risk: "Med", baseValue: 22 },
];

const TRANSACTIONS = [
  { title: "Placed on 60-day IL", date: new Date("2025-03-01"), source: "MLB" },
  { title: "Signed to extension", date: new Date("2025-02-28"), source: "MLB" },
  { title: "Traded to new team", date: new Date("2025-02-25"), source: "MLB" },
  { title: "Optioned to minors", date: new Date("2025-03-02"), source: "MLB" },
  { title: "Activated from IL", date: new Date("2025-02-20"), source: "MLB" },
  { title: "Placed on 15-day IL", date: new Date("2025-03-03"), source: "MLB" },
  { title: "Designated for assignment", date: new Date("2025-02-22"), source: "MLB" },
  { title: "Recalled from minors", date: new Date("2025-03-04"), source: "MLB" },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in .env");
    console.error("  - File must be: player-valuation-api/.env");
    console.error("  - Format: MONGODB_URI=mongodb+srv://... (no spaces around =)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  await PlayerModel.deleteMany({});
  await TransactionModel.deleteMany({});

  const inserted = await PlayerModel.insertMany(PLAYERS);
  console.log(`Inserted ${inserted.length} players.`);

  const txWithPlayer = TRANSACTIONS.map((t, i) => ({
    ...t,
    playerId: inserted[i % inserted.length]._id,
  }));
  await TransactionModel.insertMany(txWithPlayer);
  console.log(`Inserted ${txWithPlayer.length} transactions.`);

  await mongoose.disconnect();
  console.log("Seed done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
