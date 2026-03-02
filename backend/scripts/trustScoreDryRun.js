/**
 * trustScoreDryRun.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit-test style simulation of the off-chain CIBIL trust scoring system.
 *
 * Run with:  node backend/scripts/trustScoreDryRun.js
 *
 * No database connection required — all state is simulated in memory.
 */

'use strict';

// ─── Constants (mirrors trustScoreService.js) ─────────────────────────────────
const MIN_SCORE = 300;
const MAX_SCORE = 900;

const ACTIONS = {
    SBT_MINTED: 'SBT Minted',
    KYC_VERIFIED: 'KYC Verified',
    FIRST_INSTALLMENT: 'First Installment Paid',
    INSTALLMENT_PAID: 'Installment Paid',
    FIRST_LOAN_COMPLETED: 'First Loan Completed',
    INSTALLMENT_MISSED: 'Installment Missed',
    LOAN_DEFAULTED: 'Loan Defaulted',
};

// ─── In-Memory User Model ─────────────────────────────────────────────────────
function createUser(name) {
    return {
        name,
        trustScore: MIN_SCORE,
        completedLoans: 0,
        hasReceivedFirstInstallmentBonus: false,
        hasReceivedFirstFullRepaymentBonus: false,
        trustHistory: []
    };
}

// ─── Core Engine (mirrors trustScoreService.js logic exactly) ─────────────────
function clamp(n) { return Math.max(MIN_SCORE, Math.min(MAX_SCORE, n)); }

function increaseScore(user, points, reason) {
    // Idempotency: first-installment bonus
    if (reason === ACTIONS.FIRST_INSTALLMENT) {
        if (user.hasReceivedFirstInstallmentBonus) {
            console.log(`  [SKIP] Duplicate first-installment bonus blocked`);
            return user.trustScore;
        }
        user.hasReceivedFirstInstallmentBonus = true;
    }

    // Idempotency: first-full-repayment bonus
    if (reason === ACTIONS.FIRST_LOAN_COMPLETED) {
        if (user.hasReceivedFirstFullRepaymentBonus) {
            console.log(`  [SKIP] Duplicate first-loan-completed bonus blocked`);
            return user.trustScore;
        }
        user.hasReceivedFirstFullRepaymentBonus = true;
    }

    const oldScore = user.trustScore;
    const newScore = clamp(oldScore + points);
    user.trustScore = newScore;
    user.trustHistory.push({ action: reason, points: +points, newScore, timestamp: new Date() });
    logEvent(user, +points, reason, newScore);
    return newScore;
}

function decreaseScore(user, points, reason) {
    const oldScore = user.trustScore;
    const newScore = clamp(oldScore - points);
    user.trustScore = newScore;
    user.trustHistory.push({ action: reason, points: -Math.abs(points), newScore, timestamp: new Date() });
    logEvent(user, -Math.abs(points), reason, newScore);
    return newScore;
}

function logEvent(user, points, reason, newScore) {
    const sign = points >= 0 ? `+${points}` : `${points}`;
    const arrow = points >= 0 ? '🟢' : '🔴';
    console.log(`  ${arrow} [${reason}] ${sign} → Score: ${newScore}`);
    console.log('    ' + JSON.stringify({ event: 'TrustScoreUpdated', user: user.name, newScore, reason }));
}

// ─── ETH Eligibility Check ────────────────────────────────────────────────────
function checkEthEligibility(user, requestedMode) {
    if (requestedMode === 'ETH') {
        if (user.completedLoans < 1) {
            return { allowed: false, message: 'Complete at least 1 loan before accessing ETH loans.' };
        }
        if (user.trustScore < 700) {
            return { allowed: false, message: `Trust Score must be 700+ to unlock ETH loans. Current: ${user.trustScore}` };
        }
        return { allowed: true, message: 'ETH loan allowed.' };
    }
    return { allowed: true, message: 'ERC20 loan always allowed.' };
}

// ─── Scenarios ────────────────────────────────────────────────────────────────
function separator(title) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  SCENARIO: ${title}`);
    console.log('═'.repeat(60));
}

function printUserState(user) {
    const tier =
        user.trustScore >= 850 ? 'Prime' :
            user.trustScore >= 700 ? 'Trusted' :
                user.trustScore >= 500 ? 'Building Credit' : 'New Borrower';
    console.log(`\n  📊 ${user.name} — Score: ${user.trustScore} (${tier}) | Completed Loans: ${user.completedLoans}`);
    console.log(`     History Entries: ${user.trustHistory.length}`);
}

function assert(condition, message) {
    if (!condition) {
        console.error(`  ❌ ASSERTION FAILED: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`  ✅ PASS: ${message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: New User Onboarding
// ─────────────────────────────────────────────────────────────────────────────
separator('New User — KYC + SBT Mint');
const alice = createUser('Alice (0xAbc...)');
console.log('\n  Starting score: 300 (default)');

increaseScore(alice, 50, ACTIONS.SBT_MINTED);
assert(alice.trustScore === 350, `Score is 350 after SBT Mint`);

increaseScore(alice, 100, ACTIONS.KYC_VERIFIED);
assert(alice.trustScore === 450, `Score is 450 after KYC Verified`);

printUserState(alice);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: First ERC20 Loan — ETH should be blocked
// ─────────────────────────────────────────────────────────────────────────────
separator('First ERC20 Loan (ETH Gate Check)');

const ethCheck1 = checkEthEligibility(alice, 'ETH');
assert(!ethCheck1.allowed, 'ETH loan correctly blocked for new borrower (no completed loans)');
console.log(`  Message: ${ethCheck1.message}`);

const erc20Check = checkEthEligibility(alice, 'ERC20');
assert(erc20Check.allowed, 'ERC20 loan correctly allowed');
console.log(`  Message: ${erc20Check.message}`);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: First Installment Payment
// ─────────────────────────────────────────────────────────────────────────────
separator('First Installment Paid');

const scoreBefore = alice.trustScore;
increaseScore(alice, 50, ACTIONS.FIRST_INSTALLMENT);
assert(alice.trustScore === scoreBefore + 50, `Score increased by 50 for first installment`);
assert(alice.hasReceivedFirstInstallmentBonus === true, `First installment flag set to true`);

// Duplicate attempt — should be blocked
const scoreAfterFirst = alice.trustScore;
increaseScore(alice, 50, ACTIONS.FIRST_INSTALLMENT);
assert(alice.trustScore === scoreAfterFirst, `Duplicate first-installment bonus correctly blocked`);

// Subsequent installments — +20 each
increaseScore(alice, 20, ACTIONS.INSTALLMENT_PAID);
increaseScore(alice, 20, ACTIONS.INSTALLMENT_PAID);
assert(alice.trustScore === scoreAfterFirst + 40, `Two subsequent installments each added +20`);

printUserState(alice);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: Loan Completion — First Loan Completed Bonus
// ─────────────────────────────────────────────────────────────────────────────
separator('First Loan Completion');

const scoreBeforeCompletion = alice.trustScore;
if (alice.completedLoans === 0) {
    increaseScore(alice, 100, ACTIONS.FIRST_LOAN_COMPLETED);
}
alice.completedLoans += 1;

assert(alice.completedLoans === 1, `completedLoans incremented to 1`);
assert(alice.trustScore === scoreBeforeCompletion + 100, `First-loan-completed bonus of +100 applied`);

// Duplicate bonus attempt — should be blocked
const scoreAfterCompletion = alice.trustScore;
increaseScore(alice, 100, ACTIONS.FIRST_LOAN_COMPLETED);
assert(alice.trustScore === scoreAfterCompletion, `Duplicate first-loan-completed bonus correctly blocked`);

printUserState(alice);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: ETH Eligibility Unlock
// ─────────────────────────────────────────────────────────────────────────────
separator('ETH Eligibility Unlock');

// Now alice has completedLoans=1 but trustScore might still be < 700
console.log(`\n  Alice's current score: ${alice.trustScore}`);
const ethCheck2 = checkEthEligibility(alice, 'ETH');
if (alice.trustScore < 700) {
    assert(!ethCheck2.allowed, `ETH still blocked (score ${alice.trustScore} < 700)`);
    console.log(`  Boosting score to simulate reaching 700...`);
    // Simulate completing more loans to reach 700
    while (alice.trustScore < 700) {
        increaseScore(alice, 20, ACTIONS.INSTALLMENT_PAID);
    }
}

const ethCheck3 = checkEthEligibility(alice, 'ETH');
if (alice.trustScore >= 700 && alice.completedLoans >= 1) {
    assert(ethCheck3.allowed, `ETH unlocked! Score: ${alice.trustScore}, Completed: ${alice.completedLoans}`);
    console.log(`  Message: ${ethCheck3.message}`);
}

printUserState(alice);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: Missed Payment Penalty
// ─────────────────────────────────────────────────────────────────────────────
separator('Missed Installment Penalty');

const bob = createUser('Bob (0xDef...)');
increaseScore(bob, 50, ACTIONS.SBT_MINTED);
increaseScore(bob, 100, ACTIONS.KYC_VERIFIED);
const bobScoreBefore = bob.trustScore;

decreaseScore(bob, 50, ACTIONS.INSTALLMENT_MISSED);
assert(bob.trustScore === bobScoreBefore - 50, `Score decreased by 50 for missed installment`);

// Loan default
decreaseScore(bob, 150, ACTIONS.LOAN_DEFAULTED);
assert(bob.trustScore === Math.max(MIN_SCORE, bobScoreBefore - 200), `Score decreased correctly for loan default (clamped at ${MIN_SCORE} floor if needed)`);

printUserState(bob);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: Score floor clamping at 300
// ─────────────────────────────────────────────────────────────────────────────
separator('Score Floor Clamped at 300');

const charlie = createUser('Charlie (0xGhi...)');
// charlie starts at 300
decreaseScore(charlie, 1000, ACTIONS.LOAN_DEFAULTED); // Massive penalty
assert(charlie.trustScore === 300, `Score clamped at MIN (300), not below`);

printUserState(charlie);

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8: Score ceiling clamping at 900
// ─────────────────────────────────────────────────────────────────────────────
separator('Score Ceiling Clamped at 900');

const dave = createUser('Dave (0xJkl...)');
dave.trustScore = 880;
increaseScore(dave, 100, ACTIONS.INSTALLMENT_PAID); // Would push above 900
assert(dave.trustScore === 900, `Score clamped at MAX (900), not above`);

printUserState(dave);

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  DRY-RUN COMPLETE');
console.log('═'.repeat(60));
console.log('\n  Final User States:');
[alice, bob, charlie, dave].forEach(u => {
    const tier = u.trustScore >= 850 ? 'Prime' : u.trustScore >= 700 ? 'Trusted' : u.trustScore >= 500 ? 'Building Credit' : 'New Borrower';
    console.log(`  • ${u.name.padEnd(25)} Score: ${String(u.trustScore).padStart(3)} (${tier}) | Loans: ${u.completedLoans} | History: ${u.trustHistory.length} entries`);
});
console.log('');
