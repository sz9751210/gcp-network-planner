import React, { useState, useMemo } from 'react';
import { GcpProject, GcpInstance, GcpVpc } from '../types';
import { parseCidr, checkOverlap } from '../utils/cidr';

interface Props {
  projects: GcpProject[];
}

interface TraceStep {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  type: 'FIREWALL' | 'ROUTE' | 'PEERING' | 'ENDPOINT';
}

export const ConnectivityAnalyzer: React.FC<Props> = ({ projects }) => {
  const [sourceInstanceId, setSourceInstanceId] = useState('');
  const [destIp, setDestIp] = useState('');
  const [protocol, setProtocol] = useState('TCP');
  const [port, setPort] = useState('80');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trace, setTrace] = useState<TraceStep[] | null>(null);

  // Flatten Instances for Selector
  const allInstances = useMemo(() => {
    return projects.flatMap(p => p.instances.map(i => ({...i, projectId: p.projectId})));
  }, [projects]);

  const simulateConnectivity = () => {
    setIsAnalyzing(true);
    setTrace(null);

    // Simulate delay
    setTimeout(() => {
       const steps: TraceStep[] = [];
       const source = allInstances.find(i => i.id === sourceInstanceId);
       
       if (!source) {
         setIsAnalyzing(false);
         return;
       }

       // 1. Source Endpoint
       steps.push({
         name: 'Source Endpoint',
         status: 'PASS',
         details: `Instance: ${source.name} (${source.internalIp}) in ${source.network}`,
         type: 'ENDPOINT'
       });

       // 2. Egress Firewall Check (Source)
       // Simplified logic: Check if any deny rule matches. In GCP default is allow egress implies unless denied.
       // Mock data has a "deny-public-egress" rule for 'data-analytics-dev'
       const sourceProject = projects.find(p => p.projectId === source.projectId);
       let egressAllowed = true;
       
       // Simplistic Mock Logic for demo
       if (source.network === 'dev-vpc-custom' && destIp === '8.8.8.8') {
          // Detect mock deny rule
          steps.push({
             name: 'Egress Firewall',
             status: 'FAIL',
             details: `Blocked by rule 'deny-public-egress' (Priority 2000). Traffic to ${destIp} is denied.`,
             type: 'FIREWALL'
          });
          egressAllowed = false;
       } else {
          steps.push({
             name: 'Egress Firewall',
             status: 'PASS',
             details: `Implied allowed or matched Allow rule.`,
             type: 'FIREWALL'
          });
       }

       if (egressAllowed) {
         // 3. Routing Check
         // Is Destination Local?
         const sourceVpc = sourceProject?.vpcs.find(v => v.name.includes(source.network.split(' ')[0])); // fuzzy match for mock
         
         // Find if destination is an internal instance known to us
         const destInstance = allInstances.find(i => i.internalIp === destIp);
         
         let routeFound = false;
         let peeringUsed = false;

         if (destInstance) {
            // Internal Traffic
            if (destInstance.network === source.network) {
                // Same Network
                steps.push({ name: 'Route', status: 'PASS', details: 'Local subnet route.', type: 'ROUTE' });
                routeFound = true;
            } else {
                // Cross VPC
                // Check if Peering exists in Mock Data
                if (sourceVpc?.peerings?.some(p => p.state === 'ACTIVE')) {
                   steps.push({ name: 'Route', status: 'PASS', details: 'Route found via VPC Peering.', type: 'ROUTE' });
                   steps.push({ name: 'VPC Peering', status: 'PASS', details: 'Peering connection is ACTIVE.', type: 'PEERING' });
                   routeFound = true;
                   peeringUsed = true;
                } else {
                   steps.push({ name: 'Route', status: 'FAIL', details: 'No route to destination network. Peering missing.', type: 'ROUTE' });
                }
            }
         } else {
            // External Traffic
            // Check for default gateway
            if (sourceVpc?.routes?.some(r => r.destRange === '0.0.0.0/0')) {
                steps.push({ name: 'Route', status: 'PASS', details: 'Default Internet Gateway found.', type: 'ROUTE' });
                routeFound = true;
            } else {
                steps.push({ name: 'Route', status: 'FAIL', details: 'No route to host.', type: 'ROUTE' });
            }
         }

         if (routeFound) {
             // 4. Ingress Firewall Check (Destination)
             if (destInstance) {
                 // Check destination project firewall rules
                 const destProject = projects.find(p => p.projectId === destInstance.projectId);
                 // Look for allow rule on destination port
                 const allowRule = destProject?.firewallRules.find(r => 
                    r.network.includes(destInstance.network.split(' ')[0]) && 
                    r.direction === 'INGRESS' && 
                    r.action === 'ALLOW' &&
                    r.allowed?.some(a => a.IPProtocol === 'all' || (a.IPProtocol === protocol.toLowerCase() && (!a.ports || a.ports.includes(port))))
                 );

                 if (allowRule) {
                     steps.push({
                        name: 'Ingress Firewall',
                        status: 'PASS',
                        details: `Matched Allow rule '${allowRule.name}' (Priority ${allowRule.priority}).`,
                        type: 'FIREWALL'
                     });
                     
                     // 5. Dest Endpoint
                     steps.push({
                        name: 'Destination Endpoint',
                        status: 'PASS',
                        details: `Packet delivered to ${destInstance.name} (${destInstance.internalIp}).`,
                        type: 'ENDPOINT'
                     });

                 } else {
                     steps.push({
                        name: 'Ingress Firewall',
                        status: 'FAIL',
                        details: `No ingress allow rule found for ${protocol}:${port} on destination.`,
                        type: 'FIREWALL'
                     });
                 }
             } else {
                 // External
                 steps.push({
                    name: 'External Handover',
                    status: 'PASS',
                    details: 'Packet handed off to External Gateway.',
                    type: 'ENDPOINT'
                 });
             }
         }
       }

       setTrace(steps);
       setIsAnalyzing(false);
    }, 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
       {/* Configuration Panel */}
       <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-full shadow-lg">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
             <div className="p-2 bg-blue-600 rounded-lg mr-3 shadow-lg shadow-blue-900/50">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             Connectivity Tests
          </h2>

          <div className="space-y-6 flex-grow">
             <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Source Instance</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={sourceInstanceId}
                  onChange={(e) => setSourceInstanceId(e.target.value)}
                >
                   <option value="">Select an instance...</option>
                   {allInstances.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.internalIp})</option>
                   ))}
                </select>
             </div>

             <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Destination IP Address</label>
                <input 
                   type="text" 
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                   placeholder="e.g. 10.0.1.5"
                   value={destIp}
                   onChange={(e) => setDestIp(e.target.value)}
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Protocol</label>
                   <select 
                     className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                     value={protocol}
                     onChange={(e) => setProtocol(e.target.value)}
                   >
                      <option value="TCP">TCP</option>
                      <option value="UDP">UDP</option>
                      <option value="ICMP">ICMP</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Port</label>
                   <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                   />
                </div>
             </div>
          </div>

          <button 
             onClick={simulateConnectivity}
             disabled={isAnalyzing || !sourceInstanceId || !destIp}
             className="mt-8 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
             {isAnalyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Tracing Packet Path...
                </>
             ) : 'Run Connectivity Test'}
          </button>
       </div>

       {/* Visualization Panel */}
       <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-8 flex flex-col justify-center relative overflow-hidden">
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
          
          {!trace && !isAnalyzing && (
             <div className="text-center text-slate-500">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                   <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-slate-400">Ready to Test</h3>
                <p className="max-w-xs mx-auto mt-2 text-sm">Configure the packet parameters on the left and run the simulation to visualize the network path.</p>
             </div>
          )}

          {trace && (
             <div className="relative z-10 max-w-2xl mx-auto w-full">
                {/* Connecting Line */}
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-700"></div>

                {trace.map((step, idx) => (
                   <div key={idx} className="relative flex items-start mb-8 last:mb-0 animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                      {/* Icon Bubble */}
                      <div className={`
                         relative z-10 w-12 h-12 rounded-full border-4 flex items-center justify-center shrink-0 shadow-xl
                         ${step.status === 'PASS' ? 'bg-slate-900 border-green-500 text-green-500' : 'bg-slate-900 border-red-500 text-red-500'}
                      `}>
                         {step.type === 'ENDPOINT' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>}
                         {step.type === 'FIREWALL' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                         {step.type === 'ROUTE' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
                         {step.type === 'PEERING' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                      </div>

                      {/* Content */}
                      <div className="ml-6 bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-md w-full">
                         <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-slate-200">{step.name}</h4>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${step.status === 'PASS' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                               {step.status}
                            </span>
                         </div>
                         <p className="text-sm text-slate-400">{step.details}</p>
                      </div>
                   </div>
                ))}

                {/* Final Result */}
                <div className={`mt-8 text-center p-4 rounded-lg border animate-in zoom-in-95 duration-500 delay-300 ${trace[trace.length-1].status === 'PASS' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                   <h3 className={`text-xl font-bold ${trace[trace.length-1].status === 'PASS' ? 'text-green-400' : 'text-red-400'}`}>
                      {trace[trace.length-1].status === 'PASS' ? 'Connectivity Verified' : 'Connectivity Failed'}
                   </h3>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};