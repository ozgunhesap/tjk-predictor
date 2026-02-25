/**
 * TJK Predictor - Math Audit Script
 * This script isolates the core pacing modifiers from predictor.ts to see their maximum potential impact.
 */

const basePace = 100 / 1500; // 0.0666 s/m (1:40 for 1500m)

console.log("BASE PACE: 1:40.00 for 1500m (0.0666 s/m)\n");

// 1. Distance Correlation
console.log("--- 1. Distance Correlation ---");
console.log("Formula: basePace + (TargetDist - PastDist) * 0.000006");
const distDiffs = [-500, -200, 200, 500];
distDiffs.forEach(diff => {
    const newPace = basePace + (diff * 0.000006);
    const timeFor1500 = newPace * 1500;
    console.log(`Diff ${diff > 0 ? '+' : ''}${diff}m -> Pace: ${newPace.toFixed(6)} -> Time for 1500m: ${timeFor1500.toFixed(2)}s (Impact: ${(timeFor1500 - 100).toFixed(2)}s)`);
});
console.log("Verdict: Very safe. 500m difference only swings the time by 4.5 seconds on a 1500m scale.\n");

// 1.5 Sprint to Route Tax
console.log("--- 1.5 Sprint to Route Tax ---");
console.log("Formula: pace * 1.015 if Past < 1500 and Target >= 1500");
const taxPace = basePace * 1.015;
const taxTime = taxPace * 2000;
const normalTime = basePace * 2000;
console.log(`Time for 2000m without tax: ${normalTime.toFixed(2)}s`);
console.log(`Time for 2000m WITH tax: ${taxTime.toFixed(2)}s (Impact: +${(taxTime - normalTime).toFixed(2)}s)`);
console.log("Verdict: Safe. 1.5% tax equals roughly 2.0 seconds on a 2000m race.\n");

// 2. City Speed Index
console.log("--- 2. City Speed Index ---");
console.log("Formula: pace * (TargetCityRatio / PastCityRatio)");
const indices = { Adana: 0.98, Izmir: 0.99, Istanbul: 1.00, Ankara: 1.01, Elazig: 1.04 };
// Extreme case: Ran in Elazig (Slow 1.04), now running in Adana (Fast 0.98)
const maxGainRatio = 0.98 / 1.04;
const maxGainTime = (basePace * maxGainRatio) * 1500;
// Extreme case: Ran in Adana (Fast 0.98), now running in Elazig (Slow 1.04)
const maxLossRatio = 1.04 / 0.98;
const maxLossTime = (basePace * maxLossRatio) * 1500;
console.log(`Max Gain (Elazig -> Adana): ${maxGainTime.toFixed(2)}s (Impact: ${(maxGainTime - 100).toFixed(2)}s)`);
console.log(`Max Loss (Adana -> Elazig): ${maxLossTime.toFixed(2)}s (Impact: +${(maxLossTime - 100).toFixed(2)}s)`);
console.log("Verdict: High Impact (Up to 6 seconds). BUT this is physically realistic as dirt tracks vary wildly.\n");

// 3. Weight Correlation
console.log("--- 3. Weight Correlation ---");
console.log("Formula: basePace + (TargetWeight - PastWeight) * 0.000075");
const weightDiffs = [-10, -5, 5, 10];
weightDiffs.forEach(diff => {
    const newPace = basePace + (diff * 0.000075);
    const timeFor1500 = newPace * 1500;
    console.log(`Diff ${diff > 0 ? '+' : ''}${diff}kg -> Time for 1500m: ${timeFor1500.toFixed(2)}s (Impact: ${(timeFor1500 - 100).toFixed(2)}s)`);
});
console.log("Verdict: Safe but potent. 10kg difference equals 1.12 seconds on 1500m. 10kg is a massive weight swing in horse racing.\n");

// 4. Track Conversion
console.log("--- 4. Track Conversion Math ---");
console.log("English Horse Fallbacks (Turf: 1.0, Synth: 1.015, Dirt: 1.040)");
const engTurfToDirtRatio = 1.040 / 1.00; // 1.04
console.log(`Turf -> Dirt Penalty: +${((engTurfToDirtRatio - 1) * 100).toFixed(1)}%`);
console.log(`Time Impact on 1500m: 100s -> ${(100 * engTurfToDirtRatio).toFixed(2)}s`);
console.log("Verdict: High Impact (4 seconds). Bounded by Math.max(0.92, Math.min(1.08, personalRatio)). Max theoretical sway is 8% (8 seconds on 100s).\n");

// 5. Track Condition
console.log("--- 5. Track Condition Math ---");
console.log("Formula: pace * Math.max(0.98, Math.min(1.02, conditionRatio))");
console.log("Verdict: Hard capped to +/- 2%. Max theoretical sway is 2.0 seconds on 100s. Very safe.\n");
