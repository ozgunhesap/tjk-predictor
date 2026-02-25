import { getTodayLocations, getRacesForLocation, getHorsesForRace, getHorseHistory } from './src/lib/tjk';
import { predictRaceTime, parseTime, formatTime } from './src/lib/predictor';

async function backtestDate(targetDate: string, cityToTest: string) {
    console.log(`\n================================`);
    console.log(`BACKTESTING ${cityToTest} ON ${targetDate}`);
    console.log(`================================`);

    let locations: any[] = [];
    try {
        locations = await getTodayLocations(targetDate);
    } catch (e) {
        console.error("Failed to get locations:", e);
        return;
    }

    let location = locations.find((l: any) => l.name.toLowerCase().includes(cityToTest.toLowerCase()));
    if (!location) {
        console.log(`${cityToTest} not found on ${targetDate}.`);
        return;
    }

    let races: any[] = [];
    try {
        races = await getRacesForLocation(location.id, location.name, targetDate);
    } catch (e) {
        console.error("Failed to get races:", e);
        return;
    }

    // Test just 3 races to save API time
    const testRaces = races.slice(0, 3);

    for (const race of testRaces) {
        console.log(`\n--- RACE ${race.number}: ${race.distance}m ${race.trackType} ---`);
        const horses = await getHorsesForRace(location.id, location.name, targetDate, race.id);
        const results = [];

        for (const horse of horses) {
            const history = await getHorseHistory(horse.id);
            const currentWeight = parseFloat((String(horse.weight) || '50').replace(',', '.'));

            // 1. Find the ACTUAL result from the history
            const actualRace = history.find((h: any) => h.date === targetDate.replace(/\//g, '.'));
            let actualSeconds = null;
            let actualTimeStr = "Derecesiz";
            let actualPosition = null;

            if (actualRace && actualRace.time && actualRace.time.includes('.')) {
                actualSeconds = parseTime(actualRace.time);
                actualTimeStr = actualRace.time;
                actualPosition = actualRace.position;
            } else {
                continue;
            }

            // 2. Predict the time blindly based on history BEFORE the target date
            const pred = predictRaceTime(
                history,
                race.distance,
                race.trackType || 'Kum',
                targetDate,
                location.name,
                currentWeight,
                'Normal',
                horse.jockey,
                horse.sire,
                horse.trainer,
                horse.draw ? parseInt(String(horse.draw)) : undefined,
                horse.handicap ? parseInt(String(horse.handicap)) : undefined
            );

            if (pred && pred.predictedSeconds) {
                const diff = (pred.predictedSeconds - actualSeconds).toFixed(2);
                results.push({
                    no: horse.number,
                    name: horse.name,
                    predicted: pred.predictedSeconds,
                    predictedStr: pred.predictedTimeStr,
                    actual: actualSeconds,
                    actualStr: actualTimeStr,
                    actualPos: actualPosition,
                    diff: parseFloat(diff),
                    confidence: pred.confidence
                });
            }
        }

        // Sort by Predicted
        results.sort((a, b) => a.predicted - b.predicted);

        console.log(`[PREDICTIONS VS REALITY]`);
        let maeSum = 0;
        let biasSum = 0;
        results.forEach((r, idx) => {
            const diffMark = r.diff > 0 ? "SLOWER" : "FASTER";
            const diffAbs = Math.abs(r.diff).toFixed(2);
            maeSum += Math.abs(r.diff);
            biasSum += r.diff;

            console.log(`${idx + 1}. [${r.no}] ${r.name.padEnd(20)} | Pred: ${r.predictedStr} | Actual: ${r.actualStr} (Pos: ${r.actualPos}) | AI was ${diffAbs}s ${diffMark}`);
        });

        if (results.length > 0) {
            console.log(`-> Mean Absolute Error (MAE): ${(maeSum / results.length).toFixed(2)}s`);
            console.log(`-> Mean Bias (Direction): ${(biasSum / results.length).toFixed(2)}s (Positive means AI predicts SLOWER than reality)`);
        }
    }
}

async function run() {
    await backtestDate('21/02/2026', 'Adana');
    await backtestDate('20/02/2026', 'İzmir');
}

run().catch(console.error);
