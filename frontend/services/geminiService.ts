import { GoogleGenAI } from "@google/genai";
import { GcpProject } from "../types";

// NOTE: In a real app, strict error handling for missing API KEY is needed.
// For this demo, we assume environment variable or user input handled elsewhere.
// But as per instructions, we rely on process.env.API_KEY

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const analyzeNetworkTopology = async (
  projects: GcpProject[],
  userQuery: string
): Promise<string> => {
  try {
    const ai = getClient();
    if (!ai) return "Error: API Key is not configured.";
    
    // Prepare a summarized context to save tokens, focusing on structure
    const context = projects.map(p => {
      if (p.error) return `Project: ${p.projectId} (Error: ${p.error})`;
      return `Project: ${p.projectId}
      VPCs: ${p.vpcs.map(v => 
        `  - ${v.name} (${v.isSharedVpcHost ? 'Shared Host' : 'Standard'}): [${v.subnets.map(s => s.ipCidrRange).join(', ')}]`
      ).join('\n')}`;
    }).join('\n\n');

    const prompt = `
    You are a Google Cloud Network Expert. I have the following network topology:
    
    ${context}

    User Question: ${userQuery}

    Please provide a concise, technical answer. If suggesting a new CIDR, ensure it doesn't overlap with the existing ones listed above.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No response generated.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error trying to analyze your network. Please try again later.";
  }
};

export const suggestNextAvailableCidr = async (
  projects: GcpProject[],
  conflictingCidr: string,
  targetMask: number
): Promise<string> => {
  try {
    const ai = getClient();
    if (!ai) return "Cannot connect to AI service.";

    // Simplify context for this specific task
    const subnetList = projects.flatMap(p => 
      p.vpcs.flatMap(v => v.subnets.map(s => s.ipCidrRange))
    ).join(', ');

    const prompt = `
    Task: Network Planning
    Existing Subnets: [${subnetList}]
    
    The user wants to create a subnet with size /${targetMask} but tried ${conflictingCidr} which conflicted.
    
    Please suggest the NEXT available valid private CIDR block (RFC 1918) of size /${targetMask} that does NOT overlap with any existing subnets.
    Prefer the 10.x.x.x range if possible, or close to the conflicting attempt.
    
    Return ONLY the CIDR string (e.g., "10.0.5.0/24"). Do not add explanation.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return "";
  }
}