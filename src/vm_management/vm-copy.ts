import {
  InstanceTemplatesClient,
  InstanceGroupManagersClient,
  ZoneOperationsClient,
  InstancesClient,
} from "@google-cloud/compute";

const templatesClient = new InstanceTemplatesClient();
const migClient = new InstanceGroupManagersClient();
const zoneOps = new ZoneOperationsClient();
const instancesClient = new InstancesClient();

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const ZONE = "asia-south1-b";
const MIG_NAME = "class-1-group";
const BASE_IMAGE =
  "https://www.googleapis.com/compute/v1/projects/sisya-class-52660/global/images/mediasoup-template-updated-22";
const DOMAIN = "sisyabackend.in";

/**
 * ===============================
 * 🚀 Create a new class VM
 * ===============================
 */
export async function createClassVM(classId: string, randomNumber: string, type: string = "class") {
  console.log(`🚀 Creating new VM for class-${classId} under MIG...`);
  const CLASS_SUBDOMAIN = type === 'class' ? `class${classId}${randomNumber}.${DOMAIN}` : `open${classId}${randomNumber}.${DOMAIN}`;
  const templateName = `class-template-${classId}-${Date.now()}`;

  const startupScript = `#!/bin/bash
CLASS_SUBDOMAIN="${CLASS_SUBDOMAIN}"
LOG_FILE="/var/log/startup.log"
echo "🚀 Startup script initiated for $CLASS_SUBDOMAIN at $(date)" >> $LOG_FILE

# Nginx Configuration
if [ -f /etc/nginx/sites-available/class-template.conf ]; then
  cp /etc/nginx/sites-available/class-template.conf /etc/nginx/sites-available/$CLASS_SUBDOMAIN.conf
  sed -i "s/CLASS_SUBDOMAIN/$CLASS_SUBDOMAIN/g" /etc/nginx/sites-available/$CLASS_SUBDOMAIN.conf
  ln -sf /etc/nginx/sites-available/$CLASS_SUBDOMAIN.conf /etc/nginx/sites-enabled/
  systemctl reload nginx
  echo "✅ Nginx configured for $CLASS_SUBDOMAIN" >> $LOG_FILE
else
  echo "❌ Template not found for Nginx config" >> $LOG_FILE
fi

# PM2 + Mediasoup setup
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

  console.log(`🧱 Creating new instance template: ${templateName}`);
  const [templateOp] = await templatesClient.insert({
    project: PROJECT_ID,
    instanceTemplateResource: {
      name: templateName,
      properties: {
        machineType: "custom-4-12288",
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
            accessConfigs: [{ type: "ONE_TO_ONE_NAT" }],
          },
        ],
        serviceAccounts: [
          {
            email: "812637125468-compute@developer.gserviceaccount.com",
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          },
        ],
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
        metadata: {
          items: [
            { key: "startup-script", value: startupScript },
            { key: "class-id", value: classId },
            { key: "class-subdomain", value: CLASS_SUBDOMAIN },
          ],
        },
      },
    },
  });

  await templateOp.promise;
  console.log(`✅ Instance template ${templateName} created for ${CLASS_SUBDOMAIN}`);

  console.log(`🔄 Updating MIG ${MIG_NAME} to use template ${templateName}...`);
  const [updateOp] = await migClient.patch({
    project: PROJECT_ID,
    zone: ZONE,
    instanceGroupManager: MIG_NAME,
    instanceGroupManagerResource: {
      instanceTemplate: `global/instanceTemplates/${templateName}`,
    },
  });
  await zoneOps.wait({
    project: PROJECT_ID,
    zone: ZONE,
    operation: updateOp.latestResponse.name,
  });
  console.log(`✅ MIG ${MIG_NAME} updated to use ${templateName}`);

  const [group] = await migClient.get({
    project: PROJECT_ID,
    zone: ZONE,
    instanceGroupManager: MIG_NAME,
  });

  const currentSize = group.targetSize ?? 0;
  const newSize = currentSize + 1;

  console.log(`📈 Scaling MIG ${MIG_NAME} from ${currentSize} ➜ ${newSize}`);
  const [resizeOp] = await migClient.resize({
    project: PROJECT_ID,
    zone: ZONE,
    instanceGroupManager: MIG_NAME,
    size: newSize,
  });
  await zoneOps.wait({
    project: PROJECT_ID,
    zone: ZONE,
    operation: resizeOp.latestResponse.name,
  });

  console.log(`✅ VM for ${CLASS_SUBDOMAIN} created and added to MIG.`);
  return { message: `VM created successfully for ${CLASS_SUBDOMAIN}` };
}

/**
 * ===============================
 * 🧹 Delete a specific class VM
 * ===============================
 */
export async function deleteClassVM(classId: string) {
  console.log(`🧹 Initiating delete request for VM of class ${classId}...`);

  // Fetch instances managed by MIG
  const [managedInstances] = await migClient.listManagedInstances({
    project: PROJECT_ID,
    zone: ZONE,
    instanceGroupManager: MIG_NAME,
  });

  if (!managedInstances || managedInstances.length === 0) {
    throw new Error(`❌ No instances found under MIG ${MIG_NAME}`);
  }

  console.log(`🔍 Searching through ${managedInstances.length} instances...`);

  let targetInstanceUrl: string | null = null;
  let targetInstanceName: string | null = null;

  // Loop through instances to find metadata match
  for (const item of managedInstances) {
    const instanceUrl = item.instance;
    const instanceName = instanceUrl.split("/").pop()!;
    console.log("🔎 Checking instance: ", instanceName);
    try {
      const [instanceDetails] = await instancesClient.get({
        project: PROJECT_ID,
        zone: ZONE,
        instance: instanceName,
      });

      const metadataItems = instanceDetails.metadata?.items || [];
      const hasMatch = metadataItems.some(
        (m) => m.key === "class-id" && m.value === classId
      );

      if (hasMatch) {
        targetInstanceUrl = instanceUrl;
        targetInstanceName = instanceName;
        console.log(`🎯 Found VM with class-id=${classId}: ${instanceName}`);
        break;
      }
    } catch (err: any) {
      console.warn(`⚠️ Could not fetch details for ${instanceName}: ${err.message}`);
    }
  }

  // Fallback: try to find instance by name pattern
  if (!targetInstanceUrl) {
    const possibleMatches = managedInstances.filter((i) =>
      i.instance.includes(classId)
    );
    if (possibleMatches.length > 0) {
      targetInstanceUrl = possibleMatches[0].instance;
      targetInstanceName = targetInstanceUrl.split("/").pop()!;
      console.log(
        `🧩 Metadata not found, but found partial name match: ${targetInstanceName}`
      );
    }
  }

  // If still no match found, throw error
  if (!targetInstanceUrl || !targetInstanceName) {
    const allNames = managedInstances.map((i) => i.instance.split("/").pop());
    console.error(`⚠️ No VM found for classId=${classId}`);
    console.log(`📋 Available instances:`, allNames);
    throw new Error(`❌ No VM found for classId ${classId}`);
  }

  // Request MIG to delete instance
  console.log(`🧱 Sending delete request for instance ${targetInstanceName}...`);
  const [deleteOp] = await migClient.deleteInstances({
    project: PROJECT_ID,
    zone: ZONE,
    instanceGroupManager: MIG_NAME,
    instanceGroupManagersDeleteInstancesRequestResource: {
      instances: [targetInstanceUrl],
    },
  });

  console.log(`⏳ Waiting for delete operation to complete...`);
  await zoneOps.wait({
    project: PROJECT_ID,
    zone: ZONE,
    operation: deleteOp.latestResponse.name,
  });

  console.log(`✅ VM ${targetInstanceName} deleted successfully for class ${classId}`);
  return { message: `VM for class${classId} deleted successfully` };
}