import * as cheerio from 'cheerio';

export interface FideRatings {
  standard: number | null;
  rapid: number | null;
  blitz: number | null;
}

/**
 * Scrapes https://ratings.fide.com/profile/<id> and extracts the three current
 * ratings (Standard / Rapid / Blitz). Returns nulls for any that aren't
 * currently rated or can't be parsed. Throws if the FIDE ID doesn't exist.
 *
 * The FIDE profile HTML isn't a stable API — it has changed before and will
 * change again. Parsing is defensive: look for the block that lists the three
 * rating categories, read each numeric sibling, fall back to regex on raw text.
 */
export async function fetchFideRatings(fideId: string): Promise<FideRatings> {
  const url = `https://ratings.fide.com/profile/${encodeURIComponent(fideId)}`;
  const res = await fetch(url, {
    headers: {
      // Pretend to be a recent desktop browser — FIDE serves a different
      // (simpler) page to clients that don't look like browsers and the
      // rating markup is slightly different there.
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });

  if (res.status === 404) {
    throw Object.assign(new Error('FIDE ID not found'), { statusCode: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`FIDE returned ${res.status}`), { statusCode: 502 });
  }

  const html = await res.text();
  // The profile page reports "The Player was not found" inside a 200 response
  // for bogus ids — detect and 404.
  if (/player\s*was\s*not\s*found/i.test(html)) {
    throw Object.assign(new Error('FIDE ID not found'), { statusCode: 404 });
  }

  return parseFideHtml(html);
}

export function parseFideHtml(html: string): FideRatings {
  const $ = cheerio.load(html);

  // Strategy 1: find labels "Standard", "Rapid", "Blitz" and read the first
  // adjacent number. Works across the handful of layouts FIDE has used.
  const result: FideRatings = { standard: null, rapid: null, blitz: null };

  const labelToKey: Record<string, keyof FideRatings> = {
    std: 'standard',
    standard: 'standard',
    rapid: 'rapid',
    blitz: 'blitz',
  };

  // Flatten all text nodes, look for "<label> <num>" pairs.
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  for (const [label, key] of Object.entries(labelToKey)) {
    // Match the label followed within ~40 chars by a 3-4 digit number.
    // Anchor to word boundary to avoid matching "blitz-chess".
    const re = new RegExp(
      `\\b${label}\\b[^0-9]{0,40}?(\\d{3,4})(?!\\d)`,
      'i',
    );
    const m = re.exec(text);
    if (m && result[key] === null) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 100 && n <= 3500) {
        result[key] = n;
      }
    }
  }

  return result;
}
