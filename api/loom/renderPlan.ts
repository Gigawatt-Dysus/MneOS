import { Request, Response } from 'express';
import { dispatchToFal } from './comfyWorker';
// Define the expected schemas based on ADR-013
interface RenderPlanInput {
  asset_id: string;
  role: string;
}

interface RenderPlan {
  type: 'render_plan';
  pipeline_id: string;
  layers_touched: string[];
  discuss_gate_passed: boolean;
  inputs: RenderPlanInput[];
  prompt: string;
  technicals: {
    aspect: string;
    backend: string;
    workflow: string;
    steps: number;
  };
  review_checklist: string[];
}

interface Discussion {
  type: 'discussion';
  gate_reason: string[];
  timelines: { label: string; beat: string }[];
  options: string[];
  recommended: string;
  draft_prompts: { still?: string; video?: string };
}

// Complexity scoring logic based on ADR-013 Discuss Gate
function calculateComplexityScore(plan: RenderPlan, userMessage: string): { score: number, reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Rule 1: Duration >= 10s or "15s" (Inferred from pipeline_id or prompt for now)
  if (plan.pipeline_id.includes('15s') || plan.pipeline_id.includes('10s') || plan.prompt.includes('15s')) {
    score += 2;
    reasons.push('Duration >= 10s');
  }

  // Rule 2: >= 3 @asset refs
  if (plan.inputs && plan.inputs.length >= 3) {
    score += 2;
    reasons.push('3+ references');
  }

  // Rule 3: Keywords: continue, face swap, sing, lyrics
  const keywords = ['continue', 'face swap', 'sing', 'lyrics'];
  const hasKeyword = keywords.some(k => userMessage.toLowerCase().includes(k) || plan.prompt.toLowerCase().includes(k));
  if (hasKeyword) {
    score += 2;
    reasons.push('Trigger keyword used');
  }

  // Rule 4: Pipeline touches identity + scene + wardrobe in one pass
  if (plan.layers_touched) {
    const hasIdentity = plan.layers_touched.includes('identity');
    const hasScene = plan.layers_touched.includes('scene');
    const hasWardrobe = plan.layers_touched.includes('wardrobe');
    if (hasIdentity && hasScene && hasWardrobe) {
      score += 2;
      reasons.push('Identity + Scene + Wardrobe modification in one pass');
    }
  }

  return { score, reasons };
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { payload, userMessage = '' } = req.body;

    if (!payload || !payload.type) {
      return res.status(400).json({ error: 'Invalid payload structure. Missing type.' });
    }

    if (payload.type === 'discussion') {
      // Grok already generated a discussion, just echo it back or log it
      console.log('[Loom] Discussion payload received from Grok.');
      return res.status(200).json({ status: 'discussion_required', data: payload });
    }

    if (payload.type === 'render_plan') {
      const plan = payload as RenderPlan;
      
      // Calculate Complexity Score (Discuss Gate)
      const { score, reasons } = calculateComplexityScore(plan, userMessage);
      
      // Check overrides
      const hasOverride = userMessage.toLowerCase().includes('render') || userMessage.toLowerCase().includes('go');
      
      if (score >= 4 && !hasOverride) {
        console.log(`[Loom] 🛑 Discuss Gate Triggered. Score: ${score}. Reasons: ${reasons.join(', ')}`);
        
        // Formulate an automatic discussion response if Grok didn't catch it
        const fallbackDiscussion: Discussion = {
          type: 'discussion',
          gate_reason: reasons,
          timelines: [
            { label: "0-5s", beat: "Initial render stabilization" },
            { label: "5s+", beat: "High risk of drift" }
          ],
          options: ["proceed_anyway", "split_render", "refine_prompt"],
          recommended: "split_render",
          draft_prompts: {
            still: plan.prompt
          }
        };
        
        return res.status(200).json({ 
          status: 'discuss_gate_triggered', 
          score, 
          data: fallbackDiscussion 
        });
      }

      // Passed the Discuss Gate (or overridden)
      console.log(`[Loom] ✅ RenderPlan Validated (Score: ${score}). Applying Director's Loop Biometrics...`);

      // --- BIOMETRIC INJECTION (DIRECTOR'S LOOP) ---
      // Hard-anchor the Brita biometric profile to ensure anatomical stability and identity lock.
      const BRITA_ANCHOR = "brita_stealth_v1, ultra-realistic photograph, masterpiece, cinematic lighting, sharp focus, RAW photo, 8k uhd, dslr, soft illumination, high quality, highly detailed face";
      const NEGATIVE_ANCHOR = "illustration, 3d, 2d, painting, cartoons, sketch, bad anatomy, bad hands, mutated hands, extra fingers, deformed, polydactyly, generic face, plastic";

      // Surgically inject the structural anchors
      plan.prompt = `${BRITA_ANCHOR}, ${plan.prompt}`;
      (plan as any).negative_prompt = NEGATIVE_ANCHOR;

      console.log(`[Loom] 🧬 Biometric Lock Engaged. Dispatching to Sovereign Forge...`);
      
      const dispatchResult = await dispatchToFal(plan);

      if (!dispatchResult.success) {
         return res.status(500).json({ error: 'Sovereign Dispatch Failed', details: dispatchResult.error });
      }

      // Send immediate completed response since Fal is synchronous/fast
      res.status(200).json({
        status: 'completed',
        imageUrl: dispatchResult.image_url,
        clientId: dispatchResult.client_id,
        message: 'Render completed by Sovereign Forge',
        plan
      });

      return;
    }

    return res.status(400).json({ error: 'Unknown payload type.' });

  } catch (error) {
    console.error('[Loom] RenderPlan Validation Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
