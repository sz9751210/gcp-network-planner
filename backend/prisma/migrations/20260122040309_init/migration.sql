-- CreateTable
CREATE TABLE "service_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "gcp_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "serviceAccountId" TEXT,
    CONSTRAINT "gcp_projects_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "service_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gcp_vpcs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vpcId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gcpProjectId" TEXT NOT NULL,
    "isSharedVpcHost" BOOLEAN NOT NULL DEFAULT false,
    "mtu" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gcp_vpcs_gcpProjectId_fkey" FOREIGN KEY ("gcpProjectId") REFERENCES "gcp_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gcp_subnets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ipCidrRange" TEXT NOT NULL,
    "gatewayIp" TEXT NOT NULL,
    "privateGoogleAccess" BOOLEAN NOT NULL DEFAULT false,
    "selfLink" TEXT NOT NULL,
    "vpcId" TEXT NOT NULL,
    "gcpVpcId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gcp_subnets_gcpVpcId_fkey" FOREIGN KEY ("gcpVpcId") REFERENCES "gcp_vpcs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gcp_vpc_peerings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "targetNetwork" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "exportCustomRoutes" BOOLEAN NOT NULL DEFAULT false,
    "importCustomRoutes" BOOLEAN NOT NULL DEFAULT false,
    "vpcId" TEXT NOT NULL,
    "gcpVpcId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gcp_vpc_peerings_gcpVpcId_fkey" FOREIGN KEY ("gcpVpcId") REFERENCES "gcp_vpcs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gcp_routes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vpcId" TEXT NOT NULL,
    "gcpVpcId" TEXT NOT NULL,
    "destRange" TEXT NOT NULL,
    "nextHop" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "description" TEXT,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gcp_routes_gcpVpcId_fkey" FOREIGN KEY ("gcpVpcId") REFERENCES "gcp_vpcs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gcp_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "internalIp" TEXT NOT NULL,
    "externalIp" TEXT,
    "network" TEXT NOT NULL,
    "subnetwork" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "labels" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "gcp_firewall_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "sourceRanges" TEXT NOT NULL,
    "sourceTags" TEXT NOT NULL,
    "targetTags" TEXT NOT NULL,
    "allowed" TEXT NOT NULL,
    "denied" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "service_accounts_projectId_idx" ON "service_accounts"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "service_accounts_projectId_accountEmail_key" ON "service_accounts"("projectId", "accountEmail");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_projects_projectId_key" ON "gcp_projects"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_projects_serviceAccountId_key" ON "gcp_projects"("serviceAccountId");

-- CreateIndex
CREATE INDEX "gcp_projects_projectId_idx" ON "gcp_projects"("projectId");

-- CreateIndex
CREATE INDEX "gcp_vpcs_gcpProjectId_idx" ON "gcp_vpcs"("gcpProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_vpcs_gcpProjectId_vpcId_key" ON "gcp_vpcs"("gcpProjectId", "vpcId");

-- CreateIndex
CREATE INDEX "gcp_subnets_gcpVpcId_idx" ON "gcp_subnets"("gcpVpcId");

-- CreateIndex
CREATE INDEX "gcp_subnets_region_idx" ON "gcp_subnets"("region");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_subnets_gcpVpcId_name_key" ON "gcp_subnets"("gcpVpcId", "name");

-- CreateIndex
CREATE INDEX "gcp_vpc_peerings_gcpVpcId_idx" ON "gcp_vpc_peerings"("gcpVpcId");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_vpc_peerings_gcpVpcId_name_key" ON "gcp_vpc_peerings"("gcpVpcId", "name");

-- CreateIndex
CREATE INDEX "gcp_routes_gcpVpcId_idx" ON "gcp_routes"("gcpVpcId");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_routes_gcpVpcId_name_key" ON "gcp_routes"("gcpVpcId", "name");

-- CreateIndex
CREATE INDEX "gcp_instances_status_idx" ON "gcp_instances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_instances_name_key" ON "gcp_instances"("name");

-- CreateIndex
CREATE INDEX "gcp_firewall_rules_network_idx" ON "gcp_firewall_rules"("network");

-- CreateIndex
CREATE UNIQUE INDEX "gcp_firewall_rules_name_key" ON "gcp_firewall_rules"("name");
