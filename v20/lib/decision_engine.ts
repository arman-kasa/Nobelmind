// [FILE: lib/decision_engine.ts]
import { createClient } from './supabase';
import { createHash } from 'crypto';

export interface DecisionResult {
  action: 'RELEASE' | 'HOLD' | 'DISPUTE';
  scores: {
    delivery_score: number;
    behavior_score: number;
    risk_score: number;
    history_score: number;
  };
  reasons: string[];
  reason: string[];
  decision_hash: string;
  rule_id: string; // Added for Admin Logging consistency
}

/**
 * PRODUCTION DECISION ENGINE (v2.1.0)
 * -----------------------------------
 * Orchestrates: 
 * 1. Raw Event Logging (Audit Trail)
 * 2. Complex Logic Evaluation (Your Rules)
 * 3. Hashing (Security)
 * 4. Decision Logging (Immutable Record)
 */
export const evaluateMilestoneRelease = async (
  milestoneId: string,
  projectId: string,
  freelancerId: string // Optional if system trigger
): Promise<DecisionResult> => {
  const supabase = createClient();

  // 1. Fetch Comprehensive Data
  const { data: milestone } = await supabase.from('milestones').select('*').eq('id', milestoneId).single();
  const { data: project } = await supabase.from('projects').select('*, rule_version').eq('id', projectId).single();
  
  // Handle case where freelancerId might not be passed explicitly
  const targetFreelancerId = freelancerId || milestone?.freelancer_id;
  const { data: freelancer } = await supabase.from('profiles').select('*').eq('id', targetFreelancerId).single();
  
  if (!milestone || !project) throw new Error("Critical Data Missing for Decision Engine");

  // 2. [NEW ARCHITECTURE] LOG THE RAW EVENT FIRST
  // This ensures we have a record that a decision was requested, before we calculate it.
  const eventPayload = {
      milestone_status: milestone.status,
      submission_url: milestone.submission_file_url,
      amount: milestone.amount,
      due_date: milestone.due_date,
      timestamp: new Date().toISOString()
  };

  const { data: eventLog } = await supabase.from('event_logs').insert({
      project_id: projectId,
      milestone_id: milestoneId,
      event_type: 'DECISION_REQUESTED',
      actor_role: 'system', // Engine triggered
      payload: eventPayload
  }).select().single();

  // =========================================================
  // CORE LOGIC EVALUATION (YOUR RULES RESTORED)
  // =========================================================
  const reasons: string[] = [];
    const reason: string[] = [];
  let delivery_score = 0;
  let behavior_score = 100;
  let risk_score = 0;
  let history_score = 100;
  let rule_id = 'RULE_UNKNOWN'; // To identify which logic block triggered the result

  // --- RULE 1: Delivery Exists (Check files) ---
  if (milestone.submission_file_url && milestone.submission_file_url.length > 5) {
      delivery_score = 100;
      {
        reasons.push("File submission detected.");
        reason.push("File submission detected.");
      }
  } else {
      delivery_score = 0;
      {
        reasons.push("No file submission found.");
        reason.push("No file submission found.");
      }
  }

  // --- RULE 2: Timing Rule (Delay vs Deadline) ---
  const now = new Date();
  const due = new Date(milestone.due_date);
  if (now > due) {
      const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
      behavior_score -= (diffDays * 5); // -5 points per day late
      if(behavior_score < 0) behavior_score = 0;
      {
        reasons.push(`Submission is ${diffDays} days late.`);
        reason.push(`Submission is ${diffDays} days late.`);
      }
  } else {
      {
        reasons.push("Submission is on time.");
        reason.push("Submission is on time.");
      }
  }

  // --- RULE 3: History Rule (Previous Disputes/Trust Score) ---
  history_score = freelancer?.trust_score || 100;
  if (history_score < 80) {
      {
        reasons.push(`User trust score is low (${history_score}%).`);
        reason.push(`User trust score is low (${history_score}%).`);
        risk_score += 20; // Increase risk for low trust users
      }
  }

  // --- RULE 4: Amount Risk (High Value Transaction) ---
  const amount = parseFloat(milestone.amount);
  if (amount > 1000) {
      
      risk_score += 50;
      reasons.push("High value transaction (>1000 USDT) triggers enhanced security.");
      reason.push("High value transaction (>1000 USDT) triggers enhanced security.");
      
  } else {
      risk_score += 10;
  }

  // =========================================================
  // SCORING LOGIC & THRESHOLDS
  // =========================================================
  let action: 'RELEASE' | 'HOLD' | 'DISPUTE' = 'HOLD';

  if (delivery_score >= 75 && behavior_score >= 70 && risk_score <= 40) {
      action = 'RELEASE';
      rule_id = 'RULE_AUTO_RELEASE_PASS';
  } else if (risk_score >= 70) {
      action = 'HOLD'; 
      rule_id = 'RULE_HIGH_RISK_HOLD';
      reasons.push("Risk score exceeded safety threshold.");
      reason.push("Risk score exceeded safety threshold.");
  } else if (delivery_score < 50) {
      action = 'DISPUTE';
      rule_id = 'RULE_QUALITY_FAIL';
      reasons.push("Delivery quality/presence failed minimum checks.");
      reason.push("Delivery quality/presence failed minimum checks.");
  } else {
      // Fallback for edge cases
      action = 'HOLD';
      rule_id = 'RULE_MANUAL_REVIEW_NEEDED';
  }

  // =========================================================
  // BLOCKCHAIN PROOF LAYER (Hashing)
  // =========================================================
  // Include Rule ID and Scores in the hash for integrity
  const dataToHash = `${projectId}|${milestoneId}|${action}|${rule_id}|${risk_score}|${Date.now()}`;
  const decision_hash = createHash('sha256').update(dataToHash).digest('hex');

  // =========================================================
  // [NEW ARCHITECTURE] IMMUTABLE DECISION LOG
  // =========================================================
  // This is what makes it show up in your new Admin Dashboard
  await supabase.from('decision_logs').insert({
      project_id: projectId,
      milestone_id: milestoneId,
      event_type: 'RULE_EVALUATION',
      actor_id: null, // System
      input_event_ids: eventLog ? [eventLog.id] : [], // Link to the raw event we logged above
      
      // Mapped Scores
      risk_score: risk_score,
      confidence_score: delivery_score, // Mapping delivery confidence to confidence_score column
      
      // Decision Data
      final_decision: action,
      recommendation: action,
      rule_version: project.rule_version || '2.1.0',
      rule_id: rule_id,
      
      // Security
      system_hash: decision_hash,
      log_hash: decision_hash, // Redundant but safe for UI compatibility
      
      // Audit details
      prev_state: { status: milestone.status },
      next_state: { recommended_action: action, reasons: reasons ,reason : reasons}
  });

  return {
    action,
    scores: { delivery_score, behavior_score, risk_score, history_score },
    reasons,
    reason,
    decision_hash,
    rule_id
  };
};