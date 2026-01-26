import React, { useState, useMemo } from 'react';
import { GcpProject, CidrConflict } from '../types';
import { checkOverlap, parseCidr } from '../utils/cidr';
import { suggestNextAvailableCidr } from '../services/geminiService';

interface Props {
  projects: GcpProject[];
}

export const CidrPlanner: React.FC<Props> = ({ projects }) => {
  const [inputCidr, setInputCidr] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  
  // Flatten all subnets
  const allSubnets = useMemo(() => {
    return projects.flatMap(p => 
      p.vpcs.flatMap(v => 
        v.subnets.map(s => ({
          ...s,
          projectId: p.projectId,
          vpcName: v.name
        }))
      )
    );
  }, [projects]);

  const conflictResult: CidrConflict | null = useMemo(() => {
    // Reset suggestion when input changes manually
    if (suggestion && inputCidr !== suggestion) {
        setSuggestion(null);
    }

    if (!inputCidr || !inputCidr.includes('/') || !parseCidr(inputCidr)) {
      return null;
    }

    const conflicts = allSubnets.filter(s => checkOverlap(inputCidr, s.ipCidrRange));

    return {
      hasConflict: conflicts.length > 0,
      conflictingSubnets: conflicts.map(c => ({
        projectId: c.projectId,
        vpcName: c.vpcName,
        subnetName: c.name,
        cidr: c.ipCidrRange
      }))
    };
  }, [inputCidr, allSubnets]);

  const isValidFormat = inputCidr.length === 0 || !!parseCidr(inputCidr);

  const handleAiFix = async () => {
    if (!conflictResult?.hasConflict) return;
    
    setIsSuggesting(true);
    const prefix = parseInt(inputCidr.split('/')[1], 10);
    
    // Call AI Service
    const suggestedCidr = await suggestNextAvailableCidr(projects, inputCidr, prefix);
    
    if (suggestedCidr) {
        setSuggestion(suggestedCidr);
        setInputCidr(suggestedCidr);
    }
    setIsSuggesting(false);
  };

  return (
    <div className="flex gap-6 h-full items-start">
      {/* Input Panel */}
      <div className="w-1/3 bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-sm flex flex-col h-[500px]">
         <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Check CIDR Availability
        </h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Planned Subnet CIDR</label>
          <div className="relative">
            <input
              type="text"
              className={`block w-full rounded-md border-0 bg-slate-900 py-3 pl-4 pr-10 text-white shadow-sm ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6 transition-all ${
                !isValidFormat ? 'ring-red-500 focus:ring-red-500' : 
                conflictResult?.hasConflict ? 'ring-red-500/50 focus:ring-red-500' : 'ring-slate-600 focus:ring-blue-500'
              }`}
              placeholder="e.g. 10.0.10.0/24"
              value={inputCidr}
              onChange={(e) => setInputCidr(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {inputCidr && isValidFormat && (
                conflictResult?.hasConflict 
                  ? <span className="text-red-500 font-bold animate-pulse">✕</span>
                  : <span className="text-green-500 font-bold">✓</span>
              )}
            </div>
          </div>
          {!isValidFormat && <p className="mt-2 text-xs text-red-400">Invalid CIDR format (e.g., 10.0.0.0/24).</p>}
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            This tool scans all {allSubnets.length} subnets across your organization to ensure the proposed range does not overlap with existing infrastructure.
          </p>
        </div>

        {/* Action Area */}
        <div className="mt-auto">
        {inputCidr && isValidFormat && (
          <div className={`rounded-lg p-4 border transition-all duration-300 ${conflictResult?.hasConflict ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
             <div className="flex items-center mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${conflictResult?.hasConflict ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                   {conflictResult?.hasConflict 
                      ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                   }
                </div>
                <div>
                    <h3 className={`font-semibold ${conflictResult?.hasConflict ? 'text-red-400' : 'text-green-400'}`}>
                    {conflictResult?.hasConflict ? 'Conflict Detected' : 'CIDR Available'}
                    </h3>
                    {conflictResult?.hasConflict && (
                        <p className="text-xs text-red-300/70 mt-0.5">Overlap with existing resources</p>
                    )}
                </div>
             </div>
             
             {conflictResult?.hasConflict && (
                 <button 
                    onClick={handleAiFix}
                    disabled={isSuggesting}
                    className="mt-3 w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 border border-red-700 text-white py-2 rounded-md text-sm font-medium transition-all shadow-lg shadow-red-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                    {isSuggesting ? (
                        <>
                           <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           Calculating alternative...
                        </>
                    ) : (
                        <>
                           <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           <span>Auto-Fix with AI</span>
                        </>
                    )}
                 </button>
             )}
          </div>
        )}
        </div>
      </div>

      {/* Results / Visualizer Panel */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 p-6 min-h-[500px]">
          <h3 className="text-md font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700">Analysis Results</h3>

          {!inputCidr ? (
             <div className="flex flex-col items-center justify-center h-80 text-slate-500">
                <div className="w-20 h-20 bg-slate-700/30 rounded-full flex items-center justify-center mb-6 border border-slate-600/50">
                    <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                </div>
                <p className="text-lg font-medium text-slate-400">Waiting for input</p>
                <p className="text-sm mt-2 max-w-xs text-center">Enter a CIDR block to validate it against your entire organization's topology.</p>
             </div>
          ) : !isValidFormat ? (
             <div className="flex flex-col items-center justify-center h-80 text-slate-500">
                 <p className="italic">Please enter a valid CIDR (e.g. 10.0.0.0/24)</p>
             </div>
          ) : conflictResult?.hasConflict ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-red-300 mb-4 flex items-center">
                  <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1 rounded text-sm mr-2 font-mono">{inputCidr}</span>
                  conflicts with {conflictResult.conflictingSubnets.length} existing subnet(s):
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-700 shadow-xl">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">VPC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Subnet</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Range</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800 divide-y divide-slate-700">
                    {conflictResult.conflictingSubnets.map((c, idx) => (
                      <tr key={idx} className="hover:bg-red-900/10 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">{c.projectId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{c.vpcName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{c.subnetName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-400 bg-red-900/10 px-2 rounded w-fit">{c.cidr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center animate-in fade-in zoom-in-95 duration-500">
               <div className="relative mb-6">
                   <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full"></div>
                   <div className="relative w-24 h-24 bg-emerald-900/20 border border-emerald-500/30 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
               </div>
               <h4 className="text-2xl font-bold text-white mb-2">Range Available</h4>
               <p className="text-slate-400 max-w-md leading-relaxed">
                 <span className="font-mono text-emerald-400 font-bold">{inputCidr}</span> is safe to provision. <br/>No overlaps found in current topology.
               </p>
               
               {suggestion && (
                   <div className="mt-6 bg-indigo-900/20 border border-indigo-500/30 px-4 py-2 rounded-full text-indigo-300 text-sm flex items-center">
                       <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       Suggestion applied by AI Assistant
                   </div>
               )}
            </div>
          )}
      </div>
    </div>
  );
};