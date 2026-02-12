import Redis from "ioredis";
import { AddressesClient } from "@google-cloud/compute";

const PROJECT_ID = "sisya-class-52660";
const DOMAIN = process.env.DOMAIN || "sisyabackend.in";
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
});

const SLOT_SET = "ip_slots_list"; // Redis set of all slotIds
const SLOT_PREFIX = "ip_slot:";   // Redis key prefix

const addressesClient = new AddressesClient();

// Regions with reserved IPs
const REGIONS = ["asia-south1", "asia-south2"];

export async function seedIpSlotsFromGCP(namePrefix = "class-ip-") {
  for (const REGION of REGIONS) {
    console.log(`[seed] Listing addresses in region: ${REGION}`);
    console.log("project id:", PROJECT_ID);
    let addresses;
    try {
    [addresses] = await addressesClient.list({
      project: PROJECT_ID,
      region: REGION,
    });
  } catch (err) {
    console.error(`[seed] Failed to list addresses in region ${REGION}:`, err.message);
    continue;
  }
    const filtered = addresses.filter((a) => a.name && a.name.startsWith(namePrefix));

    if (!filtered.length) {
      console.warn(`[seed] Found 0 reserved addresses in ${REGION} with prefix ${namePrefix}`);
      continue;
    }

    for (const a of filtered) {
      const reservedName = a.name!;
      const suffix = reservedName.replace(namePrefix, ""); // e.g., "1"
      const slotId = `class${suffix}`; // e.g., class1
      const domain = `${slotId}.${DOMAIN}`;

      const payload = {
        slotId,
        ip: a.address,
        domain,
        region: REGION,
        zone: `${REGION}-b`,
        reservedIpName: reservedName,
        status: "free",           // free initially
        currentInstance: null,
        lastUsedAt: null,
      };

      const key = SLOT_PREFIX + slotId;
      await redis.set(key, JSON.stringify(payload));
      await redis.sadd(SLOT_SET, slotId);

      console.log(`[seed] Registered slot ${slotId} -> ${a.address} in ${REGION}`);
    }
  }

  console.log("[seed] Complete: all reserved IPs added to Redis pool.");
}

// Run the script
seedIpSlotsFromGCP()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
