#!/usr/bin/env ts-node
/**
 * generate-tags.ts
 *
 * Generates N unique Keepr tag IDs, inserts them into Supabase's tags_pool,
 * and exports a CSV ready to send to a tag manufacturer for QR printing.
 *
 * Usage:
 *   npx ts-node scripts/generate-tags.ts --count 500 --batch "BATCH-2026-09"
 *
 * Requires environment variables:
 *   SUPABASE_URL          — your project URL
 *   SUPABASE_SERVICE_KEY  — service-role key (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!BASE_URL || !SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(BASE_URL, SERVICE_KEY);

// ── ID generation ─────────────────────────────────────────────────────────────
//
// Character set excludes visually ambiguous characters that cause read errors
// on small printed stickers (especially in bad lighting or scratched surfaces):
//   • 0  ↔  O  (zero vs letter O)
//   • 1  ↔  I  ↔  l  (one vs capital I vs lowercase L)
//
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ID_LENGTH = 8;
const PREFIX = 'KEEP-';

function generateId(): string {
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return PREFIX + id;
}

function generateBatch(count: number): string[] {
  const ids = new Set<string>();
  // Over-generate slightly to account for in-memory collisions
  while (ids.size < count) {
    ids.add(generateId());
  }
  return Array.from(ids);
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const COUNT = parseInt(getArg('--count', '100'), 10);
const BATCH = getArg('--batch', `BATCH-${new Date().toISOString().slice(0, 7)}`);
const DOMAIN = getArg('--domain', 'https://keepr.dpdns.org');

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nGenerating ${COUNT} tag IDs for batch: ${BATCH}`);
  console.log(`QR URL format: ${DOMAIN}/i/KEEP-XXXXXXXX\n`);

  let totalInserted = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  while (totalInserted < COUNT && attempts < MAX_ATTEMPTS) {
    attempts++;
    const needed = COUNT - totalInserted;
    // Generate extra IDs to absorb any DB-level collisions with existing rows
    const candidates = generateBatch(Math.ceil(needed * 1.05));

    const rows = candidates.map((qr_id) => ({ qr_id, batch_id: BATCH }));

    const { data, error } = await supabase
      .from('tags_pool')
      .insert(rows)
      .select('qr_id');

    if (error) {
      // Supabase returns a partial error if some rows collide (ON CONFLICT).
      // Log and continue — inserted rows are still committed.
      console.warn(`Attempt ${attempts}: partial insert — ${error.message}`);
    }

    const inserted = data?.length ?? 0;
    totalInserted += inserted;
    console.log(`Attempt ${attempts}: inserted ${inserted} / ${needed} needed (total so far: ${totalInserted})`);
  }

  if (totalInserted < COUNT) {
    console.error(`\nWarning: only ${totalInserted} of ${COUNT} IDs were inserted after ${MAX_ATTEMPTS} attempts.`);
  } else {
    console.log(`\n✓ ${totalInserted} tag IDs inserted into tags_pool.`);
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const { data: poolRows, error: fetchErr } = await supabase
    .from('tags_pool')
    .select('qr_id')
    .eq('batch_id', BATCH)
    .order('created_at', { ascending: true });

  if (fetchErr || !poolRows) {
    console.error('Could not fetch inserted rows for CSV export:', fetchErr?.message);
    process.exit(1);
  }

  const csvPath = path.join(process.cwd(), `keepr_tags_${BATCH}.csv`);
  const csvLines = [
    'qr_id,url',
    ...poolRows.map((r) => `${r.qr_id},${DOMAIN}/i/${r.qr_id}`),
  ];
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');

  console.log(`✓ CSV exported: ${csvPath}`);
  console.log(`  → Send to manufacturer for QR code printing.`);
  console.log(`  → Each row: qr_id (human-readable) + full URL for the QR encode.\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
