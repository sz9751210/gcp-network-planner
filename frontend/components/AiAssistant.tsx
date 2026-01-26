import React, { useState } from 'react';
import { GcpProject } from '../types';
import { analyzeNetworkTopology } from '../services/geminiService';

interface Props {
  projects: GcpProject[];
}

export const AiAssistant: React.FC<Props> = ({ projects }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResponse('');
    
    // Simulate thinking if API Key is not set, or call actual service
    const result = await analyzeNetworkTopology(projects, query);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 flex flex-col h-full bg-gradient-to-br from-slate-800 to-indigo-950/30">
      <h2 className="text-lg font-semibold text-white mb-2 flex items-center">
        <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        AI Network Architect
      </h2>
      <p className="text-xs text-slate-400 mb-4">Powered by Gemini 2.5 Flash</p>

      <div className="flex-grow bg-slate-900/80 rounded-lg p-4 mb-4 border border-slate-700/50 overflow-y-auto min-h-[150px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-indigo-400 animate-pulse">
            Analyzing network topology...
          </div>
        ) : response ? (
          <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {response}
          </div>
        ) : (
          <div className="text-slate-600 text-sm italic">
            Ask me anything about your network topology. <br/>
            Examples:<br/>
            - "Suggest a non-overlapping /24 block in us-central1."<br/>
            - "Which project has the most subnets?"<br/>
            - "Are there any Shared VPCs?"
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          className="block w-full rounded-md border-0 bg-slate-900 py-3 pl-4 pr-12 text-white shadow-sm ring-1 ring-inset ring-slate-600 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
          placeholder="Ask Gemini..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
        />
        <button 
          onClick={handleAsk}
          disabled={loading}
          className="absolute right-2 top-2 p-1 bg-indigo-600 rounded hover:bg-indigo-500 disabled:opacity-50 text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
};