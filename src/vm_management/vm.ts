import { InstancesClient, ZoneOperationsClient } from "@google-cloud/compute";
import Redis from "ioredis";

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const DOMAIN = process.env.DOMAIN || "sisyabackend.in";

// Redis setup
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

const SLOT_SET = "ip_slots_list";
const SLOT_PREFIX = "ip_slot:";

// GCP clients
const instancesClient = new InstancesClient();
const operationsClient = new ZoneOperationsClient();

// Base image for all class VMs
const BASE_IMAGE =
  "https://www.googleapis.com/compute/v1/projects/sisya-class-52660/global/images/mediasoup-template-updated-22";

/**
 * 🚀 Create a new class VM
 * Automatically picks a free IP from Redis, creates VM in correct zone, configures Nginx
 */
export async function createClassVM(classId: string) {
  console.log(`🚀 Creating new VM for class-${classId}...`);
     
  // Step 1 — Get a free IP slot from Redis
  const slotIds = await redis.smembers(SLOT_SET);
  if (!slotIds.length) throw new Error("No IP slots available in Redis");

  let selectedSlot: any = null;
  for (const slotId of slotIds) {
    const data = await redis.get(SLOT_PREFIX + slotId);
    if (!data) continue;
    const slot = JSON.parse(data);
    if (slot.status === "free") {
      selectedSlot = slot;
      break;
    }
  }

  if (!selectedSlot) throw new Error("No free IP slots available");

  console.log(`[vm] Selected slot: ${selectedSlot.slotId} -> ${selectedSlot.ip} in ${selectedSlot.zone}`);

  const zone = selectedSlot.zone; // full zone like "asia-south2-b"
  const ip = selectedSlot.ip;
  const domain = selectedSlot.domain;
  const vmName = `class-${classId}`;

  // Step 2 — Build startup script with Nginx config
  const startupScript = `#!/bin/bash
CLASS_SUBDOMAIN="${domain}"
LOG_FILE="/var/log/startup.log"
echo "🚀 Startup script initiated for $CLASS_SUBDOMAIN at $(date)" >> $LOG_FILE

# === Nginx Configuration ===
TEMPLATE_CONF="/etc/nginx/sites-available/class-template.conf"
TARGET_CONF="/etc/nginx/sites-available/$CLASS_SUBDOMAIN.conf"
if [ -f "$TEMPLATE_CONF" ]; then
  cp "$TEMPLATE_CONF" "$TARGET_CONF"
  sed -i "s/CLASS_SUBDOMAIN/$CLASS_SUBDOMAIN/g" "$TARGET_CONF"
  ln -sf "$TARGET_CONF" /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  echo "✅ Nginx configured for $CLASS_SUBDOMAIN" >> $LOG_FILE
else
  echo "❌ Template not found for Nginx config" >> $LOG_FILE
fi

# === PM2 + Mediasoup Setup ===
sudo -u dell bash <<'EOF'
source /home/dell/.bashrc
cd /home/dell/mediasoup-base
sleep 5
if pm2 list | grep -q "mediasoup"; then
  pm2 restart mediasoup
else
  pm2 start dist/index.js --name mediasoup
fi
pm2 save
pm2 startup systemd -u dell --hp /home/dell
EOF

echo "🎉 Startup complete for $CLASS_SUBDOMAIN" >> $LOG_FILE
`;

  // Step 3 — Create the VM
  console.log(`[vm] Creating VM ${vmName} in zone ${zone} with reserved IP ${ip}...`);

  const [operation] = await instancesClient.insert({
    project: PROJECT_ID,
    zone,
    instanceResource: {
      name: vmName,
      machineType: `zones/${zone}/machineTypes/custom-4-12288`,
      disks: [
        {
          boot: true,
          autoDelete: true,
          initializeParams: { sourceImage: BASE_IMAGE },
        },
      ],
      networkInterfaces: [
        {
          network: "global/networks/default",
          accessConfigs: [
            { name: "External NAT", type: "ONE_TO_ONE_NAT", natIP: ip },
          ],
        },
      ],
      metadata: {
        items: [
          { key: "startup-script", value: startupScript },
          { key: "class-id", value: classId },
          { key: "class-subdomain", value: domain },
        ],
      },
      tags: {
        items: [
          "mediasoup-server",
          "http-server",
          "https-server",
          "turn",
          "turn-backup-ports",
          "turn-tcp-live",
          "ds-allow-port-4000",
          "mediasoup-server-l4",
          "turn-udp",
        ],
      },
    },
  });

  console.log(`[vm] Waiting for VM ${vmName} creation operation to complete...`);

  // Step 3a — Wait for operation to complete
  await operationsClient.wait({
    operation: operation.name!,
    project: PROJECT_ID,
    zone,
  });

  // Step 4 — Update Redis
  selectedSlot.status = "in-use";
  selectedSlot.currentInstance = vmName;
  selectedSlot.lastUsedAt = new Date().toISOString();
  await redis.set(SLOT_PREFIX + selectedSlot.slotId, JSON.stringify(selectedSlot));

  console.log(`✅ VM ${vmName} created and IP slot ${selectedSlot.slotId} marked as in-use`);
  return { vmName, ip, domain, zone };
}

/**
 * 🧹 Delete a specific class VM and free the IP slot
 */
export async function deleteClassVM(classId: string) {
  console.log(`🧹 Deleting VM for class ${classId}...`);

  const slotIds = await redis.smembers(SLOT_SET);
  if (!slotIds.length) throw new Error("No IP slots found in Redis");

  let targetSlot: any = null;
  for (const slotId of slotIds) {
    const data = await redis.get(SLOT_PREFIX + slotId);
    if (!data) continue;
    const slot = JSON.parse(data);
    if (slot.status === "in-use" && slot.currentInstance?.includes(classId)) {
      targetSlot = slot;
      break;
    }
  }

  if (!targetSlot) throw new Error(`No VM found for classId ${classId}`);

  const zone = targetSlot.zone;
  const vmName = targetSlot.currentInstance;

  const [deleteOp] = await instancesClient.delete({
    project: PROJECT_ID,
    zone,
    instance: vmName,
  });

  console.log(`[vm] Waiting for deletion of VM ${vmName}...`);
  await operationsClient.wait({
    operation: deleteOp.name!,
    project: PROJECT_ID,
    zone,
  });

  // Update Redis
  targetSlot.status = "free";
  targetSlot.currentInstance = null;
  targetSlot.lastUsedAt = new Date().toISOString();
  await redis.set(SLOT_PREFIX + targetSlot.slotId, JSON.stringify(targetSlot));

  console.log(`✅ VM ${vmName} deleted and IP slot ${targetSlot.slotId} marked as free`);
  return { vmName, slotId: targetSlot.slotId };
}
