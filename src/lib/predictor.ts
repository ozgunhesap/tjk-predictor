import { PastRace } from './tjk';

export interface PredictionResult {
    predictedSeconds: number | null;
    predictedTimeStr: string | null;
    confidence: number; // 0-100 based on relevant races
    relevantRacesCount: number;
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
    currentHandicap?: number
): PredictionResult {
    // Helper to parse DD/MM/YYYY into a Date object for safe comparison
    const parseDateStr = (dStr: string) => {
        if (!dStr) return 0;
        const pts = dStr.split(/[\/\.]/);
        if (pts.length === 3) {
            return new Date(parseInt(pts[2]), parseInt(pts[1]) - 1, parseInt(pts[0])).getTime();
        }
        return 0;
    };

    const targetTimeMs = targetDate ? parseDateStr(targetDate) : 0;
    if (!history || history.length === 0) {
        return { predictedSeconds: null, predictedTimeStr: null, confidence: 0, relevantRacesCount: 0 };
    }

    // Determine horse breed/type generically by historical speed base. 
    // Arab horses are naturally slower (Pace > 0.066 sec/m) than English horses.
    const overallAvgHistoryPace = history.length > 0 ? (parseTime(history[0].time) / history[0].distance) : 0.068;
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
            if (targetTimeMs > 0 && race.date) {
                const raceTimeMs = parseDateStr(race.date);
                if (raceTimeMs >= targetTimeMs) return false;
            }
            if (race.city && (race.city.toLowerCase().includes('şanlıurfa') || race.city.toLowerCase().includes('diyarbakır'))) return false;

            const isSimilarDistance = Math.abs(race.distance - currentDistance) <= maxDistanceDiff;
            const isValidTime = race.time && race.time !== "Derecesiz" && race.time.includes('.');

            if (!isSimilarDistance || !isValidTime) return false;

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

    let relevantRaces = filterValidRaces(history, true); // Strict exact match first
    let usedBucketFallback = false;

    // 2. FALLBACK: If not enough exact track races, fallback to the REST OF THE BUCKET
    // e.g. Target is Turf, fallback to Synthetic. Target is Dirt, no fallback available.
    if (relevantRaces.length < 2) {
        const bucketRaces = filterValidRaces(history, false);
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

            // 1. Distance Corellation: Longer races have slower pace, shorter races have faster pace.
            // Assumption: Every 1 meter of distance change affects pace by 0.000006 seconds/meter
            const distanceDiff = currentDistance - race.distance;
            const distancePaceEffect = distanceDiff * 0.000006;
            let adjustedPace = basePace + distancePaceEffect;

            // NEW: Sprint-to-Route Stamina Tax
            // If the historical race was a Sprint (<1500m) and the target race is a Route (>=1500m),
            // the linear distance indexing is not enough. The horse will hit an aerobic wall.
            if (race.distance < 1500 && currentDistance >= 1500) {
                adjustedPace = adjustedPace * 1.015; // 1.5% pace penalty for sudden aerobic demand
            }

            // 2. City Track Correlation: Different cities have different track qualities affecting speed.
            const pastCityIndex = CITY_SPEED_INDEX[race.city] || 1.0;
            const cityAdjustmentRatio = currentCityIndex / pastCityIndex;
            adjustedPace = adjustedPace * cityAdjustmentRatio;

            // 3. Weight Correlation: Carrying more weight slows the horse down.
            // Heuristic: 1kg difference = 0.000075 seconds per meter reduction in pace.
            // Example: +5kg difference over 2000m adds roughly 0.75 seconds.
            if (currentWeight !== undefined && race.weight > 0) {
                const weightDiff = currentWeight - race.weight;
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

                history.forEach(h => {
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

                // Capping the conversion impact so it never blows up a prediction by more than 4%
                personalRatio = Math.max(0.96, Math.min(1.04, personalRatio));

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

            // Cap extreme condition swings to +/- 2% max
            conditionRatio = Math.max(0.98, Math.min(1.02, conditionRatio));
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

    // --- SECONDARY HEURISTICS (HARD CAPPED TO +/- 0.5 SECONDS TOTAL) ---
    // The user requested to bring back all minor variables but prevent them from overwhelming the core distance/pace math.
    let totalTimeModifier = 0; // in seconds

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
            // 1 Handikap point = 0.05 seconds advantage. Max +/- 0.5 sec limit will be applied at the end.
            totalTimeModifier -= (handicapDiff * 0.05);
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
            totalTimeModifier -= 0.15; // Synergy Bonus (Fast)
        } else if (racesWithJockey >= 5 && winWithJockey === 0) {
            totalTimeModifier += 0.15; // Synergy Penalty (Slow)
        }
    }

    // 8. Apranti Penalty
    // Inexperienced jockeys (Aprantis) lack the strength for the final sprint or make tactical errors.
    if (currentJockey && currentJockey.includes('ap')) {
        totalTimeModifier += 0.15; // Inexperience Penalty
    }

    // 9. Rest Days (Dinlenme / Yorgunluk)
    if (targetTimeMs > 0 && relevantRaces.length > 0 && relevantRaces[0].date) {
        const lastRaceTimeMs = parseDateStr(relevantRaces[0].date);
        const daysSinceLastRace = (targetTimeMs - lastRaceTimeMs) / (1000 * 60 * 60 * 24);

        if (daysSinceLastRace < 7) {
            totalTimeModifier += 0.20; // Fatigue penalty (Slow)
        } else if (daysSinceLastRace > 90) {
            totalTimeModifier += 0.25; // Rust/Fitness penalty (Slow)
        } else if (daysSinceLastRace >= 14 && daysSinceLastRace <= 28) {
            totalTimeModifier -= 0.05; // Peak fitness bonus (Fast) (Normalized)
        }
    }

    // 10. Pedigree / Sire Bonus (Aygır Genetiği)
    if (currentSire) {
        const lowerSire = currentSire.toLowerCase();
        // Give a slight genetic bonus if the sire is a known Champion producer
        const championSires = ['luxor', 'kaneKo', 'victory gallop', 'turbo', 'özgünhan', 'ayabakan'];
        if (championSires.some(s => lowerSire.includes(s))) {
            totalTimeModifier -= 0.05; // Normalized
        } else {
            totalTimeModifier += 0.05; // Baseline normalization tax for standard sires
        }
    }

    // 11. Trainer Form
    // Since we don't have a backend DB tracking all trainer wins, we just give a slight bump to universally elite trainers
    if (currentTrainer) {
        const lowerTrainer = currentTrainer.toLowerCase();
        const eliteTrainers = ['b.turgul', 'h.yüzbaşı', 'ş.çelik', 'm.korkmaz', 's.boyraz'];
        if (eliteTrainers.some(t => lowerTrainer.includes(t))) {
            totalTimeModifier -= 0.05; // Normalized
        } else {
            totalTimeModifier += 0.05; // Baseline normalization tax for standard trainers
        }
    }

    // 12. Draw Bias (Kulvar Avantajı)
    if (currentDraw !== undefined && currentDraw > 0) {
        if (currentDistance <= 1400) {
            // Sprints heavily favor inside gates (1-4)
            if (currentDraw <= 3) totalTimeModifier -= 0.10; // Inside advantage
            if (currentDraw >= 10) totalTimeModifier += 0.15; // Wide disadvantage
        } else if (currentDistance >= 1900) {
            // Long routes can be bad for gate 1 (getting boxed in)
            if (currentDraw === 1 || currentDraw === 2) totalTimeModifier += 0.05;
        }
    }

    // --- CLAMP TOTAL SECONDARY HEURISTICS MODIFIER ---
    // User requested absolute limit: Maximum +/- 0.5 seconds impact from all secondary factors combined!
    totalTimeModifier = Math.max(-0.50, Math.min(0.50, totalTimeModifier));

    // Apply final modifier to predicted time
    predictedSeconds += totalTimeModifier;

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
        relevantRacesCount: relevantRaces.length
    };
}
