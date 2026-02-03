// [FILE: V13/app/actions.ts]
'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto';
import { 
    checkRealEscrowBalance, 
    releaseOnChain, 
    refundOnChain 
} from '@/lib/blockchain'
import { evaluateMilestoneRelease } from '@/lib/decision_engine'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js';

// =================================================================
// TYPE DEFINITIONS & INTERFACES
// =================================================================
const isValidUUID = (uuid: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
};
/**
 * Helper: Records an immutable event for Event Sourcing architecture
 */
async function logProjectEvent(
    supabase: any, 
    projectId: string | null, 
    eventType: string, 
    payload: any, 
    actorId?: string,
    milestoneId?: string
) {
    try {
        let dbActorId: string | null = null;
        let dbActorRole = 'system';

        if (actorId && isValidUUID(actorId)) {
            dbActorId = actorId;
            // Fetch precise role from profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('user_type')
                .eq('id', actorId)
                .single();
            
            // Set role to 'client' or 'freelancer' if found, otherwise 'user'
            if (profile) {
                dbActorRole = profile.user_type; 
            } else {
                dbActorRole = 'user';
            }
        } else if (actorId) {
            // If it's a keyword like 'Admin_Override'
            dbActorRole = actorId;
        }

        const { error } = await supabase.from('event_logs').insert({
            project_id: projectId, 
            milestone_id: milestoneId || null,
            event_type: eventType,
            actor_id: dbActorId, 
            actor_role: dbActorRole,
            payload: payload,
            created_at: new Date().toISOString()
        });

        if (error) console.error(`[LOGGER] Failed to log ${eventType}:`, error.message);
    } catch (e) {
        console.error("[LOGGER] Exception:", e);
    }
}
/**
 * Standard response structure for server actions.
 * Helps frontend handle success/error states consistently.
 */
type ActionResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  data?: any;
  balance?: number;
  analysis?: any;
  fieldErrors?: Record<string, string[]>;
  txHash?: string;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================
/**
 * [NEW] Admin Client with Service Role (Bypasses RLS)
 * Use this ONLY for admin actions where no user is logged in.
 */
/**
 * [FIXED] Admin Client using standard 'createClient'
 * This bypasses the need for cookie handling since it's a server-to-server connection.
 */
function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // [تغییر مهم]: استفاده از createClient معمولی به جای createServerClient
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false, // جلوگیری از ذخیره سشن (چون ادمین است)
            autoRefreshToken: false,
        }
    });
}
/**
 * Creates a Supabase client specifically for Server Actions.
 * It handles cookie management automatically (get, set, remove).
 * This ensures that the user's session is correctly passed to the backend calls.
 */
async function createSupabaseServerClient() {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { 
            return cookieStore.get(name)?.value 
        },
        set(name: string, value: string, options: CookieOptions) { 
            try {
                cookieStore.set({ name, value, ...options }) 
            } catch (error) {}
        },
        remove(name: string, options: CookieOptions) { 
            try {
                cookieStore.set({ name, value: '', ...options }) 
            } catch (error) {}
        },
      },
    }
  )
}

/**
 * Helper to create a smart notification for a user.
 * It includes a link_url to redirect the user directly to the relevant context.
 * This function is critical for the Bell Icon integration in the Layout.
 * * @param supabase The supabase client instance
 * @param userId The recipient's UUID
 * @param content The text message of the notification
 * @param link The relative URL (e.g., /dashboard/projects/123)
 */
async function createNotification(supabase: any, userId: string, content: string, link: string) {
    if (!userId) return;
    try {
        await supabase.from('notifications').insert({
            user_id: userId,
            content: content,
            link_url: link, 
            is_read: false,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error("Notification Error:", error);
    }
}
/**
 * [NEW] Generate Secure Hash for Logs
 */
function generateLogHash(projectId: string, event: string, actor: string, timestamp: string): string {
    const data = `${projectId}|${event}|${actor}|${timestamp}|${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`;
    return createHash('sha256').update(data).digest('hex');
}
/**
 * [NEW] Fetch Full Dispute Evidence
 * This gathers all related data for a project to show in the Admin Evidence Room.
 */
export async function getDisputeEvidenceAction(projectId: string) {
  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role for Admin Access
  );
  
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('*, client:profiles!client_id(*), freelancer:profiles!freelancer_id(*)')
      .eq('id', projectId)
      .single();

    // 2. Event Logs (The Stream)
    const { data: events } = await supabase
      .from('event_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // 3. Decision Logs (The AI/Logic)
    const { data: decisions } = await supabase
      .from('decision_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // 4. Admin Overrides
    const { data: overrides } = await supabase
      .from('admin_override_logs')
      .select('*, admin:admin_id(email)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const { data: messages } = await supabase.from('messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    const { data: milestones } = await supabase.from('milestones').select('*').eq('project_id', projectId).order('order_index', { ascending: true });

    return {
      success: true,
      data: {
        project,
        events: events || [],
        decisionLogs: decisions || [],
        overrideLogs: overrides || [],
        messages: messages || [],
        milestones: milestones || []
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
/**
 * [NEW] Secure Log State Change
 */
async function logStateChange(
    supabase: any, 
    projectId: string | null, 
    eventType: string, 
    actorId: string | undefined | null, 
    prevState: any, 
    nextState: any, 
    reason: string
) {
    const timestamp = new Date().toISOString();
    // اگر پروژه null بود (مثل اکشن‌های کاربر)، از رشته "SYSTEM" استفاده کن
    const secureHash = generateLogHash(projectId || 'GLOBAL', eventType, actorId || 'system', timestamp);

    await supabase.from('decision_logs').insert({
        project_id: projectId, // می‌تواند null باشد اگر اسکیما اجازه دهد، یا باید هندل شود
        event_type: eventType,
        actor_id: actorId,
        prev_state: prevState,
        next_state: nextState,
        recommendation: 'ADMIN_ACTION',
        final_decision: reason,
        rule_version: '1.0.0',
        created_at: timestamp,
        log_hash: secureHash
    });
}
/**
 * [UPDATED] Resolve Dispute with Blockchain Execution
 */
export async function adminResolveDisputeAction(
    projectId: string, 
    resolution: string, 
    verdict: 'refund_client' | 'pay_freelancer'
) {
    const timestamp = new Date().toISOString();
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) return { error: "Project not found" };

    let txHash = null;
    try {
        if (verdict === 'refund_client') {
            const res = await refundOnChain(projectId);
            txHash = res.txHash;
        } else {
            // For full payout on resolve
            const realLockedAmount = await checkRealEscrowBalance(projectId);
            if (realLockedAmount <= 0) {
                 throw new Error(`Blockchain balance is zero (${realLockedAmount}). Nothing to release.`);
            }
            console.log(`[ADMIN DISPUTE] Releasing Full Locked Amount: ${realLockedAmount}`);
            const res = await releaseOnChain(projectId, realLockedAmount); 
            txHash = res.txHash;
        }
    } catch (e: any) {
        return { error: `Blockchain Error: ${e.message}. No changes saved.` };
    }

    // 3. Log to Override Logs (The Human Intervention)
      await supabase.from('admin_override_logs').insert({
          project_id: projectId,
          decision_log_id: null, // Can link to last decision if needed
          admin_id: null, // System Admin
          original_decision: 'DISPUTE_PENDING',
          new_decision: verdict.toUpperCase(),
          reason: `[TX: ${txHash}] ${resolution}`,
          created_at: timestamp
      });
      
    const nextStatus = verdict === 'refund_client' ? 'cancelled' : 'completed';
    await supabase.from('projects').update({ status: nextStatus, escrow_status: 'released' }).eq('id', projectId);
    
    await logProjectEvent(supabase, projectId, 'ADMIN_RESOLUTION', {
          verdict, resolution, tx_hash: txHash
      }, 'Admin_Override');
    revalidatePath('/admin');
    // Secure Log
    await logStateChange(
        supabase, projectId, 'ADMIN_DISPUTE_RESOLUTION', user?.id,
        { status: project.status }, { status: nextStatus, tx: txHash },
        resolution
    );

    await supabase.from('transactions').insert({
        project_id: projectId,
        type: verdict === 'refund_client' ? 'refund' : 'payout',
        status: 'confirmed',
        amount: project.budget,
        tx_hash: txHash
    });

    return { success: true };
}

/**
 * [UPDATED] Fetch Admin User List
 * Checks for admin cookie before calling DB
 */
export async function getAdminUsersListAction() {
    const cookieStore = cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';
    if (!isAdmin) return { error: "Unauthorized" };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_admin_users_stats');
    
    if (error) return { error: error.message };
    return { success: true, data };
}
/**
 * [NEW] Block/Unblock User
 */
export async function toggleUserBlockAction(userId: string, isBlocked: boolean, reason: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user: admin } } = await supabase.auth.getUser();

    const { error } = await supabase.from('profiles').update({ is_blocked: isBlocked }).eq('id', userId);
    if (error) return { error: error.message };
    
    await logProjectEvent(supabase, null, 'USER_MODERATION', { 
        action: isBlocked ? 'BLOCK' : 'UNBLOCK', reason 
    }, 'Admin', undefined);
    
    // Log User Moderation (No Project Context)
    await logStateChange(
        supabase, null, 'USER_MODERATION', admin?.id,
        { blocked: !isBlocked }, { blocked: isBlocked },
        reason
    );
    
    return { success: true };
}

export async function markManualPayoutDoneAction(txId: string, txHash: string) {
    const supabase = await createSupabaseServerClient();
    await supabase.from('transactions').update({ status: 'manual_done', tx_hash: txHash }).eq('id', txId);
    return { success: true };
}
// =================================================================
// 1. AUTHENTICATION ACTIONS
// =================================================================

/**
 * Handles user login via email and password.
 * Returns success or error message to be displayed on the form.
 */
export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  if (!email || !password) {
      return { error: "Email and password are required." }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login Error:", error.message)
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Handles new user registration.
 * Captures full name and intended role (client/freelancer).
 */
export async function signupAction(formData: FormData): Promise<ActionResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const role = formData.get('role') as string 

  if (!email || !password || !fullName) {
      return { error: "All fields are required." }
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role || 'client',
      },
    },
  })

  if (error) {
    console.error("Signup Error:", error.message)
    return { error: error.message }
  }

  return { success: true, message: 'Check your email for confirmation.' }
}

/**
 * Signs out the current user and redirects to auth page.
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/auth')
}

/**
 * Verifies the special admin access code to enter the admin dashboard.
 * Sets a secure cookie session for the admin (valid for 24 hours).
 */
export async function verifyAdminPassword(password: string) {
    const ADMIN_PASS = process.env.ADMIN_ACCESS_CODE || "AdmI150aesdVaxZ@1c#acz5";
    
    if (password === ADMIN_PASS) {
        const cookieStore = cookies()
        // Set admin session cookie for 24 hours
        cookieStore.set('admin_session', 'true', { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24,
            path: '/'
        }) 
        return { success: true }
    }
    return { success: false, error: "Invalid Access Code" }
}

// =================================================================
// 2. PROJECT MANAGEMENT ACTIONS
// =================================================================

/**
 * Creates a new project.
 * [UPDATE]: Instead of generating a new wallet address, we now assign 
 * the main ESCROW_CONTRACT_ADDRESS as the deposit target.
 * The uniqueness comes from the 'projectId' which is passed to the contract during deposit.
 */
export async function createProjectAction(prevState: any, formData: FormData) {
  // 1. Extract Data from FormData
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const budgetMax = parseFloat(formData.get('budgetMax') as string)
  const skillsString = formData.get('skills') as string
  const skills = skillsString ? skillsString.split(',').map(s => s.trim()) : []
  const CURRENT_RULE_VERSION = '1.0.0';
  const supabase = await createSupabaseServerClient()
  
  // 2. Check Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized: Please log in again.' }
  }

  // Variable to store the new project ID for redirection
  let newProjectId: string | null = null;

  try {
    // 3. Smart Contract Configuration
    // We use the single deployed contract address.
    const depositAddress = process.env.ESCROW_CONTRACT_ADDRESS;

    if (!depositAddress) {
        throw new Error("System Error: Escrow Contract Address not configured.");
    }

    // 4. [FIX] Calculate Next Wallet Index
    // We fetch the highest current index and add 1 to ensure uniqueness regarding the DB constraint
    const { data: lastProject } = await supabase
      .from('projects')
      .select('wallet_index')
      .order('wallet_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // If table is empty, start at 1. If not, increment last index.
    const nextIndex = (lastProject?.wallet_index ?? 0) + 1

    // 5. Insert Project into Database
    const { data, error } = await supabase
      .from('projects')
      .insert({
        title,
        description,
        budget: budgetMax,
        skills_required: skills,
        client_id: user.id,
        status: 'open',
        wallet_index: nextIndex, 
        deposit_address: depositAddress,
        chain_id: 137,
        escrow_status: 'none',
        rule_version: CURRENT_RULE_VERSION // <--- [NEW] فریز کردن نسخه قوانین
      })
      .select('id')
      .single()

    if (error) throw error
    
    // [NEW] ثبت ایونت CONTRACT_CREATED
    if (data) {
        newProjectId = data.id;
        // اصلاح: استفاده مستقیم از data.id
        await logProjectEvent(supabase, data.id, 'PROJECT_CREATED', {
            budget: budgetMax,
            rule_version: CURRENT_RULE_VERSION,
            currency: 'USDT'
        }, user.id);
    }

  } catch (error: any) {
    console.error("Create Project Error:", error);
    // Return error to the UI
    return { error: error.message || 'Failed to create project' }
  }
  
  // 6. Redirect (Must be outside try-catch)
  if (newProjectId) {
      redirect(`/dashboard/projects/${newProjectId}`)
  }
  
  return { error: "Project created but ID was missing." }
}

/**
 * Cancels a project.
 * Rules: Only the owner can cancel. Project must be 'open'.
 */
export async function cancelProjectAction(projectId: string): Promise<ActionResponse> {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { error: "Unauthorized" };

    // Fetch project to check ownership and status
    const { data: project } = await supabase
        .from('projects')
        .select('client_id, status, title')
        .eq('id', projectId)
        .single();

    if (!project) return { error: "Project not found." };
    
    if (project.client_id !== user.id) {
        return { error: "Only the project owner can cancel." };
    }
    
    if (project.status !== 'open') {
        return { error: "Cannot cancel a project that is already hired or completed." };
    }

    const { error } = await supabase
        .from('projects')
        .update({ status: 'cancelled' })
        .eq('id', projectId);
    
    if (error) return { error: error.message };
    await logProjectEvent(supabase, projectId, 'CONTRACT_CANCELLED', { reason: 'User Request' }, user.id);
    return { success: true, message: "Project cancelled successfully." };
}
/**
 * [NEW ACTION] Registers the real TX Hash from Client's Wallet immediately
 * Frontend must call this right after Metamask transaction succeeds.
 */
export async function registerDepositTxAction(projectId: string, txHash: string, amount: number) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: project } = await supabase.from('projects').select('status, escrow_status').eq('id', projectId).single();
    const prevState = {
        status: project?.status || 'unknown',
        escrow_status: project?.escrow_status || 'none',
        tx: null
    };

    const nextState = {
        status: 'in_progress',
        escrow_status: 'locked',
        tx: txHash,
        amount: amount
    };
    // 1. Update Project Status to Syncing/Locked
    await supabase.from('projects').update({ 
        escrow_status: 'locked',
        deposit_tx_hash: txHash,
        status: 'in_progress' // Start work immediately upon deposit proof
    }).eq('id', projectId);

    // 2. Insert into Transactions with REAL Hash
    await supabase.from('transactions').insert({
        project_id: projectId,
        type: 'deposit',
        amount: amount,
        token: 'USDT',
        tx_hash: txHash, // <--- [CRITICAL] هش واقعی اینجا ثبت میشه
        status: 'confirmed',
        created_at: new Date().toISOString()
    });
    
    await logProjectEvent(supabase, projectId, 'FUNDS_DEPOSITED', {
        amount: amount,
        tx_hash: txHash,
        wallet: 'CLIENT_METAMASK',
        note: 'Manual Registration'
    }, user?.id);
    
    // 3. Log into Decision Logs (For Admin View)
    // 4. Decision Log (Audit Trail with Prev/Next)
    await supabase.from('decision_logs').insert({
        project_id: projectId,
        event_type: 'FUNDS_DEPOSITED',
        
        prev_state: prevState,
        next_state: nextState,
        
        final_decision: 'DEPOSIT_CONFIRMED',
        recommendation: 'RELEASE',
        system_hash: txHash,
        log_hash: txHash,
        rule_version: '1.0.0',
        confidence_score: 100
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/admin`);
    return { success: true };
}
// =================================================================
// 3. PROPOSAL ACTIONS
// =================================================================

/**
 * Submits a proposal for a project.
 * Handles parsing milestones from JSON string received from the frontend form.
 */
export async function submitProposalAction(projectId: string, formData: FormData) {
  const coverLetter = formData.get('coverLetter') as string
  const price = parseFloat(formData.get('price') as string)
  const duration = formData.get('duration') as string
  const milestonesJson = formData.get('milestones') as string

  const supabase = await createSupabaseServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  let milestones = [];
  try {
      if (milestonesJson) milestones = JSON.parse(milestonesJson);
  } catch (e) {
      console.error("JSON Parse Error:", e);
      return { error: "Invalid milestone data format" }
  }

  const { error } = await supabase
    .from('proposals')
    .insert({
      project_id: projectId,
      freelancer_id: user.id,
      cover_letter: coverLetter,
      proposed_budget: price,
      timeline: duration,
      proposed_milestones: milestones, 
      status: 'pending'
    })

  if (error) {
    console.error("Submit Proposal Error:", error.message);
    return { error: error.message }
  }

  // NOTIFICATION: Notify Client with Link
  const { data: project } = await supabase
    .from('projects')
    .select('client_id, title')
    .eq('id', projectId)
    .single();

  if (project) {
      await createNotification(
          supabase, 
          project.client_id, 
          `New Proposal Received for "${project.title}"`, 
          `/dashboard/projects/${projectId}?tab=proposals`
      );
  }
  await logProjectEvent(supabase, projectId, 'PROPOSAL_SUBMITTED', {
      amount: price,
      milestone_count: milestones.length
  }, user.id);
  // Redirect is safe here as it's not wrapped in a catching block that catches 'Error' generically
  redirect(`/dashboard/projects/${projectId}`)
}

/**
 * [NEW] Accept Proposal (Hiring Action)
 * This creates the contract, updates project status, and NOTIFIES the freelancer.
 * Essential for the flow where client hires a freelancer.
 */
export async function acceptProposalAction(proposalId: string, projectId: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch Proposal
    const { data: proposal } = await supabase.from('proposals').select('*').eq('id', proposalId).single();
    if (!proposal) return { error: "Proposal not found" };

    // 2. PARSE MILESTONES (Fix for String/JSON mismatch)
    let milestonesData = proposal.proposed_milestones;
    if (typeof milestonesData === 'string') {
        try {
            milestonesData = JSON.parse(milestonesData);
        } catch (e) {
            console.error("Failed to parse milestones JSON:", e);
            milestonesData = [];
        }
    }

    // 3. Update Statuses (Proposal & Project)
    const { error: propError } = await supabase.from('proposals').update({ status: 'accepted' }).eq('id', proposalId);
    if (propError) return { error: "Proposal Update Failed: " + propError.message };
    
    await supabase.from('proposals').update({ status: 'rejected' }).eq('project_id', projectId).neq('id', proposalId);

    // [FIXED] Removed updated_at update which caused schema error
    const { error: projError } = await supabase.from('projects').update({ 
        status: 'hired', 
        freelancer_id: proposal.freelancer_id,
        budget: proposal.proposed_budget
    }).eq('id', projectId);

    if (projError) return { error: "Project Update Failed: " + projError.message };

    // 4. INSERT MILESTONES (With strict type conversion & field mapping)
    if (milestonesData && Array.isArray(milestonesData) && milestonesData.length > 0) {
        
        const milestonesToInsert = milestonesData.map((m: any, idx: number) => {
            // Safe Number Conversion
            const amountVal = typeof m.amount === 'string' ? parseFloat(m.amount.replace(/[^0-9.]/g, '')) : m.amount;
            const daysVal = typeof m.days === 'string' ? parseInt(m.days.replace(/[^0-9]/g, '')) : (m.days || 7);
            
            // Calculate Due Date
            const dueDate = m.due_date 
                ? new Date(m.due_date).toISOString() 
                : new Date(Date.now() + (daysVal * 24 * 60 * 60 * 1000)).toISOString();

            return {
                project_id: projectId,
                freelancer_id: proposal.freelancer_id,
                title: m.title || `Milestone ${idx + 1}`,
                // [FIXED] Mapped 'description' to 'deliverables' as per DB schema
                deliverables: m.deliverables || m.description || 'Deliverables not specified',
                amount: isNaN(amountVal) ? 0 : amountVal,
                order_index: idx,
                status: 'pending',
                due_date: dueDate
            };
        });

        const { error: insertError } = await supabase.from('milestones').insert(milestonesToInsert);
        
        if (insertError) {
             console.error("MILESTONE INSERT ERROR:", insertError);
             return { error: "Project set to Hired, BUT Milestones failed: " + insertError.message };
        }
    } else {
        console.warn("No milestones found in proposal to insert.");
    }

    await logProjectEvent(supabase, projectId, 'PROPOSAL_ACCEPTED', {
        freelancer_id: proposal.freelancer_id,
        agreed_budget: proposal.proposed_budget
    }, user?.id);

    // 6. EVENT: Hired Notification (To Freelancer) - Shows in Bell
    const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();
    await createNotification(
        supabase, 
        proposal.freelancer_id, 
        `🎉 You have been hired for "${project?.title}"! Awaiting client deposit.`, 
        `/dashboard/projects/${projectId}`
    );
    
    // Force cache refresh
    revalidatePath(`/dashboard/projects/${projectId}`);

    return { success: true };
}

/**
 * Rejects a specific proposal.
 */
export async function rejectProposalAction(proposalId: string, projectId: string) {
    const supabase = await createSupabaseServerClient();
    
    // Update status
    const { error } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalId);
        
    if (error) return { error: error.message };
    
    // NOTIFICATION: Notify Freelancer
    const { data: proposal } = await supabase
        .from('proposals')
        .select('freelancer_id')
        .eq('id', proposalId)
        .single();
        
    if (proposal) {
        await createNotification(
            supabase, 
            proposal.freelancer_id, 
            `Your proposal was rejected by the client.`, 
            `/dashboard/projects/${projectId}`
        );
    }

    return { success: true };
}

// =================================================================
// 4. CRYPTO DEPOSIT & ESCROW LOGIC
// =================================================================

/**
 * Initiates a deposit session.
 * For the Smart Contract version, this prepares the Payment Session 
 * which the frontend can use to call the Smart Contract 'deposit' function.
 */
export async function initiateDepositAction(projectId: string) {
    const supabase = await createSupabaseServerClient();
    
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) return { error: "Project not found" };

    // Set expiration for 59 minutes from now to allow for user action
    const expiresAt = new Date(Date.now() + 59 * 60 * 1000); 
    
    // Create/Update Payment Session record
    await supabase.from('payment_sessions').upsert({
        project_id: projectId,
        wallet_address: project.deposit_address, // This is the Smart Contract Address
        exact_amount: project.budget,
        token: 'USDT',
        expires_at: expiresAt.toISOString()
    });

    return { 
        address: project.deposit_address, // Front end calls deposit(projectId, ...) on this address
        amount: project.budget, 
        expires_at: expiresAt.toISOString(),
        projectId: projectId // Important for the contract call
    };
}

/**
 * Verifies if the funds have been LOCKED in the Smart Contract.
 * [UPDATED]: Now calls the real blockchain to check the contract mapping.
 * Removes all simulated delays and mocked logic.
 */
export async function verifyDepositAction(projectId: string) {
  const supabase = await createSupabaseServerClient()
  
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  
  if (!project || !project.deposit_address) {
      return { error: "Invalid Project Data" }
  }
  await new Promise(resolve => setTimeout(resolve, 10000));
  // 1. CHECK BLOCKCHAIN REAL BALANCE
  // We query the smart contract to see if 'lockedAmount' > 0 for this projectId
  let lockedBalance = await checkRealEscrowBalance(projectId);
  if (lockedBalance === 0) {
      console.log("Balance is 0, retrying check in 3s...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      lockedBalance = await checkRealEscrowBalance(projectId);
  }
  console.log(`Final Blockchain Check for ${projectId}: ${lockedBalance} USDT`);
  // Calculate required amount (checking strictly might be tough due to fees, so we check if > 0)
  // Ideally, lockedBalance should equal (budget - fee).
  const isFunded = lockedBalance > 0;

  // 2. Log Audit for Decision Engine
  await supabase.from('decision_logs').insert({
      project_id: projectId,
      rule_version: '1.0.0',
      recommendation: isFunded ? 'RELEASE' : 'HOLD',
      final_decision: `Blockchain Check: ${lockedBalance} USDT Locked. Status: ${isFunded ? 'FUNDED' : 'PENDING'}`,
      rules_triggered: ['Polygon Contract Verification'] 
  });

  if (isFunded) {
      // Check if not already locked to avoid double locking logic
      if (project.escrow_status !== 'locked') {
          
          // Logic: When funded, project moves to 'in_progress' and escrow is 'locked'
          const newStatus = 'in_progress';
          
          const { error } = await supabase.from('projects')
            .update({ 
                status: newStatus, 
                escrow_status: 'locked' 
            })
            .eq('id', projectId)

          if (error) {
              console.error("DB Update Failed:", error);
              return { error: "Database Update Failed" }
          }

          // Record Ledger Transaction (Deposit Confirmed)
          await supabase.from('transactions').insert({
              project_id: projectId,
              from_address: 'CLIENT_WALLET', // We don't know exact address here without event parsing, but it's fine
              to_address: process.env.ESCROW_CONTRACT_ADDRESS,
              amount: lockedBalance,
              token: 'USDT',
              tx_hash: `confirmed_on_chain_${Date.now()}`, // In a perfect world, we'd pass the txHash from frontend
              type: 'deposit',
              status: 'confirmed'
          })
          
          await logProjectEvent(supabase, projectId, 'FUNDS_DEPOSITED', {
                  amount: lockedBalance,
                  currency: 'USDT',
                  tx_hash: 'Escrow Secured',
                  method: 'AUTO_VERIFY'
              }, project.client_id);

          // NOTIFICATION: Notify Freelancer
          await createNotification(
              supabase, 
              project.freelancer_id, 
              `Escrow Secured! ${lockedBalance} USDT locked in Smart Contract. Start working.`, 
              `/dashboard/projects/${projectId}?tab=workspace`
          );

          // NOTIFICATION: Notify Client
          await createNotification(
              supabase, 
              project.client_id, 
              `Deposit Confirmed on Polygon. Funds are now safe.`, 
              `/dashboard/projects/${projectId}?tab=workspace`
          );
          await logProjectEvent(supabase, projectId, 'FUNDS_DEPOSITED', {
              amount: lockedBalance,
              currency: 'USDT',
              tx_method: 'SMART_CONTRACT'
          }, project.client_id);
          
          return { success: true, balance: lockedBalance, message: "Blockchain Verified. Escrow Locked." }
      }
      return { success: true, balance: lockedBalance, message: "Funds already locked." }

  } else {
      return { 
          success: false, 
          message: `Smart Contract not yet funded. Balance: ${lockedBalance} USDT. Please wait 30 seconds and click 'Check Status' again.` 
      }
  }
}

// =================================================================
// 5. MILESTONE & WORKFLOW ACTIONS
// =================================================================
export async function updateMilestoneStatusAction(
  milestoneId: string, 
  status: 'LOCKED' | 'ACTIVE' | 'SUBMITTED' | 'DISPUTED' | 'COMPLETED', 
  note?: string
) {
  const supabase = await createSupabaseServerClient();

  try {
    // 1. Fetch milestone
    const { data: milestone, error: fetchError } = await supabase
      .from('milestones')
      .select('project_id')
      .eq('id', milestoneId)
      .single();

    if (fetchError || !milestone) {
      return { error: 'Milestone not found' };
    }

    // 2. Prepare update data
    const updateData: any = { status };

    if (status === 'ACTIVE' && note) {
      updateData.submission_note = note; 
    }

    if (status === 'COMPLETED') {
      updateData.updated_at = new Date().toISOString();
    }

    // 3. Update DB
    const { error } = await supabase
      .from('milestones')
      .update(updateData)
      .eq('id', milestoneId);

    if (error) {
      console.error('Error updating milestone:', error);
      return { error: error.message };
    }

    revalidatePath(`/dashboard/projects/${milestone.project_id}`);

    return { success: true };

  } catch (err) {
    console.error('Server Action Error:', err);
    return { error: 'Internal Server Error' };
  }
}
/**
 * Freelancer Action: Submit work for a specific milestone.
 * Can include text notes and a file URL.
 */
export async function submitMilestoneWorkAction(
    milestoneId: string, 
    projectId: string, 
    submissionNotes: string,
    files: { name: string; url: string; size: number; type: string }[] // <--- ورودی جدید باید آرایه باشد
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  console.log("Submitting Milestone:", milestoneId, "Files:", files.length); // <--- برای دیباگ

  // 1. ذخیره فایل‌ها در جدول project_files
  if (files && files.length > 0) {
      const fileRecords = files.map(f => ({
          project_id: projectId,
          milestone_id: milestoneId,
          uploader_id: user.id,
          file_name: f.name,
          file_url: f.url,
          file_size: f.size,
          file_type: f.type
      }));
      
      const { error: fileError } = await supabase.from('project_files').insert(fileRecords);
      if (fileError) {
          console.error("File Save Error:", fileError);
          // اگر ارور SQL باشد (مثلا نبودن ستون milestone_id)، اینجا مشخص می‌شود
          return { error: "Database Error (Files): " + fileError.message };
      }
  }

  // 2. آپدیت وضعیت مایل‌ستون
  const { error } = await supabase.from('milestones').update({
    status: 'submitted',
    submission_note: submissionNotes,
    // برای سازگاری، اولین فایل را به عنوان فایل اصلی ست می‌کنیم
    submission_file_url: files.length > 0 ? files[0].url : null, 
    submission_date: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', milestoneId);

  if (error) {
      console.error("Milestone Update Error:", error);
      return { error: "Update Error: " + error.message };
  }
  
  // لاگ کردن ایونت
  await logProjectEvent(supabase, projectId, 'MILESTONE_SUBMITTED', {
      milestone_id: milestoneId,
      file_count: files.length,
      notes: submissionNotes
  }, user.id, milestoneId);

  // ارسال نوتیفیکیشن
  const { data: project } = await supabase.from('projects').select('client_id, title').eq('id', projectId).single();
  if (project) {
      await createNotification(
          supabase, project.client_id,
          `Milestone Submitted: "${project.title}". Check deliverables.`,
          `/dashboard/projects/${projectId}?tab=workspace`
      );
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
/**
 * AI Decision Engine Trigger.
 * Analyzes a milestone submission using the Rule Engine and stores the recommendation.
 */
export async function processMilestoneDecisionAction(milestoneId: string, projectId: string) {
    const supabase = await createSupabaseServerClient();
    
    // Fetch milestone data
    const { data: milestone } = await supabase
        .from('milestones')
        .select('*')
        .eq('id', milestoneId)
        .single();

    if (!milestone) return { error: "Milestone not found" };
    await logProjectEvent(supabase, projectId, 'AI_ANALYSIS_REQUESTED', { milestone_id: milestoneId }, 'system', milestoneId);
    // Run the Decision Engine Logic
    const analysis = await evaluateMilestoneRelease(milestoneId, projectId, milestone.freelancer_id);

    // Save the analysis result to the milestone
    await supabase.from('milestones').update({
        engine_decision: analysis,
        decision_hash: analysis.decision_hash
    }).eq('id', milestoneId);

    // Log the event in the immutable audit log with detailed reasons
    await supabase.from('decision_logs').insert({
        milestone_id: milestoneId,
        project_id: projectId,
        delivery_score: analysis.scores.delivery_score,
        behavior_score: analysis.scores.behavior_score,
        risk_score: analysis.scores.risk_score,
        recommendation: analysis.action,
        final_decision: analysis.action, // Default system decision unless overridden later
        rules_triggered: analysis.reasons, 
        rule_version: '1.0.0'
    });

    return { success: true, analysis };
}

/**
 * Client Action: Approve a milestone.
 * This triggers the REAL release of funds on the Blockchain.
 * [UPDATED]: Now calls `releaseOnChain` to execute Smart Contract payout.
 */
// [UPDATE THIS FUNCTION IN app/actions.ts]
export async function approveMilestoneAction(milestoneId: string, projectId: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    // 0. Security & Data Fetch
    const { data: milestone } = await supabase.from('milestones').select('amount, freelancer_id, status').eq('id', milestoneId).single();
    if (!milestone) return { error: "Milestone not found" };
    if (milestone.status === 'approved') return { error: "Already approved" };

    try {
        await logProjectEvent(supabase, projectId, 'RELEASE_INITIATED', { amount: milestone.amount }, user?.id, milestoneId);
        const FEE_PERCENT = 500; // این عدد باید دقیقاً همان feePercentage قرارداد باشد (500 = 5%)
        const feeRate = FEE_PERCENT / 10000; // 0.05
        
        // مبلغی که باید به تابع release قرارداد بفرستیم:
        const amountToRelease = Number(milestone.amount) / (1 - feeRate);

        console.log(`Releasing Full Amount: ${amountToRelease} (Net Target: ${milestone.amount})`);
        
        // 1. EXECUTE BLOCKCHAIN TRANSACTION (Release Funds)
        const txResult = await releaseOnChain(projectId, amountToRelease);

        if (!txResult || !txResult.success) {
            throw new Error("Blockchain Transaction Failed. Funds not released.");
        }

        // [FIX 1] تعریف متغیر realTxHash
        const realTxHash = txResult.txHash;

        // 2. Update Milestone Status to 'approved' in DB
        // [FIX 2] دریافت خطا (error) از دستور آپدیت
        const { error } = await supabase.from('milestones').update({
            status: 'approved',
            updated_at: new Date().toISOString(),
            decision_hash: realTxHash // <--- حالا این متغیر شناخته شده است
        }).eq('id', milestoneId);

        if (error) return { error: error.message };

        // 3. Log Payout Transaction
        await supabase.from('transactions').insert({
            project_id: projectId,
            type: 'payout',
            status: 'completed',
            amount: milestone.amount,
            from_address: process.env.ESCROW_CONTRACT_ADDRESS,
            to_address: 'FREELANCER_WALLET', 
            tx_hash: realTxHash
        });
        await supabase.from('decision_logs').insert({
            project_id: projectId,
            milestone_id: milestoneId,
            event_type: 'MILESTONE_RELEASED',
            recommendation: 'RELEASE',
            final_decision: `Funds Released. Hash: ${realTxHash}`,
            log_hash: realTxHash, // نمایش در ادمین
            rule_version: '1.0.0',
            created_at: new Date().toISOString()
        });
        await logProjectEvent(supabase, projectId, 'RELEASE_COMPLETED', { tx_hash: realTxHash }, 'system', milestoneId);
        // 4. Check for Project Completion
        const { data: remaining } = await supabase
            .from('milestones')
            .select('id')
            .eq('project_id', projectId)
            .neq('status', 'approved');

        if (!remaining || remaining.length === 0) {
            // All milestones done -> Complete Project
            await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId);
            
            // Notify Client to Leave Review
            const { data: p } = await supabase
                .from('projects')
                .select('client_id')
                .eq('id', projectId)
                .single();
            
            if (p && p.client_id) {
                await createNotification(
                    supabase, 
                    p.client_id, 
                    "Project Completed! Please rate the freelancer.", 
                    `/dashboard/projects/${projectId}`
                );
            }
        }

        // 5. NOTIFICATION: Notify Freelancer
        await createNotification(
            supabase, 
            milestone.freelancer_id, 
            `Payment Released! funds sent to your wallet.`, 
            `/dashboard/projects/${projectId}`
        );

    } catch (error: any) {
        console.error("Approve Milestone Critical Error:", error);
        await logProjectEvent(supabase, projectId, 'RELEASE_FAILED', { error: error.message }, 'system', milestoneId);
        return { error: "Approval Failed: " + error.message };
    }
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/admin`);
    redirect(`/dashboard/projects/${projectId}?tab=workspace`);
}
/**
 * Client Action: Dispute a milestone.
 * Raises a flag and opens the Dispute Room.
 */
export async function disputeMilestoneAction(milestoneId: string, projectId: string, reason: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Set Milestone Status to 'disputed'
    const { error } = await supabase.from('milestones').update({
        status: 'disputed',
        submission_note: `[DISPUTE RAISED]: ${reason}`, // Append reason to notes
        updated_at: new Date().toISOString()
    }).eq('id', milestoneId);

    if (error) return { error: error.message };
    
    // Also Set Project Status to 'disputed' (Triggers Dispute Room UI)
    await supabase.from('projects').update({ status: 'disputed' }).eq('id', projectId);

    await logProjectEvent(supabase, projectId, 'MILESTONE_DISPUTED', {
        reason: reason, milestone_id: milestoneId
    }, user?.id, milestoneId);

    // Create System Message in Chat
    //const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('messages').insert({
        project_id: projectId,
        sender_id: user?.id,
        content: `[DISPUTE OPENED]: ${reason}`,
        type: 'dispute'
    });

    // Run Engine Analysis for Evidence gathering automatically
    await processMilestoneDecisionAction(milestoneId, projectId);

    redirect(`/dashboard/projects/${projectId}?tab=dispute`);
}

/**
 * [NEW] Creates a new milestone manually.
 * Fixes previous errors where adding milestones dynamically failed.
 */
export async function createMilestoneAction(
    projectId: string,
    title: string,
    amount: number,
    dueDate: string,
    deliverables: string
) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Get current milestones to determine order index
    const { data: existing } = await supabase.from('milestones').select('id').eq('project_id', projectId);
    const orderIndex = existing ? existing.length : 0;

    const {data, error } = await supabase.from('milestones').insert({
        project_id: projectId,
        title,
        amount,
        due_date: new Date(dueDate).toISOString(),
        deliverables,
        order_index: orderIndex,
        status: 'pending'
    }).select().single();

    if (error) return { error: error.message };
    await logProjectEvent(supabase, projectId, 'MILESTONE_CREATED', { title, amount }, user?.id, data.id);
    redirect(`/dashboard/projects/${projectId}?tab=workspace`);
}

// =================================================================
// 6. DISPUTE RESOLUTION & ADMIN ACTIONS
// =================================================================

/**
 * [UPDATED] Raise Dispute Action
 * Handles both:
 * 1. Milestone-specific dispute (locks only that milestone amount)
 * 2. Full Project dispute (locks remaining project budget)
 */
export async function createDisputeAction(projectId: string, reason: string, milestoneId?: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };
    if (!reason) return { error: "Dispute reason is required" };

    try {
        // دریافت نقش کاربر (کلاینت است یا فریلنسر؟)
        const { data: project } = await supabase.from('projects').select('client_id, freelancer_id, budget').eq('id', projectId).single();
        if (!project) return { error: "Project not found" };

        const isClient = user.id === project.client_id;
        const isFreelancer = user.id === project.freelancer_id;

        if (!isClient && !isFreelancer) return { error: "You are not a party to this contract" };

        // =========================================================
        // SCENARIO A: MILESTONE DISPUTE (Specific Scope)
        // =========================================================
        if (milestoneId) {
            // 1. Get Milestone Data
            // [FIX]: Added .select('*') before .eq()
            const { data: milestone } = await supabase
                .from('milestones')
                .select('*') // <--- این بخش اضافه شد
                .eq('id', milestoneId)
                .single();
            
            if (!milestone) return { error: "Milestone not found" };

            // 2. Update Milestone Status ONLY
            const { error: msError } = await supabase
                .from('milestones')
                .update({ 
                    status: 'disputed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', milestoneId);

            if (msError) throw msError;

            // 3. Log Event (Specific to Milestone)
            // در اینجا مبلغ مورد مناقشه فقط مبلغ مایلستون است
            await logProjectEvent(supabase, projectId, 'MILESTONE_DISPUTED', {
                milestone_id: milestoneId,
                amount_at_risk: milestone.amount,
                initiated_by: user.id,
                reason: reason
            }, user.id);

            // 4. Send Notification
            const targetId = isClient ? project.freelancer_id : project.client_id;
            await createNotification(supabase, targetId, `Dispute raised on milestone: "${milestone.title}"`, `/dashboard/projects/${projectId}?tab=dispute`);

        } 
        // =========================================================
        // SCENARIO B: PROJECT ACTION DISPUTE (Global Scope)
        // =========================================================
        else {
            // 1. Update Project Status (Locks everything)
            const { error: projError } = await supabase
                .from('projects')
                .update({ 
                    status: 'disputed',
                    escrow_status: 'disputed', // قفل کردن کل صندوق
                    updated_at: new Date().toISOString() 
                })
                .eq('id', projectId);

            if (projError) throw projError;

            // 2. Calculate Remaining Funds (Total Budget - Released)
            const { data: released } = await supabase.from('transactions')
                .select('amount')
                .eq('project_id', projectId)
                .eq('type', 'payout');
            
            const totalReleased = released?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
            const remainingRisk = Number(project.budget) - totalReleased;

            // 3. Log Event (Global)
            await logProjectEvent(supabase, projectId, 'PROJECT_DISPUTED', {
                amount_at_risk: remainingRisk, 
                initiated_by: user.id,
                reason: reason,
                scope: 'FULL_PROJECT'
            }, user.id);

            // 4. Send Notification
            const targetId = isClient ? project.freelancer_id : project.client_id;
            await createNotification(supabase, targetId, `URGENT: Full Project Dispute Raised!`, `/dashboard/projects/${projectId}?tab=dispute`);
        }

        // 6. Insert System Message (Chat)
        await supabase.from('messages').insert({
            project_id: projectId,
            sender_id: user.id,
            recipient_id: isClient ? project.freelancer_id : project.client_id,
            content: `DISPUTE RAISED: ${reason}`,
            type: 'dispute'
        });

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };

    } catch (error: any) {
        console.error("Dispute Error:", error);
        return { error: error.message };
    }
}
// =================================================================
// 7. NOTIFICATION ACTIONS
// =================================================================

/**
 * [NEW] Marks a specific notification as read.
 */
export async function markNotificationReadAction(notificationId: number) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    if (error) return { error: error.message };
    return { success: true };
}

/**
 * [NEW] Marks ALL notifications for the user as read.
 */
export async function markAllNotificationsReadAction() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    if (error) return { error: error.message };
    return { success: true };
}

// =================================================================
// 8. MESSAGE & CHAT ACTIONS (SERVER SIDE)
// =================================================================

/**
 * [NEW - CRITICAL] Sends a message AND creates a notification on the server.
 * This replaces client-side logic to ensure reliability.
 * * @param projectId The project ID to attach message to
 * @param recipientId Who should receive the notification
 * @param content Message text
 * @param type 'text' | 'system' | 'dispute'
 */
// [FILE: app/actions.ts]

// [FILE: app/actions.ts]

// [FILE: app/actions.ts]
// =================================================================
// 8. MESSAGE & CHAT ACTIONS (SERVER SIDE) - CORRECTED & ISOLATED
// =================================================================
export async function sendMessageAction(
    projectId: string, 
    recipientId: string, 
    content: string, 
    type: 'text' | 'system' | 'dispute' | 'proposal' | 'workspace' = 'text'
) {
    // 1. ایجاد کلاینت سوپابیس
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { error: "Unauthorized" };
    if (!projectId || !recipientId || !content) return { error: "Missing fields" };

    try {
        // 2. ثبت پیام در دیتابیس با نوع مشخص (type)
        const { data: msgData, error: msgError } = await supabase.from('messages').insert({
            project_id: projectId,
            sender_id: user.id,
            recipient_id: recipientId,
            content: content,
            type: type, // نوع پیام اینجا ذخیره می‌شود تا بعداً فیلتر شود
            created_at: new Date().toISOString()
        }).select().single();

        if (msgError) {
            console.error("Message Insert Error:", msgError);
            return { error: msgError.message };
        }

        // 3. لاجیک هوشمند لینک نوتیفیکیشن (Smart Notification Logic)
        // بر اساس نوع پیام، کاربر را به تب درست هدایت می‌کنیم
        let linkUrl = `/dashboard/projects/${projectId}`; // لینک پیش‌فرض
        let notificationTitle = "New Message";

        // دریافت اطلاعات پروژه برای تشخیص نقش گیرنده
        const { data: project } = await supabase
            .from('projects')
            .select('client_id, freelancer_id, title')
            .eq('id', projectId)
            .single();

        if (project) {
            const isRecipientClient = recipientId === project.client_id;

            if (type === 'dispute') {
                notificationTitle = `🚨 Dispute Update: ${project.title}`;
                linkUrl = `/dashboard/projects/${projectId}?tab=dispute`;
            } 
            else if (type === 'proposal') {
                notificationTitle = `📄 Proposal Chat: ${project.title}`;
                // اگر گیرنده کارفرماست -> برود به تب Proposals
                // اگر گیرنده فریلنسر است -> برود به تب Details (که چت قبل از استخدام آنجاست)
                linkUrl = isRecipientClient 
                    ? `/dashboard/projects/${projectId}?tab=proposals`
                    : `/dashboard/projects/${projectId}?tab=details`;
            } 
            else if (type === 'workspace' || type === 'text') {
                notificationTitle = `💬 Workspace: ${project.title}`;
                linkUrl = `/dashboard/projects/${projectId}?tab=workspace`;
            }
        }

        // 4. ساخت نوتیفیکیشن
        const snippet = content.length > 40 ? content.substring(0, 40) + "..." : content;
        
        await createNotification(
            supabase,
            recipientId,
           `${project?.title || 'Project'}: ${snippet}`, // متن نوتیفیکیشن
            linkUrl // لینک هوشمند محاسبه شده
        );

        return { success: true, message: msgData };

    } catch (error: any) {
        console.error("SendMessage Action Exception:", error);
        return { error: error.message };
    }
}
export async function toggleProjectBlockAction(projectId: string, shouldBlock: boolean, reason: string) {
    // 1. بررسی امنیتی: آیا کاربر ادمین است؟
    const cookieStore = cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';
    
    if (!isAdmin) {
        return { success: false, error: "Unauthorized: Admin access required." };
    }

    // 2. [FIX] استفاده از createAdminClient به جای createClient خالی
    // این تابع در همین فایل تعریف شده و از Service Role استفاده می‌کند
    const supabase = createAdminClient(); 
    
    // 3. آپدیت وضعیت پروژه
    const { error: updateError } = await supabase
        .from('projects')
        .update({ 
            is_blocked: shouldBlock,
            block_reason: shouldBlock ? reason : null,
            // اختیاری: اگر خواستید وضعیت را هم تغییر دهید تا در لیست‌ها نیاید
            // status: shouldBlock ? 'suspended' : 'open' 
        })
        .eq('id', projectId);

    if (updateError) {
        console.error("Block Project Error:", updateError);
        return { success: false, error: updateError.message };
    }

    // 4. پیدا کردن صاحب پروژه برای ارسال نوتیفیکیشن
    const { data: project } = await supabase
        .from('projects')
        .select('client_id, title')
        .eq('id', projectId)
        .single();

    if (project && shouldBlock) {
        // 5. ارسال نوتیفیکیشن به کلاینت
        await supabase.from('notifications').insert({
            user_id: project.client_id,
            content: `Your project "${project.title}" has been blocked by Admin. Reason: ${reason}`,
            link_url: `/dashboard/projects/${projectId}`, // لینک برای مشاهده جزئیات
            is_read: false,
            created_at: new Date().toISOString()
        });
    }

    // 6. لاگ کردن این اقدام در سیستم
    // (از آنجا که logStateChange نیاز به یوزر دارد و اینجا ادمین سیستمی است، می‌توانیم دستی لاگ بزنیم یا از null استفاده کنیم)
    // اگر تابع logProjectEvent دارید:
    // await logProjectEvent(supabase, projectId, 'PROJECT_MODERATION', { action: shouldBlock ? 'BLOCK' : 'UNBLOCK', reason }, 'ADMIN');

    // رفرش کردن کش برای دیدن تغییرات
    revalidatePath('/admin');
    
    return { success: true };
}
export async function getAdminProjectsListAction() {
    const supabase = await createSupabaseServerClient();

    // 1. دریافت همه پروژه‌ها (بدون هیچ فیلتری)
    const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching projects:", error);
        return { success: false, error: error.message };
    }

    if (!projects || projects.length === 0) {
        return { success: true, data: [] };
    }

    // 2. دریافت لیست آیدی‌های کلاینت‌ها
    const clientIds = Array.from(new Set(projects.map(p => p.client_id).filter(Boolean)));

    // 3. دریافت اطلاعات پروفایل‌ها جداگانه (برای جلوگیری از خطای Join)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name') // فرض بر این است که email در پروفایل سینک شده، اگر نه فقط full_name
        .in('id', clientIds);

    // 4. ترکیب دستی اطلاعات
    const populatedProjects = projects.map(p => {
        const clientProfile = profiles?.find(profile => profile.id === p.client_id);
        return {
            ...p,
            client: clientProfile || { full_name: 'Unknown Client', email: 'N/A' }
        };
    });

    return { success: true, data: populatedProjects };
}
/**
 * [NEW] Save uploaded file metadata to database
 */
export async function saveProjectFilesAction(
    projectId: string,
    files: { name: string; url: string; size: number; type: string }[]
) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };

    const records = files.map(file => ({
        project_id: projectId,
        uploader_id: user.id,
        file_name: file.name,
        file_url: file.url,
        file_size: file.size,
        file_type: file.type
    }));

    const { error } = await supabase.from('project_files').insert(records);

    if (error) {
        console.error("Save Files Error:", error);
        return { error: error.message };
    }

    // ارسال نوتیفیکیشن یا لاگ ایونت (اختیاری)
    // await logProjectEvent(...)

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
}

/**
 * [NEW] Get project files
 */
export async function getProjectFilesAction(projectId: string) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { success: true, data };
}
export async function getMilestoneFilesAction(milestoneId: string) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('milestone_id', milestoneId)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}
export async function requestRevisionAction(milestoneId: string, projectId: string, feedback: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };

    // 1. دریافت اطلاعات پروژه برای پیدا کردن فریلنسر
    const { data: project } = await supabase
        .from('projects')
        .select('freelancer_id, title')
        .eq('id', projectId)
        .single();

    if (!project) return { error: "Project not found" };

    // 2. آپدیت مایل‌ستون: برگرداندن به وضعیت فعال و پاک کردن توضیحات قبلی
    const { error: updateError } = await supabase
        .from('milestones')
        .update({ 
            status: 'ACTIVE', // برمی‌گردد به حالت فعال تا دکمه سابمیت دوباره ظاهر شود
            submission_note: null, // <--- نکته مهم: پاک کردن توضیحات قبلی تا با توضیحات جدید قاطی نشود
            submission_file_url: null, // پاک کردن فایل تک (فایل‌های چندگانه در جدول جدا می‌مانند به عنوان تاریخچه)
            updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);

    if (updateError) return { error: updateError.message };

    // 3. ارسال فیدبک به عنوان پیام چت (تا تاریخچه بماند)
    await sendMessageAction(projectId, project.freelancer_id, `[REVISION REQUESTED]: ${feedback}`, 'system');

    // 4. ارسال نوتیفیکیشن برای فریلنسر
    await createNotification(
        supabase,
        project.freelancer_id,
        `Revision Requested for "${project.title}". Feedback: ${feedback.substring(0, 50)}...`,
        `/dashboard/projects/${projectId}?tab=workspace`
    );

    // 5. ثبت لاگ
    await logProjectEvent(supabase, projectId, 'REVISION_REQUESTED', {
        milestone_id: milestoneId,
        feedback: feedback
    }, user.id, milestoneId);

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
}