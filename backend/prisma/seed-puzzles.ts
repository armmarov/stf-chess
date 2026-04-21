import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, 'puzzles.csv');

interface CsvRow {
  PuzzleId: string;
  FEN: string;
  Moves: string;
  Rating: string;
  RatingDeviation: string;
  Popularity: string;
  NbPlays: string;
  Themes: string;
  GameUrl: string;
  OpeningTags: string;
}

function parseRow(headers: string[], values: string[]): CsvRow {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
  return obj as unknown as CsvRow;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`puzzles.csv not found at ${CSV_PATH}`);
    console.error('Download a filtered Lichess puzzle CSV and place it at backend/prisma/puzzles.csv');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH), crlfDelay: Infinity });
  let headers: string[] = [];
  let upserted = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = line.split(',').map((h) => h.trim());
      continue;
    }

    const values = line.split(',');
    const row = parseRow(headers, values);

    if (!row.PuzzleId || !row.FEN || !row.Moves) { skipped++; continue; }

    const rating = parseInt(row.Rating, 10);
    if (isNaN(rating)) { skipped++; continue; }

    try {
      await prisma.puzzle.upsert({
        where: { externalId: row.PuzzleId },
        create: {
          externalId: row.PuzzleId,
          fen: row.FEN.trim(),
          solutionUci: row.Moves.trim(),
          rating,
          ratingDeviation: row.RatingDeviation ? parseInt(row.RatingDeviation, 10) || null : null,
          popularity: row.Popularity ? parseInt(row.Popularity, 10) || null : null,
          themes: row.Themes?.trim() || null,
          openingTags: row.OpeningTags?.trim() || null,
          gameUrl: row.GameUrl?.trim() || null,
        },
        update: {
          fen: row.FEN.trim(),
          solutionUci: row.Moves.trim(),
          rating,
          ratingDeviation: row.RatingDeviation ? parseInt(row.RatingDeviation, 10) || null : null,
          popularity: row.Popularity ? parseInt(row.Popularity, 10) || null : null,
          themes: row.Themes?.trim() || null,
          openingTags: row.OpeningTags?.trim() || null,
          gameUrl: row.GameUrl?.trim() || null,
        },
      });
      upserted++;

      if (upserted % 1000 === 0) console.log(`  upserted ${upserted}...`);
    } catch (e) {
      console.warn(`  skipped row ${row.PuzzleId}:`, e);
      skipped++;
    }
  }

  console.log(`Done. Upserted: ${upserted}, Skipped: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
