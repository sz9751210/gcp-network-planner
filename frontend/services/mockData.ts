import { GcpProject } from '../types';

const DEFAULT_SCANNED_AT = '2026-03-31T00:00:00Z';

export const MOCK_PROJECTS: GcpProject[] = [
  {
    projectId: 'host-project-prod-01',
    name: 'Production Shared VPC Host',
    number: '123456789012',
    instances: [
      {
        id: 'i-1',
        name: 'nat-gateway-us-1',
        zone: 'us-central1-a',
        machineType: 'e2-medium',
        status: 'RUNNING',
        internalIp: '10.0.1.5',
        externalIp: '34.100.200.1',
        network: 'prod-shared-vpc',
        subnetwork: 'prod-app-subnet-us',
        tags: ['nat', 'gateway'],
        labels: { env: 'prod', component: 'network' }
      }
    ],
    vpcs: [
      {
        name: 'prod-shared-vpc',
        id: 'vpc-1',
        isSharedVpcHost: true,
        mtu: 1460,
        peerings: [
          {
            name: 'peering-to-data-dev',
            targetNetwork: 'projects/data-analytics-dev/global/networks/dev-vpc-custom',
            state: 'ACTIVE',
            exportCustomRoutes: true,
            importCustomRoutes: false
          }
        ],
        routes: [
          {
            id: 'rt-1',
            name: 'default-internet-gateway',
            network: 'prod-shared-vpc',
            destRange: '0.0.0.0/0',
            nextHop: 'Default Internet Gateway',
            priority: 1000,
            description: 'Default route to the internet'
          },
          {
            id: 'rt-2',
            name: 'peering-route-data-dev',
            network: 'prod-shared-vpc',
            destRange: '192.168.10.0/24',
            nextHop: 'peering-to-data-dev',
            priority: 1000,
            description: 'Imported from data-analytics-dev'
          }
        ],
        subnets: [
          {
            name: 'prod-app-subnet-us',
            region: 'us-central1',
            ipCidrRange: '10.0.1.0/24',
            gatewayIp: '10.0.1.1',
            privateGoogleAccess: true,
            selfLink: 'projects/host-project-prod-01/regions/us-central1/subnetworks/prod-app-subnet-us'
          },
          {
            name: 'prod-db-subnet-us',
            region: 'us-central1',
            ipCidrRange: '10.0.2.0/24',
            gatewayIp: '10.0.2.1',
            privateGoogleAccess: false,
            selfLink: 'projects/host-project-prod-01/regions/us-central1/subnetworks/prod-db-subnet-us'
          },
          {
            name: 'prod-gke-subnet-asia',
            region: 'asia-east1',
            ipCidrRange: '10.10.0.0/20',
            gatewayIp: '10.10.0.1',
            privateGoogleAccess: true,
            selfLink: 'projects/host-project-prod-01/regions/asia-east1/subnetworks/prod-gke-subnet-asia'
          }
        ]
      }
    ],
    firewallRules: [
      {
        id: 'fw-1',
        name: 'allow-internal-traffic',
        network: 'prod-shared-vpc',
        direction: 'INGRESS',
        priority: 1000,
        action: 'ALLOW',
        description: 'Allow all internal traffic between subnets',
        sourceRanges: ['10.0.0.0/8'],
        allowed: [{ IPProtocol: 'all' }]
      },
      {
        id: 'fw-2',
        name: 'allow-ssh-bastion',
        network: 'prod-shared-vpc',
        direction: 'INGRESS',
        priority: 1000,
        action: 'ALLOW',
        sourceRanges: ['35.235.240.0/20'], // IAP Range
        targetTags: ['bastion'],
        allowed: [{ IPProtocol: 'tcp', ports: ['22'] }]
      },
      {
        id: 'fw-3',
        name: 'allow-health-checks',
        network: 'prod-shared-vpc',
        direction: 'INGRESS',
        priority: 1000,
        action: 'ALLOW',
        sourceRanges: ['130.211.0.0/22', '35.191.0.0/16'],
        allowed: [{ IPProtocol: 'tcp' }]
      }
    ],
    loadBalancers: [],
    armorPolicies: [],
    iamPolicy: [
      {
        role: 'roles/owner',
        members: ['user:admin@example.com']
      },
      {
        role: 'roles/compute.networkAdmin',
        members: ['group:network-admins@example.com', 'user:netops-lead@example.com']
      },
      {
        role: 'roles/compute.securityAdmin',
        members: ['group:security-team@example.com']
      }
    ],
    gkeClusters: [
      {
        id: 'gke-1',
        name: 'prod-cluster-asia',
        location: 'asia-east1',
        network: 'prod-shared-vpc',
        subnetwork: 'prod-gke-subnet-asia',
        status: 'RUNNING',
        clusterIpv4Cidr: '10.20.0.0/14', // Alias IP
        servicesIpv4Cidr: '10.24.0.0/20',
        masterIpv4Cidr: '172.16.0.0/28',
        privateCluster: true,
        masterAuthorizedNetworks: ['10.0.1.0/24'],
        nodePools: [
          { name: 'default-pool', nodeCount: 3, machineType: 'e2-standard-4', version: '1.27.3-gke.100' },
          { name: 'highmem-pool', nodeCount: 2, machineType: 'e2-highmem-8', version: '1.27.3-gke.100' }
        ],
        endpoint: '172.16.0.2',
        masterVersion: '1.27.3-gke.100',
        labels: { env: 'prod', team: 'platform', region: 'asia' },
        workloads: [
           { name: 'nginx-ingress-controller', namespace: 'ingress-nginx', type: 'Deployment', status: 'OK', pods: '3/3', images: ['nginx/nginx-ingress:2.4.0'] },
           { name: 'frontend-web', namespace: 'default', type: 'Deployment', status: 'OK', pods: '5/5', images: ['gcr.io/my-proj/frontend:v12'] },
           { name: 'redis-cache', namespace: 'default', type: 'StatefulSet', status: 'OK', pods: '3/3', images: ['redis:6.0'] },
           { name: 'log-collector', namespace: 'kube-system', type: 'DaemonSet', status: 'Warning', pods: '4/5', images: ['fluentd:v1.14'] }
        ],
        services: [
           { name: 'frontend-svc', namespace: 'default', type: 'LoadBalancer', clusterIp: '10.24.0.100', externalIp: '34.87.10.5', ports: '80/TCP' },
           { name: 'redis-headless', namespace: 'default', type: 'ClusterIP', clusterIp: 'None', ports: '6379/TCP' },
           { name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIp: '10.24.0.1', ports: '443/TCP' }
        ],
        ingresses: [
           { name: 'main-ingress', namespace: 'default', loadBalancerIp: '34.87.10.5', backends: ['frontend-svc:80'] }
        ],
        pvcs: [
           { name: 'redis-data', namespace: 'default', status: 'Bound', volume: 'pvc-1234-abcd', capacity: '100Gi', storageClass: 'standard-rwo' },
           { name: 'log-buffer', namespace: 'kube-system', status: 'Bound', volume: 'pvc-5678-efgh', capacity: '500Gi', storageClass: 'premium-rwo' }
        ],
        storageClasses: [
           { name: 'standard-rwo', provisioner: 'pd.csi.storage.gke.io', reclaimPolicy: 'Delete' },
           { name: 'premium-rwo', provisioner: 'pd.csi.storage.gke.io', reclaimPolicy: 'Retain' }
        ],
        configMaps: [
           { 
             name: 'nginx-conf', 
             namespace: 'ingress-nginx', 
             data: { 
                'nginx.conf': 'server {\n  listen 80;\n  server_name localhost;\n  location / {\n    root /usr/share/nginx/html;\n  }\n}', 
                'mime.types': 'types {\n  text/html html;\n  text/css css;\n}' 
             } 
           },
           { 
             name: 'game-config', 
             namespace: 'default', 
             data: { 'game.properties': 'difficulty=hard\nlives=3\nmax_players=100', 'ui.properties': 'theme=dark\nanimations=true' } 
           },
           { 
             name: 'kube-root-ca.crt', 
             namespace: 'default', 
             data: { 'ca.crt': '-----BEGIN CERTIFICATE-----\nMIIDAzCCAeugAwIBAgIIb...\n-----END CERTIFICATE-----' } 
           }
        ],
        secrets: [
           { 
             name: 'db-creds', 
             namespace: 'default', 
             type: 'Opaque',
             data: { 'username': 'admin', 'password': 'super-secret-password-123' } 
           },
           { 
             name: 'tls-cert', 
             namespace: 'default', 
             type: 'kubernetes.io/tls',
             data: { 'tls.crt': 'MIIDAzCCAeugAwIBAgIIb...', 'tls.key': 'MIIEowIBAAKCAQEA...' }
           },
           { 
             name: 'default-token-xyz', 
             namespace: 'default', 
             type: 'kubernetes.io/service-account-token',
             data: { 'token': 'eyJhbGciOiJSUzI1NiIsImtpZCI6...' } 
           }
        ]
      }
    ],
    lastScannedAt: DEFAULT_SCANNED_AT,
    stale: false
  },
  {
    projectId: 'service-app-frontend-01',
    name: 'Frontend Application Service Project',
    number: '987654321098',
    instances: [
      {
        id: 'i-2',
        name: 'frontend-group-abc',
        zone: 'us-central1-b',
        machineType: 'n2-standard-2',
        status: 'RUNNING',
        internalIp: '10.0.1.20',
        network: 'prod-shared-vpc (shared)',
        subnetwork: 'prod-app-subnet-us',
        tags: ['http-server', 'https-server'],
        labels: { env: 'prod', app: 'frontend' }
      },
      {
        id: 'i-3',
        name: 'frontend-group-xyz',
        zone: 'us-central1-f',
        machineType: 'n2-standard-2',
        status: 'RUNNING',
        internalIp: '10.0.1.21',
        network: 'prod-shared-vpc (shared)',
        subnetwork: 'prod-app-subnet-us',
        tags: ['http-server', 'https-server'],
        labels: { env: 'prod', app: 'frontend' }
      }
    ],
    vpcs: [
      {
        name: 'default',
        id: 'vpc-2',
        isSharedVpcHost: false,
        peerings: [],
        routes: [
           {
            id: 'rt-3',
            name: 'default-internet-gateway',
            network: 'default',
            destRange: '0.0.0.0/0',
            nextHop: 'Default Internet Gateway',
            priority: 1000
          }
        ],
        subnets: [
          {
            name: 'default',
            region: 'us-central1',
            ipCidrRange: '10.128.0.0/20',
            gatewayIp: '10.128.0.1',
            privateGoogleAccess: false,
            selfLink: 'projects/service-app-frontend-01/regions/us-central1/subnetworks/default'
          }
        ]
      }
    ],
    firewallRules: [
      {
        id: 'fw-4',
        name: 'default-allow-ssh',
        network: 'default',
        direction: 'INGRESS',
        priority: 65534,
        action: 'ALLOW',
        sourceRanges: ['0.0.0.0/0'],
        allowed: [{ IPProtocol: 'tcp', ports: ['22'] }]
      },
       {
        id: 'fw-5',
        name: 'default-allow-rdp',
        network: 'default',
        direction: 'INGRESS',
        priority: 65534,
        action: 'ALLOW',
        sourceRanges: ['0.0.0.0/0'],
        allowed: [{ IPProtocol: 'tcp', ports: ['3389'] }]
      }
    ],
    loadBalancers: [
      {
        id: 'lb-1',
        name: 'frontend-global-lb',
        type: 'EXTERNAL_HTTPS',
        ipAddress: '34.120.50.10',
        protocol: 'HTTPS',
        portRange: '443',
        region: 'global',
        backends: ['frontend-group-abc-service'],
        securityPolicy: 'frontend-edge-protection',
        forwardingRuleName: 'frontend-global-forwarding-rule'
      }
    ],
    armorPolicies: [
      {
        id: 'ca-1',
        name: 'frontend-edge-protection',
        description: 'OWASP Top 10 mitigation and Geo-blocking',
        type: 'CLOUD_ARMOR',
        rulesCount: 4,
        adaptiveProtection: true,
        rules: [
          {
            priority: 1000,
            action: 'allow',
            preview: false,
            description: 'Allow Corporate Office',
            match: 'IP Range',
            srcIpRanges: ['203.0.113.0/24', '198.51.100.0/24']
          },
          {
            priority: 2000,
            action: 'deny',
            preview: false,
            description: 'Block Embargoed Regions',
            match: 'Expression',
            expression: "origin.region_code == 'KP' || origin.region_code == 'IR'"
          },
          {
             priority: 3000,
             action: 'deny',
             preview: true,
             description: 'SQL Injection Block (Preview)',
             match: 'WAF Rule',
             expression: "evaluatePreconfiguredExpr('sqli-v33-stable')"
          },
          {
            priority: 2147483647,
            action: 'allow',
            preview: false,
            description: 'Default Rule',
            match: 'All Traffic'
          }
        ]
      }
    ],
    iamPolicy: [
      {
        role: 'roles/editor',
        members: ['group:frontend-devs@example.com']
      },
      {
        role: 'roles/compute.viewer',
        members: ['serviceAccount:audit-sa@host-project-prod-01.iam.gserviceaccount.com']
      },
      {
        role: 'roles/cloudsql.client',
        members: ['serviceAccount:frontend-sa@service-app-frontend-01.iam.gserviceaccount.com']
      }
    ],
    gkeClusters: [],
    lastScannedAt: DEFAULT_SCANNED_AT,
    stale: false
  },
  {
    projectId: 'data-analytics-dev',
    name: 'Data Analytics Dev',
    number: '555555555555',
    instances: [
      {
        id: 'i-4',
        name: 'jupyter-notebook-large',
        zone: 'europe-west1-b',
        machineType: 'n1-highmem-8',
        status: 'STOPPED',
        internalIp: '192.168.10.55',
        network: 'dev-vpc-custom',
        subnetwork: 'dev-notebooks',
        tags: ['notebook', 'dev'],
        labels: { env: 'dev', owner: 'data-team' }
      }
    ],
    vpcs: [
      {
        name: 'dev-vpc-custom',
        id: 'vpc-3',
        isSharedVpcHost: false,
        mtu: 1500,
        peerings: [
          {
             name: 'peering-to-prod-host',
             targetNetwork: 'projects/host-project-prod-01/global/networks/prod-shared-vpc',
             state: 'ACTIVE',
             exportCustomRoutes: false,
             importCustomRoutes: true
          }
        ],
        routes: [
           {
            id: 'rt-4',
            name: 'default-internet-gateway',
            network: 'dev-vpc-custom',
            destRange: '0.0.0.0/0',
            nextHop: 'Default Internet Gateway',
            priority: 1000
          },
          {
            id: 'rt-5',
            name: 'peering-route-prod-shared',
            network: 'dev-vpc-custom',
            destRange: '10.0.0.0/8',
            nextHop: 'peering-to-prod-host',
            priority: 1000,
            description: 'Route to Prod Shared VPC'
          }
        ],
        subnets: [
          {
            name: 'dev-notebooks',
            region: 'europe-west1',
            ipCidrRange: '192.168.10.0/24',
            gatewayIp: '192.168.10.1',
            privateGoogleAccess: true,
            selfLink: 'projects/data-analytics-dev/regions/europe-west1/subnetworks/dev-notebooks'
          }
        ]
      }
    ],
    firewallRules: [
       {
        id: 'fw-6',
        name: 'dev-allow-notebook-access',
        network: 'dev-vpc-custom',
        direction: 'INGRESS',
        priority: 1000,
        action: 'ALLOW',
        sourceRanges: ['1.2.3.4/32'], // Corporate VPN IP
        targetTags: ['notebook'],
        allowed: [{ IPProtocol: 'tcp', ports: ['8888', '443'] }]
      },
      {
        id: 'fw-7',
        name: 'deny-public-egress',
        network: 'dev-vpc-custom',
        direction: 'EGRESS',
        priority: 2000,
        action: 'DENY',
        description: 'Prevent data exfiltration',
        // Destination ranges in API are similar to source ranges for Egress, simplified for mock
        allowed: [], 
        denied: [{ IPProtocol: 'all' }]
      }
    ],
    loadBalancers: [
      {
        id: 'lb-2',
        name: 'internal-data-lb',
        type: 'INTERNAL_TCP',
        ipAddress: '192.168.10.99',
        protocol: 'TCP',
        portRange: '5432',
        region: 'europe-west1',
        backends: ['data-processing-backend'],
        forwardingRuleName: 'data-internal-forwarding-rule'
      }
    ],
    armorPolicies: [],
    iamPolicy: [
      {
        role: 'roles/bigquery.admin',
        members: ['group:data-scientists@example.com']
      },
      {
        role: 'roles/storage.objectViewer',
        members: ['allAuthenticatedUsers']
      },
      {
        role: 'roles/compute.instanceAdmin.v1',
        members: ['user:dev-lead@example.com'],
        condition: {
          title: 'Dev Hours Only',
          description: 'Access only during working hours',
          expression: 'request.time < timestamp("2024-01-01T00:00:00Z")'
        }
      }
    ],
    gkeClusters: [
       {
        id: 'gke-2',
        name: 'dev-data-cluster',
        location: 'europe-west1-b',
        network: 'dev-vpc-custom',
        subnetwork: 'dev-notebooks',
        status: 'RUNNING',
        clusterIpv4Cidr: '10.100.0.0/16',
        servicesIpv4Cidr: '10.101.0.0/20',
        masterIpv4Cidr: '172.16.0.32/28',
        privateCluster: true,
        nodePools: [
          { name: 'spark-pool', nodeCount: 1, machineType: 'n1-standard-4', version: '1.27.3-gke.100' }
        ],
        endpoint: '172.16.0.34',
        masterVersion: '1.27.3-gke.100',
        labels: { env: 'dev', workload: 'spark' },
        workloads: [
           { name: 'spark-master', namespace: 'data-processing', type: 'StatefulSet', status: 'OK', pods: '1/1', images: ['spark:3.4'] },
           { name: 'spark-worker', namespace: 'data-processing', type: 'StatefulSet', status: 'OK', pods: '4/4', images: ['spark:3.4'] }
        ],
        services: [
           { name: 'spark-ui', namespace: 'data-processing', type: 'ClusterIP', clusterIp: '10.101.0.50', ports: '8080/TCP' }
        ],
        pvcs: [
           { name: 'spark-data', namespace: 'data-processing', status: 'Bound', volume: 'pvc-9999-zzzz', capacity: '1Ti', storageClass: 'standard-rwo' }
        ],
        storageClasses: [
           { name: 'standard-rwo', provisioner: 'pd.csi.storage.gke.io', reclaimPolicy: 'Delete' }
        ],
        configMaps: [
           { 
             name: 'spark-conf', 
             namespace: 'data-processing', 
             data: { 
               'spark-defaults.conf': 'spark.master yarn\nspark.eventLog.enabled true', 
               'log4j.properties': 'log4j.rootCategory=INFO, console'
             } 
           }
        ],
        secrets: [
           { 
             name: 'hadoop-creds', 
             namespace: 'data-processing', 
             type: 'Opaque',
             data: { 'core-site.xml': 'PFhtbCB2ZXJzaW9uPSIxLjAiPz4...' }
           }
        ]
      }
    ],
    lastScannedAt: DEFAULT_SCANNED_AT,
    stale: false
  },
  {
    projectId: 'legacy-monolith',
    name: 'Legacy Monolith System',
    number: '111111111111',
    error: 'PERMISSION_DENIED: Compute Engine API not enabled or SA missing roles/compute.networkViewer',
    vpcs: [],
    instances: [],
    firewallRules: [],
    loadBalancers: [],
    armorPolicies: [],
    iamPolicy: [],
    gkeClusters: [],
    lastScannedAt: DEFAULT_SCANNED_AT,
    stale: true
  }
];
