import { getTodayLocations, getRacesForLocation, getHorsesForRace, getHorseHistory } from './src/lib/tjk';
import { predictRaceTime, formatTime } from './src/lib/predictor';

async function main() {
    const targetDate = '22/02/2026';
    console.log(`Fetching locations for ${targetDate}...`);

    let locations: any[] = [];
    try {
        locations = await getTodayLocations(targetDate);
    } catch (e) {
        console.error("Failed to get locations:", e);
    }

    let adana = locations.find((l: any) => l.name.toLowerCase().includes('adana'));
    if (!adana) {
        adana = { id: "1", name: "Adana" } as any; // Usually ID 1 or 5
    }

    console.log(`Found Adana. Fetching races...`);
    let races: any[] = [];
    try {
        races = await getRacesForLocation(adana.id, adana.name, targetDate);
    } catch (e) {
        console.error("Failed to get races:", e);
        return;
    }

    const targetRaces = [2, 4, 8];

    for (const raceNum of targetRaces) {
        const race = races.find((r: any) => parseInt(r.number) === raceNum);
        if (!race) {
            console.log(`Race ${raceNum} not found.`);
            continue;
        }

        console.log(`\n========================================`);
        console.log(`RACE ${raceNum} - Dist: ${race.distance}m, Track: ${race.trackType}`);
        console.log(`========================================`);

        const horses = await getHorsesForRace(adana.id, adana.name, targetDate, race.id);
        const predictions = [];

        for (const horse of horses) {
            const history = await getHorseHistory(horse.id);
            const currentWeight = parseFloat((String(horse.weight) || '50').replace(',', '.'));

            const pred = predictRaceTime(
                history,
                race.distance,
                race.trackType || 'Kum',
                targetDate,
                'Adana',
                currentWeight,
                'Normal',
                horse.jockey,
                horse.sire,
                horse.trainer,
                horse.draw ? parseInt(String(horse.draw)) : undefined,
                horse.handicap ? parseInt(String(horse.handicap)) : undefined
            );

            if (pred && pred.predictedSeconds) {
                // If it's the anomalous horse, let's print their 1 race
                if (horse.name === 'SHADOW SOLDIER' || horse.name === 'TUNA ADAM' || horse.name === 'FIRE OF TYGAR') {
                    console.log(`\n[TRACE] ${horse.name}:`);
                    const maxDistanceDiff = race.distance * 0.20;
                    const relevant = history.filter((r: any) => {
                        if (r.date) {
                            const pts = r.date.split(/[\/\.]/);
                            const raceTimeMs = new Date(parseInt(pts[2]), parseInt(pts[1]) - 1, parseInt(pts[0])).getTime();
                            if (raceTimeMs >= new Date(2026, 1, 22).getTime()) return false;
                        }
                        if (r.city && (r.city.toLowerCase().includes('şanlıurfa') || r.city.toLowerCase().includes('diyarbakır') || r.city.toLowerCase().includes('sanliurfa') || r.city.toLowerCase().includes('diyarbakir'))) {
                            return false;
                        }
                        const isSameTrack = r.trackType === race.trackType;
                        const isSimilarDistance = Math.abs(r.distance - race.distance) <= maxDistanceDiff;
                        return isSameTrack && isSimilarDistance && r.time && r.time.includes('.');
                    }).slice(0, 5);

                    relevant.forEach((r: any) => {
                        console.log(`  -> Ran ${r.time} at ${r.distance}m in ${r.city} on ${r.trackType} (${r.date}) Weight: ${r.weight}`);
                    });
                }

                predictions.push({
                    name: horse.name,
                    no: horse.number,
                    seconds: pred.predictedSeconds,
                    timeStr: pred.predictedTimeStr,
                    relevantCount: pred.relevantRacesCount,
                    historyLen: history.length
                });
            }
        }

        predictions.sort((a, b) => a.seconds - b.seconds);

        for (let i = 0; i < predictions.length; i++) {
            const p = predictions[i];
            const gap = i === 0 ? "0.00" : (p.seconds - predictions[0].seconds).toFixed(2);
            console.log(`${i + 1}. [${p.no}] ${p.name.padEnd(20)} | Time: ${p.timeStr} (${p.seconds.toFixed(2)}s) | Gap to 1st: +${gap}s | Base Races: ${p.relevantCount}/${p.historyLen}`);
        }
    }
}

main().catch(console.error);
