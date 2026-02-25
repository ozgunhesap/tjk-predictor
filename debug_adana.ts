import { getTodayLocations, getRacesForLocation, getHorsesForRace, getHorseHistory } from './src/lib/tjk.js';
import { predictRaceTime } from './src/lib/predictor.js';

async function main() {
    const targetDate = '24/02/2026';
    const locs = await getTodayLocations(targetDate);
    const adana = locs.find(l => l.name.toLowerCase().includes('adana'));
    if (!adana) return;

    const races = await getRacesForLocation(adana.id, adana.name, targetDate);

    for (const r of races) {
        if (r.number === 5 || r.number === 7) {
            console.log(`\n===========================================`);
            console.log(`RACE ${r.number} - Distance: ${r.distance}, Track: ${r.trackType}`);
            console.log(`===========================================`);

            const horses = await getHorsesForRace(adana.id, adana.name, targetDate, r.id);
            const distance = r.distance || 0;
            const trackType = r.trackType || 'Kum';
            const results = [];

            for (const horse of horses) {
                const history = await getHorseHistory(horse.id);
                const weight = parseFloat(horse.weight.replace(',', '.'));

                try {
                    const pred = predictRaceTime(
                        history, distance, trackType, targetDate, 'Adana', weight, undefined, horse.jockey, horse.sire, horse.trainer, horse.draw, horse.handicap
                    );
                    if (pred.predictedSeconds) {
                        results.push({ name: horse.name, no: horse.number, secs: pred.predictedSeconds, str: pred.predictedTimeStr, hist: history.length });
                    }
                } catch (e) { }
            }

            // Sort by predicted time
            results.sort((a, b) => a.secs - b.secs);

            for (let i = 0; i < results.length; i++) {
                const res = results[i];
                let margin = "0.00";
                if (i > 0) margin = (res.secs - results[0].secs).toFixed(2);
                console.log(`${i + 1}. No: ${res.no} - ${res.name} | Time: ${res.str} (+${margin}s) | Races: ${res.hist}`);
            }
        }
    }
}

main().catch(console.error);
