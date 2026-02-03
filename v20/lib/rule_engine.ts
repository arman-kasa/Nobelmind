/**
 * DETERMINISTIC RULE ENGINE (v2.0.0)
 * ----------------------------------
 * Pure Logic Layer. No DB connections here.
 * Returns precise Rule IDs and Confidence Scores.
 */

export const CURRENT_RULE_VERSION = '2.0.0';

export interface RuleInputs {
    project_status: string;
    wallet_balance: number;
    budget_required: number;
    file_uploaded: boolean;
    client_sentiment: number; // 0-100
    dispute_active: boolean;
    days_since_submission: number; // For silence timeout
    settings: {
        min_sentiment: number;
        auto_release_days: number;
    };
}

export interface RuleOutput {
    decision: 'RELEASE' | 'HOLD' | 'DISPUTE' | 'PENDING';
    rule_id: string;
    reason: string;
    confidence: number;
    risk_score: number;
}

export const evaluateProjectRules = (inputs: RuleInputs): RuleOutput => {
    // 1. FUNDING CHECK (Rule: FUND_GATE)
    if (inputs.wallet_balance < inputs.budget_required - 0.5) {
        return {
            decision: 'PENDING',
            rule_id: 'R01_INSUFFICIENT_FUNDS',
            reason: `Wallet balance (${inputs.wallet_balance}) below required budget.`,
            confidence: 100,
            risk_score: 0
        };
    }

    // 2. DISPUTE CHECK (Rule: DISPUTE_GATE)
    if (inputs.dispute_active) {
        return {
            decision: 'DISPUTE',
            rule_id: 'R02_ACTIVE_DISPUTE',
            reason: 'Project is flagged with an active dispute.',
            confidence: 100,
            risk_score: 100
        };
    }

    // 3. PROGRESS CHECK (No Work)
    if (!inputs.file_uploaded) {
        if (inputs.client_sentiment < inputs.settings.min_sentiment) {
             return {
                decision: 'HOLD',
                rule_id: 'R03_NO_WORK_BAD_SENTIMENT',
                reason: 'No work submitted and negative client sentiment.',
                confidence: 80,
                risk_score: 80
            };
        }
        return {
            decision: 'PENDING',
            rule_id: 'R04_WAITING_DELIVERY',
            reason: 'Funds secured, waiting for deliverable.',
            confidence: 100,
            risk_score: 10
        };
    }

    // 4. REVIEW CHECK (Work Exists)
    if (inputs.file_uploaded) {
        // Rule: Silence Timeout (Auto-Accept)
        if (inputs.days_since_submission >= inputs.settings.auto_release_days) {
            return {
                decision: 'RELEASE',
                rule_id: 'R05_SILENCE_TIMEOUT',
                reason: `Auto-release: No feedback for ${inputs.settings.auto_release_days} days.`,
                confidence: 95,
                risk_score: 5
            };
        }

        // Rule: Bad Sentiment
        if (inputs.client_sentiment < inputs.settings.min_sentiment) {
            return {
                decision: 'HOLD',
                rule_id: 'R06_BAD_SENTIMENT_CHECK',
                reason: 'Work submitted but client unhappy. Manual review required.',
                confidence: 70,
                risk_score: 65
            };
        }
        
        // Rule: Happy Path
        return {
            decision: 'RELEASE',
            rule_id: 'R07_STANDARD_RELEASE',
            reason: 'Funds match, File exists, Sentiment positive.',
            confidence: 90,
            risk_score: 0
        };
    }

    // Fallback
    return {
        decision: 'HOLD',
        rule_id: 'R99_UNKNOWN_STATE',
        reason: 'Unknown state combination.',
        confidence: 0,
        risk_score: 50
    };
};