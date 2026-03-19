import { PastRace } from './tjk';

export interface PredictionResult {
    predictedSeconds: number | null;
    predictedTimeStr: string | null;
    confidence: number; // 0-100 based on relevant races
    relevantRacesCount: number;
    h2hAdjustments?: { horseName: string, adjustment: number }[]; // Track H2H wins
    classQualityScore?: number; // 0-100 score of historical race quality
}

// timeStr format: "1.26.42" or "2.09.88" (minutes.seconds.hundredths)
export function parseTime(timeStr: string): number {
    const parts = timeStr.trim().split('.');
    if (parts.length === 3) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        const hundredths = parseInt(parts[2], 10);
        return (minutes * 60) + seconds + (hundredths / 100);
    } else if (parts.length === 2) {
        // Just seconds.hundredths ? Rarely happens in TJK
        const seconds = parseInt(parts[0], 10);
        const hundredths = parseInt(parts[1], 10);
        return seconds + (hundredths / 100);
    }
    return 0;
}

export function formatTime(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return "Derecesiz";

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 100);

    const minStr = minutes > 0 ? `${minutes}.` : '';
    const secStr = seconds.toString().padStart(minutes > 0 ? 2 : 1, '0');
    const hundStr = hundredths.toString().padStart(2, '0');

    return `${minStr}${secStr}.${hundStr}`;
}

const CITY_SPEED_INDEX: Record<string, number> = {
    "Adana": 0.98,
    "Şanlıurfa": 1.03,
    "Diyarbakır": 1.03,
    "Elazığ": 1.04,
    "Ankara": 1.01,
    "İstanbul": 1.00,
    "İzmir": 0.99,
    "Bursa": 1.00,
    "Antalya": 1.00,
    "Kocaeli": 1.01
};

const CLASS_STRENGTH: Record<string, number> = {
    "G1": 1.00,
    "G2": 0.98,
    "G3": 0.96,
    "A3": 0.95,
    "KV-9": 0.94,
    "KV-8": 0.93,
    "KV-7": 0.92,
    "KV-6": 0.91,
    "Handikap-17": 0.90,
    "Handikap-16": 0.88,
    "Handikap-15": 0.86,
    "ŞARTLI 5": 0.85,
    "ŞARTLI 4": 0.83,
    "ŞARTLI 3": 0.81,
    "ŞARTLI 2": 0.78,
    "Maiden": 0.75,
    "Şartlı 1": 0.75
};

const getClassStrength = (className: string | undefined): number => {
    if (!className) return 0.80; // Default
    const upper = className.toUpperCase();
    for (const key in CLASS_STRENGTH) {
        if (upper.includes(key.toUpperCase())) return CLASS_STRENGTH[key];
    }
    return 0.80;
};

export function predictRaceTime(
    history: PastRace[],
    currentDistance: number,
    currentTrackType: string,
    targetDate?: string,
    currentCity?: string,
    currentWeight?: number,
    currentCondition?: string,
    currentJockey?: string,
    currentSire?: string,
    currentTrainer?: string,
    currentDraw?: number,
    currentHandicap?: number,
    otherHorsesRaces?: Record<string, PastRace[]>, // For H2H
    currentRaceName?: string // For Class Drop
): PredictionResult {
    // Helper to parse DD/MM/YYYY or DD.MM.YYYY into a Date object for safe comparison
    const parseDateStr = (dStr: string) => {
        if (!dStr) return 0;
        const pts = dStr.trim().split(/[\/\.]/);
        if (pts.length === 3) {
            const day = parseInt(pts[0], 10);
            const month = parseInt(pts[1], 10);
            const year = parseInt(pts[2], 10);
            if (isNaN(day) || isNaN(month) || isNaN(year)) return 0;
            // Use local noon to avoid DST/timezone edge cases during date-only comparison
            return new Date(year, month - 1, day, 12, 0, 0).getTime();
        }
        return 0;
    };

    const targetTimeMs = targetDate ? parseDateStr(targetDate) : 0;
    // console.log(`[Predictor] Target Date: ${targetDate} -> ${targetTimeMs}`);

    // --- 0. DATA ISOLATION (Strict Pre-Race) ---
    const filterPastOnly = (raceList: PastRace[], label: string) => {
        if (targetTimeMs === 0) return raceList;
        return raceList.filter(race => {
            if (!race.date) return true;
            const rMs = parseDateStr(race.date);
            const isPast = rMs < targetTimeMs;
            // if (!isPast) console.log(`[Predictor] EXCLUDING race from ${label}: ${race.date} (${rMs}) >= Target (${targetTimeMs})`);
            return isPast;
        });
    };

    const historyAtTargetMoment = filterPastOnly(history, "MainHorse");
    const otherHorsesHistoryAtTargetMoment: Record<string, PastRace[]> = {};
    if (otherHorsesRaces) {
        for (const [name, races] of Object.entries(otherHorsesRaces)) {
            otherHorsesHistoryAtTargetMoment[name] = filterPastOnly(races, name);
        }
    }

    if (!historyAtTargetMoment || historyAtTargetMoment.length === 0) {
        return { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 };
    }

    // Determine horse breed/type generically by historical speed base. 
    // Arab horses are naturally slower (Pace > 0.066 sec/m) than English horses.
    const overallAvgHistoryPace = historyAtTargetMoment.length > 0 ? (parseTime(historyAtTargetMoment[0].time) / historyAtTargetMoment[0].distance) : 0.068;
    const isArabHorse = overallAvgHistoryPace > 0.066;

    // Track categorization: Turf and Synthetic are grouped together. Dirt is isolated.
    const isGrassLike = (track: string) => track && (track.toLowerCase().includes('çim') || track.toLowerCase().includes('cim') || track.toLowerCase().includes('sentetik'));
    const isDirt = (track: string) => track && track.toLowerCase().includes('kum');

    const targetIsGrassLike = isGrassLike(currentTrackType);
    const targetIsDirt = isDirt(currentTrackType);

    // 1. Try to find races on the EXACT SAME track type first
    // User limitation: Historical races must be within +/- 15% of the target distance to prevent mixing Sprints and Routes
    const maxDistanceDiff = currentDistance * 0.15;

    const filterValidRaces = (raceList: PastRace[], requireExactTrack: boolean) => {
        return raceList.filter(race => {
            // NOTE: Date filtering has been moved to the top (historyAtTargetMoment) 
            // for global consistency across all prediction sub-logics (H2H, quality, etc).

            if (race.city && (race.city.toLowerCase().includes('şanlıurfa') || race.city.toLowerCase().includes('diyarbakır'))) return false;

            const isSimilarDistance = Math.abs(race.distance - currentDistance) <= maxDistanceDiff;
            const isValidTime = race.time && race.time !== "Derecesiz" && race.time.includes('.');

            if (!isSimilarDistance || !isValidTime) {
                return false;
            }

            if (requireExactTrack) {
                return race.trackType === currentTrackType;
            } else {
                // strict bucket isolation
                if (targetIsDirt) return isDirt(race.trackType);
                if (targetIsGrassLike) return isGrassLike(race.trackType);
                return false;
            }
        });
    };

    let relevantRaces = filterValidRaces(historyAtTargetMoment, true); // Strict exact match first
    let usedBucketFallback = false;

    // 2. FALLBACK: If not enough exact track races, fallback to the REST OF THE BUCKET
    // e.g. Target is Turf, fallback to Synthetic. Target is Dirt, no fallback available.
    if (relevantRaces.length < 2) {
        const bucketRaces = filterValidRaces(historyAtTargetMoment, false);
        if (bucketRaces.length > relevantRaces.length) {
            relevantRaces = bucketRaces;
            usedBucketFallback = true;
        }
    }

    // TJK returns latest races first
    relevantRaces = relevantRaces.slice(0, 5); // Take up to 5 most recent relevant races

    if (relevantRaces.length === 0) {
        return { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 };
    }

    let totalWeightedPace = 0;
    let totalWeight = 0;

    const currentCityIndex = currentCity ? (CITY_SPEED_INDEX[currentCity] || 1.0) : 1.0;

    relevantRaces.forEach((race, index) => {
        const seconds = parseTime(race.time);
        if (seconds > 0) {
            let basePace = seconds / race.distance; // historical seconds per meter
            
            // Outlier Anomaly Cap (Ignore paces where horse walked/injured)
            // Arab threshold ~0.088, English threshold ~0.075
            const maxPace = isArabHorse ? 0.085 : 0.072;
            if (basePace > maxPace) {
                basePace = maxPace; // Cap it so it doesn't destroy the average
            }

            // 1. Distance Correlation: Longer races have slower pace, shorter races have faster pace.
            // Assumption: Every 1 meter of distance change affects pace by 0.000006 seconds/meter
            const distanceDiff = currentDistance - race.distance;
            const distancePaceEffect = distanceDiff * 0.000006;
            let adjustedPace = basePace + distancePaceEffect;

            // NEW: Race Class Weighting (Qualitative)
            // A horse performing well in a G1 is more "efficient" than in a Maiden.
            const historicalClassStrength = getClassStrength(race.raceClass);
            // Reduced heuristical weight from 0.05 to 0.02 to prevent double-dipping with final Class Drop logic
            const classEffect = (1.0 - historicalClassStrength) * 0.02;
            adjustedPace = adjustedPace * (1 - classEffect);

            // Sprint-to-Route Stamina Tax (Softened)
            // Reduced penalty from 1.5% to 0.5% to prevent double-dipping with global Distance Affinity
            if (race.distance < 1500 && currentDistance >= 1500) {
                adjustedPace = adjustedPace * 1.005; 
            }

            // 2. City Track Correlation: Different cities have different track qualities affecting speed.
            const pastCityIndex = CITY_SPEED_INDEX[race.city] || 1.0;
            let cityAdjustmentRatio = currentCityIndex / pastCityIndex;
            // Cap city extreme variances to max +/- 1.5% to prevent field spreading
            cityAdjustmentRatio = Math.max(0.985, Math.min(1.015, cityAdjustmentRatio));
            adjustedPace = adjustedPace * cityAdjustmentRatio;

            // 3. Weight Correlation: Carrying more weight slows the horse down.
            // Heuristic: 1kg difference = 0.000075 seconds per meter reduction in pace.
            // Example: +5kg difference over 2000m adds roughly 0.75 seconds.
            const parseWeight = (w: any): number => {
                if (typeof w === 'number') return w;
                if (typeof w === 'string') {
                    // Handle "55+1.50Fazla Kilo" or "55,5"
                    const clean = w.replace(',', '.');
                    const match = clean.match(/(\d+(\.\d+)?)/);
                    if (match) {
                        const base = parseFloat(match[1]);
                        const extraMatch = clean.match(/\+(\d+(\.\d+)?)/);
                        const extra = extraMatch ? parseFloat(extraMatch[1]) : 0;
                        return base + extra;
                    }
                }
                return 0;
            };

            const targetWeight = parseWeight(currentWeight);
            const pastWeight = parseWeight(race.weight);

            if (targetWeight > 0 && pastWeight > 0) {
                const weightDiff = targetWeight - pastWeight;
                const weightPaceEffect = weightDiff * 0.000075;
                adjustedPace += weightPaceEffect;
            }

            // 4. Track Type Conversion (Bucket Fallback Scenario)
            // If the Target is Turf and we used Synthetic history (or vice versa), apply a conversion modifier.
            // Dirt history is never used for Turf/Synthetic targets, and vice versa.
            if (usedBucketFallback && race.trackType !== currentTrackType) {
                // Find all valid races on the past track vs current track to establish a personal baseline within the bucket
                let pastTrackAvgPace = 0;
                let currentTrackAvgPace = 0;
                let pastCount = 0;
                let currentCount = 0;

                historyAtTargetMoment.forEach(h => {
                    const secs = parseTime(h.time);
                    if (secs > 0) {
                        const pace = secs / h.distance;
                        if (h.trackType === race.trackType) { pastTrackAvgPace += pace; pastCount++; }
                        if (h.trackType === currentTrackType) { currentTrackAvgPace += pace; currentCount++; }
                    }
                });

                let personalRatio = 1.0;
                if (pastCount > 0 && currentCount > 0) {
                    const pAvg = pastTrackAvgPace / pastCount;
                    const cAvg = currentTrackAvgPace / currentCount;
                    personalRatio = cAvg / pAvg;
                } else {
                    // Universal multiplier for Turf vs Synthetic
                    const getBucketSpeedIndex = (type: string) => {
                        if (type === 'Çim') return 1.0; // Fastest
                        if (type === 'Sentetik') return isArabHorse ? 1.020 : 1.015; // Slightly slower
                        return 1.0;
                    };
                    const pastSpeed = getBucketSpeedIndex(race.trackType);
                    const currentSpeed = getBucketSpeedIndex(currentTrackType);
                    personalRatio = currentSpeed / pastSpeed;
                }

                // Capping the conversion impact so it never blows up a prediction by more than 1.5%
                personalRatio = Math.max(0.985, Math.min(1.015, personalRatio));

                adjustedPace = adjustedPace * personalRatio;
            }

            // 5. Track Condition Correlation
            // If the current track is Heavy/Muddy (Ağır/Islak/Sulu), pace is slower.
            // Dynamically apply a realistic scaling: English horses (faster/fragile) lose more pace in heavy conditions than Arab horses (endurance).
            const getConditionFactor = (cond: string | undefined) => {
                if (!cond) return 1.0;
                const lower = cond.toLowerCase();

                const severe = isArabHorse ? 1.010 : 1.015;  // 1.0% to 1.5% max penalty
                const moderate = isArabHorse ? 1.005 : 1.010;
                const light = 1.002;

                if (lower.includes('ağır') || lower.includes('çok ağır')) return severe;
                if (lower.includes('ıslak') || lower.includes('sulu') || lower.includes('çamur')) return moderate;
                if (lower.includes('nemli') || lower.includes('az nemli')) return light;
                return 1.00; // Normal/Good
            };
            const currentCondFactor = getConditionFactor(currentCondition);
            const pastCondFactor = getConditionFactor(race.condition);
            let conditionRatio = currentCondFactor / pastCondFactor;

            // Cap extreme condition swings to +/- 1% max
            conditionRatio = Math.max(0.99, Math.min(1.01, conditionRatio));
            adjustedPace = adjustedPace * conditionRatio;

            // Weight recent races higher
            const weight = 5 - index; // 5, 4, 3, 2, 1

            totalWeightedPace += adjustedPace * weight;
            totalWeight += weight;
        }
    });

    if (totalWeight === 0) {
        return { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 };
    }

    const averagePace = totalWeightedPace / totalWeight;
    let predictedSeconds = averagePace * currentDistance;

    // --- GLOBAL NORMALIZATION OFFSET ---
    // A flat -1.0s offset was causing short races to be accurate but long races to remain 2 seconds too slow.
    // Changed to a proportional 0.5% deduction based on user feedback (1.5% was too much).
    // At 1200m (~75s), this deducts ~0.37 seconds.
    // At 2400m (~155s), this deducts ~0.77 seconds.
    predictedSeconds = predictedSeconds * 0.995;

    // --- SECONDARY HEURISTICS (PROPORTIONAL / PERCENTAGE BASED) ---
    // Instead of using a hard-capped flat 0.5s modifier, we use a ratio (multiplier) applied to the total time.
    // This scales appropriately with the race distance (e.g. 1.0% of 120s is 1.2s, 1.0% of 60s is 0.6s).
    let totalPaceModifierRatio = 1.0;

    // 6. Handicap/Class Correlation (Kalite Puanı)
    if (currentHandicap !== undefined && currentHandicap > 0 && relevantRaces[0] && relevantRaces[0].handicap !== undefined && relevantRaces[0].handicap > 0) {
        // Average the handicap of the relevant history to find the horse's historical class
        let histHandicapSum = 0;
        let histHandicapCount = 0;
        relevantRaces.forEach(r => {
            if (r.handicap !== undefined && r.handicap > 0) {
                histHandicapSum += r.handicap;
                histHandicapCount++;
            }
        });

        if (histHandicapCount > 0) {
            const avgHistHandicap = histHandicapSum / histHandicapCount;
            const handicapDiff = currentHandicap - avgHistHandicap;
            // 1 Handikap point = 0.02% advantage
            totalPaceModifierRatio -= (handicapDiff * 0.0002);
        }
    }

    // 7. Jockey/Horse Synergy (At-Jokey Uyumu)
    if (currentJockey) {
        let winWithJockey = 0;
        let racesWithJockey = 0;
        history.forEach(r => {
            if (r.jockey === currentJockey) {
                racesWithJockey++;
                if (r.position === 1) winWithJockey++;
            }
        });

        if (racesWithJockey >= 3 && (winWithJockey / racesWithJockey) >= 0.33) {
            totalPaceModifierRatio -= 0.003; // 0.3% Synergy Bonus (Fast)
        } else if (racesWithJockey >= 5 && winWithJockey === 0) {
            totalPaceModifierRatio += 0.003; // 0.3% Synergy Penalty (Slow)
        }
    }

    // 8. Apranti Penalty
    // Inexperienced jockeys (Aprantis) lack the strength for the final sprint or make tactical errors.
    if (currentJockey && currentJockey.includes('ap')) {
        totalPaceModifierRatio += 0.004; // 0.4% Inexperience Penalty
    }

    // 9. Rest Days (Dinlenme / Yorgunluk)
    if (targetTimeMs > 0 && relevantRaces.length > 0 && relevantRaces[0].date) {
        const lastRaceTimeMs = parseDateStr(relevantRaces[0].date);
        const daysSinceLastRace = (targetTimeMs - lastRaceTimeMs) / (1000 * 60 * 60 * 24);

        if (daysSinceLastRace < 7) {
            totalPaceModifierRatio += 0.005; // 0.5% Fatigue penalty (Slow)
        } else if (daysSinceLastRace > 90) {
            totalPaceModifierRatio += 0.010; // 1.0% Rust/Fitness penalty (Slow)
        } else if (daysSinceLastRace >= 14 && daysSinceLastRace <= 28) {
            totalPaceModifierRatio -= 0.003; // 0.3% Peak fitness bonus (Fast)
        }
    }

    // 10. Recent Form (Güncel Form)
    // Analyze the horse's most recent starts to penalize out-of-form horses
    if (historyAtTargetMoment.length >= 2) {
        let poorFinishes = 0;
        let recentWins = 0;
        // Take up to 3 most recent races
        const recentFormRaces = historyAtTargetMoment.slice(0, 3);
        
        recentFormRaces.forEach(r => {
            if (r.position > 4 || r.position === 0) poorFinishes++;
            if (r.position === 1) recentWins++;
        });

        // If the horse failed to place top 4 in all of its recent starts, apply a moderate penalty
        if (poorFinishes === recentFormRaces.length) {
            totalPaceModifierRatio += 0.010; // 1.0% Penalty for terrible recent form
        } else if (recentWins > 0) {
            totalPaceModifierRatio -= 0.003; // 0.3% Bonus for winning recently
        }
    }

    // 11. Pedigree / Sire Bonus (Aygır Genetiği)
    if (currentSire) {
        const lowerSire = currentSire.toLowerCase();
        // Give a slight genetic bonus if the sire is a known Champion producer
        const championSires = ['luxor', 'kaneko', 'victory gallop', 'turbo', 'özgünhan', 'ayabakan'];
        if (championSires.some(s => lowerSire.includes(s))) {
            totalPaceModifierRatio -= 0.0015; 
        } else {
            totalPaceModifierRatio += 0.0015; 
        }
    }

    // 12. Trainer Form
    if (currentTrainer) {
        const lowerTrainer = currentTrainer.toLowerCase();
        const eliteTrainers = ['b.turgul', 'h.yüzbaşı', 'ş.çelik', 'm.korkmaz', 's.boyraz'];
        if (eliteTrainers.some(t => lowerTrainer.includes(t))) {
            totalPaceModifierRatio -= 0.0015; 
        } else {
            totalPaceModifierRatio += 0.0015; 
        }
    }

    // 13. Draw Bias (Kulvar Avantajı)
    if (currentDraw !== undefined && currentDraw > 0) {
        if (currentDistance <= 1400) {
            // Sprints heavily favor inside gates (1-4)
            if (currentDraw <= 3) totalPaceModifierRatio -= 0.002; // Inside advantage
            if (currentDraw >= 10) totalPaceModifierRatio += 0.003; // Wide disadvantage
        } else if (currentDistance >= 1900) {
            // Long routes can be bad for gate 1 (getting boxed in)
            if (currentDraw === 1 || currentDraw === 2) totalPaceModifierRatio += 0.0015;
        }
    }

    // 14. Class Drop / Hike (Sınıf Düşme / Çıkma)
    if (currentRaceName && history.length > 0) {
        const currentClassStrength = getClassStrength(currentRaceName);
        let histClassSum = 0;
        let validRacesCount = 0;
        history.forEach(r => {
            const rStrength = getClassStrength(r.raceClass);
            if (rStrength > 0) {
                histClassSum += rStrength;
                validRacesCount++;
            }
        });
        if (validRacesCount > 0) {
            const avgHistClassStr = histClassSum / validRacesCount;
            const classDiff = avgHistClassStr - currentClassStrength;
            
            // If historical quality is better (higher), this is a class drop -> horse is superior to opponents
            // Softened multiplier from 0.05 to 0.02 to prevent extreme outliers
            if (classDiff > 0.05) { 
                totalPaceModifierRatio -= classDiff * 0.02; 
            } else if (classDiff < -0.05) {
                // Class hike -> horse may be out of depth
                totalPaceModifierRatio += Math.abs(classDiff) * 0.02;
            }
        }
    }

    // 15. Distance Affinity (Mesafe Yatkınlığı)
    let maxDistanceProven = 0;
    history.forEach(r => {
        // Proven stamina if horse finished in Top 3
        if (r.position >= 1 && r.position <= 3) {
            if (r.distance > maxDistanceProven) {
                maxDistanceProven = r.distance;
            }
        }
    });

    if (maxDistanceProven > 0) {
        // Softened Stamina Checks
        if (currentDistance > maxDistanceProven + 200) {
            totalPaceModifierRatio += 0.003; // 0.3% stamina penalty (softened from 0.5%)
        } else if (currentDistance <= maxDistanceProven) {
            // Proven at this distance or longer
            totalPaceModifierRatio -= 0.001; // 0.1% stamina bonus (softened from 0.2%)
        }
    }

    // --- CLAMP TOTAL SECONDARY HEURISTICS MODIFIER ---
    // Protect against runaway multipliers. Cap exactly at +/- 1.5% globally.
    // In a 100s race (approx 1500m), max penalty stacked up is 1.5 seconds.
    // In a 150s race (approx 2400m), max penalty stacked up is 2.25 seconds.
    totalPaceModifierRatio = Math.max(0.985, Math.min(1.015, totalPaceModifierRatio));

    // Apply final modifier to predicted time
    predictedSeconds = predictedSeconds * totalPaceModifierRatio;

    // --- 13. HEAD-TO-HEAD (H2H) RELATIONAL ANALYSIS ---
    const h2hAdjustments: { horseName: string, adjustment: number }[] = [];
    if (otherHorsesHistoryAtTargetMoment) {
        for (const [otherHorseName, otherRaces] of Object.entries(otherHorsesHistoryAtTargetMoment)) {
            let winCount = 0;
            let lossCount = 0;

            relevantRaces.forEach(myRace => {
                if (!myRace.raceId) return;
                const sharedRace = otherRaces.find(r => r.raceId === myRace.raceId);
                if (sharedRace) {
                    if (myRace.position < sharedRace.position) winCount++;
                    else if (myRace.position > sharedRace.position) lossCount++;
                }
            });

            if (winCount > lossCount) {
                const adj = -0.15 * (winCount - lossCount);
                predictedSeconds += adj;
                h2hAdjustments.push({ horseName: otherHorseName, adjustment: adj });
            } else if (lossCount > winCount) {
                const adj = 0.15 * (lossCount - winCount);
                predictedSeconds += adj;
                h2hAdjustments.push({ horseName: otherHorseName, adjustment: adj });
            }
        }
    }

    let confidence = (relevantRaces.length / 5) * 100;

    // Decrease confidence slightly if we had to use track fallback
    if (usedBucketFallback) {
        // Drop confidence by 20% because cross-track conversions are less reliable
        confidence -= 20;
    }

    // slightly adjust confidence if distance variance is high
    const avgDistanceDiff = relevantRaces.reduce((acc, r) => acc + Math.abs(r.distance - currentDistance), 0) / relevantRaces.length;
    if (avgDistanceDiff > 100) {
        confidence -= 10;
    }

    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    return {
        predictedSeconds,
        predictedTimeStr: formatTime(predictedSeconds),
        confidence,
        relevantRacesCount: relevantRaces.length,
        h2hAdjustments,
        classQualityScore: Math.round(relevantRaces.reduce((acc, r) => acc + getClassStrength(r.raceClass), 0) / relevantRaces.length * 100)
    };
}
