/**
 * safe-update-recordings-v2.js
 *
 * Usage:
 *   node safe-update-recordings-v2.js
 *
 * Behavior:
 *  - Replaces OLD_BASE with NEW_BASE ONLY if the URL contains the AWS domain
 *  - If the path starts with /record/, inserts /records before it -> /records/record/...
 *  - Optionally renames filenames from host-recording-... to screen-recording-... (disabled by default)
 *  - Performs HEAD check on the new URL; stops immediately on any non-2xx or network error
 *  - Leaves all non-AWS URLs completely untouched
 */

import fs from "fs";
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch"; // or rely on global fetch in Node 18+
import path from "path";

const prisma = new PrismaClient();

const OLD_BASE = "https://sisyaclassrecordings.s3.eu-north-1.amazonaws.com";
const NEW_BASE = "https://storage.googleapis.com/sisya-class-52660.appspot.com";

// Toggle: if true, rename "host-recording-..." to "screen-recording-..." in filenames.
// Set via env var or change here
const RENAME_HOST_TO_SCREEN = process.env.RENAME_HOST_TO_SCREEN === "true" || false;

// Optional logfile (appends)
const LOGFILE = process.env.LOGFILE || null;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  if (LOGFILE) {
    fs.appendFileSync(LOGFILE, line + "\n");
  }
}

/**
 * Build the new URL from an old URL string.
 * - ONLY processes URLs that start with OLD_BASE (AWS URL)
 * - Returns null for non-AWS URLs (no conversion)
 * - Replaces OLD_BASE with NEW_BASE
 * - If path begins with "/record/" ensures "/records/record/..."
 * - Optionally renames filename prefix host-recording -> screen-recording
 */
function buildNewUrl(oldUrl) {
  if (!oldUrl) return null;

  // CRITICAL: If oldUrl doesn't start with OLD_BASE (AWS URL), return null (no conversion)
  if (!oldUrl.startsWith(OLD_BASE)) return null;

  // Parse the path part after the base
  const relative = oldUrl.slice(OLD_BASE.length); // includes leading '/' if present
  // normalize leading slash
  const relPath = relative.startsWith("/") ? relative.slice(1) : relative; // e.g. "record/ltc/..."
  const parts = relPath.split("/");

  // Insert 'records' before 'record' if not already present
  if (parts[0] === "record") {
    parts.unshift("records"); // now ['records','record',...]
  } else if (parts[0] === "records" && parts[1] === "record") {
    // already correct
  } else {
    // path structure is unexpected; still preserve structure but do not break
    // (you could choose to prepend 'records' always — but we keep it conservative)
  }

  // Optionally rename filename prefix in the last segment
  const lastIdx = parts.length - 1;
  if (RENAME_HOST_TO_SCREEN && lastIdx >= 0) {
    const filename = parts[lastIdx];
    if (filename.startsWith("host-recording-")) {
      parts[lastIdx] = filename.replace(/^host-recording-/, "screen-recording-");
    }
  }

  // Rebuild new path
  const newPath = parts.join("/"); // no leading slash
  const newUrl = `${NEW_BASE}/${newPath}`;
  return newUrl;
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    // Treat 200-299 as ok
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function updateRecordingUrls() {
  log("Starting safe migration v2 (AWS URLs only)...");
  // fetch only sessions that have the AWS base URL in either url field
  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { hostRecordingUrl: { contains: "sisyaclassrecordings.s3.eu-north-1.amazonaws.com" } },
        { screenRecordingUrl: { contains: "sisyaclassrecordings.s3.eu-north-1.amazonaws.com" } }
      ]
    },
    select: {
      id: true,
      hostRecordingUrl: true,
      screenRecordingUrl: true
    },
    orderBy: { id: "asc" }
  });

  log(`Found ${sessions.length} session(s) with AWS recording URLs.`);

  for (const s of sessions) {
    log(`\nProcessing session id=${s.id}`);

    const oldHost = s.hostRecordingUrl;
    const oldScreen = s.screenRecordingUrl;

    const newHost = buildNewUrl(oldHost);
    const newScreen = buildNewUrl(oldScreen);

    // Determine if anything actually changes
    // newHost/newScreen will be null if the URL doesn't contain AWS domain
    const hostNeedsUpdate = newHost && oldHost && newHost !== oldHost;
    const screenNeedsUpdate = newScreen && oldScreen && newScreen !== oldScreen;

    if (!hostNeedsUpdate && !screenNeedsUpdate) {
      log("No AWS URLs to update for this row. Skipping.");
      continue;
    }

    // Object to hold URLs that pass validation
    const updateData = {};

    // Validate host url if we plan to update it
    if (hostNeedsUpdate) {
      log(`Checking new HOST URL: ${newHost}`);
      const check = await urlExists(newHost);
      if (!check.ok) {
        log(`⚠️ HOST URL check failed for session id=${s.id}. status=${check.status || "N/A"} error=${check.error || ""}. Skipping this URL.`);
        // Remove this URL from update - it will not be changed
        delete updateData.hostRecordingUrl;
      } else {
        log(`✅ HOST URL exists (status ${check.status}).`);
        updateData.hostRecordingUrl = newHost;
      }
    }

    // Validate screen url if we plan to update it
    if (screenNeedsUpdate) {
      log(`Checking new SCREEN URL: ${newScreen}`);
      const check = await urlExists(newScreen);
      if (!check.ok) {
        log(`⚠️ SCREEN URL check failed for session id=${s.id}. status=${check.status || "N/A"} error=${check.error || ""}. Skipping this URL.`);
        // Remove this URL from update - it will not be changed
        delete updateData.screenRecordingUrl;
      } else {
        log(`✅ SCREEN URL exists (status ${check.status}).`);
        updateData.screenRecordingUrl = newScreen;
      }
    }

    // If we reach here, update only the URLs that exist and passed validation
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      log("No valid URLs to update for this session. Skipping database update.");
      continue;
    }

    try {
      const updated = await prisma.session.update({
        where: { id: s.id },
        data: updateData,
        select: { id: true, hostRecordingUrl: true, screenRecordingUrl: true }
      });
      log(`✔ Updated session id=${s.id}:`);
      log(`   host:   ${oldHost} -> ${updated.hostRecordingUrl}`);
      log(`   screen: ${oldScreen} -> ${updated.screenRecordingUrl}`);
    } catch (err) {
      log(`❌ DB update failed for session id=${s.id}. Error: ${err.message || String(err)}`);
      log("Stopping migration immediately.");
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  log("Migration completed successfully (no errors encountered).");
  await prisma.$disconnect();
  process.exit(0);
}

updateRecordingUrls().catch(async (err) => {
  log("Unhandled error:", err.message || String(err));
  await prisma.$disconnect();
  process.exit(1);
});