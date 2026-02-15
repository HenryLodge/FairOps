import { GoogleGenAI } from '@google/genai';
import type { VenueMetrics } from './venueBounds';

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[gemini] GEMINI_API_KEY is not set — AI features will fail at runtime.');
}

export const genai = new GoogleGenAI({ apiKey: apiKey ?? '' });

/**
 * Model to use for image generation.
 * gemini-2.5-flash-image supports responseModalities: ['TEXT','IMAGE'].
 */
export const IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Model for Event Assistant chat (text-only, conversational).
 */
export const CHAT_MODEL = 'gemini-2.0-flash';

/* ------------------------------------------------------------------ */
/* Types for prompt inputs                                             */
/* ------------------------------------------------------------------ */

export interface LayoutEvent {
  name: string;
  date: string;
  location: string;
  expected_attendance: number | null;
  venue_width: number | null;
  venue_height: number | null;
}

export interface LayoutVendor {
  booth_name: string;
  vendor_type: string; // food | game | merch | ride
  space_needed: number;
  power_needed: boolean;
  description: string | null;
}

export type Attractions = Record<string, number>;

/** Structured venue shape description produced by venueShapeDescription(). */
export interface VenueShapeInfo {
  /** Human-readable geometric description for the prompt. */
  text: string;
  /** Aspect ratio of the venue's primary shape (width × height). */
  aspectRatio: { w: number; h: number };
}

/** Context passed to Event Assistant chat (system prompt). */
export interface ChatEventContext {
  name: string;
  date: string;
  location: string;
  expected_attendance: number | null;
  totalVendors: number;
  approved: number;
  pending: number;
  layoutStatus: 'none' | 'generated';
  vendorSummary?: string; // e.g. "3 food, 2 game, 1 merch"
}

/* ------------------------------------------------------------------ */
/* Prompt builders                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build the system prompt for Event Assistant chat. Injects current event
 * context so the model can answer questions about vendors, layout, operations.
 */
export function buildChatSystemPrompt(ctx: ChatEventContext): string {
  const lines: string[] = [
    'You are a helpful Event Assistant for fair and festival organizers.',
    'You help with event planning: vendors, layout, safety, operations, and day-of logistics.',
    'Use the event context below to answer questions accurately. If something is unknown, say so.',
    '',
    '## Current Event Context',
    `- Event name: ${ctx.name}`,
    `- Date: ${ctx.date}`,
    `- Location: ${ctx.location}`,
  ];
  if (ctx.expected_attendance != null) {
    lines.push(`- Expected attendance: ${ctx.expected_attendance.toLocaleString()}`);
  }
  lines.push(`- Vendors: ${ctx.totalVendors} total (${ctx.approved} approved, ${ctx.pending} pending)`);
  if (ctx.vendorSummary) {
    lines.push(`- Vendor mix: ${ctx.vendorSummary}`);
  }
  lines.push(`- Layout: ${ctx.layoutStatus === 'generated' ? 'AI layout has been generated' : 'No layout generated yet'}`);
  lines.push('');
  lines.push('Answer concisely and helpfully. For vendor mix, safety, or timeline questions, use the context above.');
  return lines.join('\n');
}


/**
 * Build the prompt that asks Gemini to generate a top-down color-coded
 * venue layout image and text reasoning + safety notes.
 */
export function buildLayoutPrompt(
  event: LayoutEvent,
  vendors: LayoutVendor[],
  metrics: VenueMetrics | null,
  attractions: Attractions | null,
  venueShape?: VenueShapeInfo | null,
  hasReferenceImage = false,
): string {
  const lines: string[] = [];

  /* ---- Role ---- */
  lines.push(
    'You are an expert event layout planner for carnivals, fairs, and festivals.',
    'Your job is to generate an optimized top-down 2D venue layout image.',
    ''
  );

  /* ---- Event context ---- */
  lines.push('## Event Details');
  lines.push(`- Name: ${event.name}`);
  lines.push(`- Date: ${event.date}`);
  lines.push(`- Location: ${event.location}`);
  if (event.expected_attendance != null) {
    lines.push(`- Expected attendance: ${event.expected_attendance.toLocaleString()} people`);
  }
  if (event.venue_width != null && event.venue_height != null) {
    lines.push(`- Grid dimensions: ${event.venue_width} columns × ${event.venue_height} rows`);
  }
  if (metrics) {
    lines.push(
      `- Real-world venue size: approximately ${Math.round(metrics.widthMeters)} m × ${Math.round(metrics.heightMeters)} m (${Math.round(metrics.areaM2).toLocaleString()} m²)`
    );
  }
  lines.push('');

  /* ---- Venue shape (detailed geometric description) ---- */
  if (venueShape) {
    const { w, h } = venueShape.aspectRatio;
    const arStr = w >= h
      ? `${(w / (h || 1)).toFixed(1)}:1`
      : `1:${(h / (w || 1)).toFixed(1)}`;
    lines.push('## Venue Shape (CRITICAL — must match exactly)');
    lines.push(`The venue boundary is: ${venueShape.text}`);
    lines.push(`The generated image MUST match this exact shape and aspect ratio.`);
    lines.push(`The image aspect ratio MUST be ${arStr} (width:height) to match the venue proportions.`);
    lines.push('All vendors, attractions, and structures must be placed INSIDE the venue boundary.');
    lines.push('Areas outside the venue boundary should be empty/unused.');
    if (hasReferenceImage) {
      lines.push('');
      lines.push('A reference image of the venue boundary is attached.');
      lines.push('You MUST use this image as the exact boundary template for your layout.');
      lines.push('Place all vendors and attractions INSIDE the drawn boundary shape.');
      lines.push('The output image MUST preserve the same shape outline and aspect ratio as the reference.');
      lines.push('Do not change, simplify, or ignore the venue boundary shape.');
    }
    lines.push('');
  }

  /* ---- Attractions / rides to place ---- */
  if (attractions && Object.keys(attractions).length > 0) {
    const attractionEntries = Object.entries(attractions)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return `- ${count}× ${label}`;
      });
    if (attractionEntries.length > 0) {
      lines.push('## Attractions / Rides to Place');
      lines.push(...attractionEntries);
      lines.push('');
    }
  }

  /* ---- Vendors ---- */
  if (vendors.length > 0) {
    lines.push('## Approved Vendors to Place');
    vendors.forEach((v, i) => {
      const parts: string[] = [
        `${i + 1}. "${v.booth_name}" (type: ${v.vendor_type})`,
      ];
      parts.push(`   Space needed: ${v.space_needed} sq ft`);
      parts.push(`   Power needed: ${v.power_needed ? 'Yes' : 'No'}`);
      if (v.description) {
        parts.push(`   Description: ${v.description}`);
      }
      lines.push(...parts);
    });
    lines.push('');
  } else {
    lines.push('## Vendors');
    lines.push('No approved vendors yet — place only the attractions/rides listed above.');
    lines.push('');
  }

  /* ---- Strict item count enforcement ---- */
  {
    const totalVendors = vendors.length;
    const attractionEntries = attractions
      ? Object.entries(attractions).filter(([, count]) => count > 0)
      : [];
    const totalAttractions = attractionEntries.reduce((sum, [, c]) => sum + c, 0);

    if (totalVendors > 0 || totalAttractions > 0) {
      lines.push('## Item Count Requirements (MANDATORY)');
      lines.push('You MUST place EXACTLY the following number of each item — no more, no less:');
      if (totalVendors > 0) {
        lines.push(`- Vendors: ${totalVendors} total`);
        vendors.forEach((v) => {
          lines.push(`  - 1× "${v.booth_name}" (${v.vendor_type})`);
        });
      }
      if (totalAttractions > 0) {
        lines.push(`- Attractions: ${totalAttractions} total`);
        attractionEntries.forEach(([key, count]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          lines.push(`  - ${count}× ${label}`);
        });
      }
      lines.push('Every single vendor and attraction listed above MUST appear exactly once in the layout.');
      lines.push('Double-check your counts before finalizing.');
      lines.push('');
    }
  }

  /* ---- Placement rules ---- */
  lines.push('## Layout Rules (MUST follow)');
  lines.push('1. Entrances are at the bottom-left and bottom-right corners.');
  lines.push('2. Keep clear emergency access lanes (at least one horizontal and one vertical lane). Mark them visibly.');
  lines.push('3. Place food vendors near entrances for impulse buying and easy access.');
  lines.push('4. Separate competing vendors of the same type — do NOT place two food vendors adjacent.');
  lines.push('5. Power-heavy vendors (power_needed = true) should be placed along the outer edges where power hookups are available.');
  lines.push('6. Group kid-friendly attractions (bumper cars, fun house) into a "Kids Zone" away from loud rides.');
  lines.push('7. Large rides (roller coaster, ferris wheel) should be spaced apart and placed where they are visible from a distance to draw crowds.');
  lines.push('8. Info booths and photo booths should be near entrances or central walkways.');
  lines.push('9. Ensure adequate walking space between all structures.');
  lines.push('10. CRITICAL: Place EXACTLY the number of vendors and attractions specified. Do not add extras or omit any.');
  lines.push('');

  /* ---- Output instructions ---- */
  lines.push('## What to Generate');

  // Compute aspect ratio string for image quality instructions
  let imageAspectStr: string | null = null;
  if (venueShape) {
    const { w, h } = venueShape.aspectRatio;
    imageAspectStr = w >= h
      ? `${(w / (h || 1)).toFixed(1)}:1`
      : `1:${(h / (w || 1)).toFixed(1)}`;
  } else if (metrics) {
    const { widthMeters, heightMeters } = metrics;
    imageAspectStr = widthMeters >= heightMeters
      ? `${(widthMeters / (heightMeters || 1)).toFixed(1)}:1`
      : `1:${(heightMeters / (widthMeters || 1)).toFixed(1)}`;
  }

  if (hasReferenceImage) {
    lines.push('Use the attached venue boundary image as a template.');
    lines.push('Draw the same boundary outline in the generated layout.');
    lines.push('');
  }
  lines.push('1. **IMAGE**: Generate a HIGH RESOLUTION, crisp, professional-quality top-down 2D layout map of the venue.');
  if (imageAspectStr) {
    lines.push(`   The image MUST have an aspect ratio of ${imageAspectStr} (width:height) matching the venue shape.`);
  }
  lines.push('   Use clean vector-style graphics with sharp edges and readable text labels.');
  lines.push('   Make the image at least 1024px on the longest side.');
  lines.push('   Use distinct colors:');
  lines.push('   - Food vendors: warm yellow (#FEF3C7)');
  lines.push('   - Game vendors: light blue (#DBEAFE)');
  lines.push('   - Merch vendors: light indigo (#E0E7FF)');
  lines.push('   - Ride vendors: light pink (#FCE7F3)');
  lines.push('   - Attractions/rides: bold pink (#F472B6)');
  lines.push('   - Empty/walkway: light gray (#F9FAFB)');
  lines.push('   - Entrances: green markers at bottom corners');
  lines.push('   - Emergency lanes: red dashed lines');
  lines.push('   Include a color legend on the image. Label each booth/attraction with its name.');
  lines.push('');
  lines.push('2. **TEXT**: After the image, write:');
  lines.push('   - **REASONING**: One bullet per vendor/attraction explaining why you placed it there.');
  lines.push('   - **SAFETY NOTES**: List any safety considerations (fire lanes, power load, crowd flow, emergency access).');
  lines.push('   Format the text clearly with "REASONING:" and "SAFETY NOTES:" headers.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build the prompt for refining an existing layout based on organizer feedback.
 * The current layout image is sent alongside this text.
 */
export function buildRefinePrompt(feedback: string): string {
  const lines: string[] = [];

  lines.push(
    'You are an expert event layout planner. The organizer has reviewed the current layout',
    'and wants changes. The current layout image is attached.',
    '',
    '## Organizer Feedback',
    feedback,
    '',
    '## Instructions',
    '1. Generate an UPDATED layout image incorporating the feedback while still following all safety rules.',
    '2. After the image, write updated REASONING and SAFETY NOTES in the same format as before.',
    '3. Explain what you changed and why.',
    '',
  );

  return lines.join('\n');
}
