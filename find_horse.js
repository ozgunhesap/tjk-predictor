import { getProgram, getRaceHorses, getHorseHistory } from './src/lib/tjk.js';
import { predictRaceTime } from './src/lib/predictor.js';

async function main() {
    const program = await getProgram('today');
    const adana = program.locations.find(l => l.name.toLowerCase().includes('adana'));
    if (!adana) {
        console.log("No Adana races today.");
        return;
    }
    
    console.log(`Found Adana. Races: ${adana.races.length}`);
    for (const race of adana.races) {
        if (race.distance === 2000) {
            console.log(`Checking Race ${race.number} (Distance: ${race.distance}, Track: ${race.trackType})`);
            const horses = await getRaceHorses(adana.id, race.id);
            for (const horse of horses) {
                const history = await getHorseHistory(horse.id);
                // currentDistance, currentTrackType, targetDate, currentCity, currentWeight, currentCondition, currentJockey, currentSire, currentTrainer, currentDraw, currentHandicap
                const prediction = predictRaceTime(
                    history, 
                    2000, 
                    race.trackType, 
                    'today', 
                    'Adana', 
                    parseFloat((horse.weight || '50').replace(',', '.')), 
                    'Normal', // condition
                    horse.jockey, 
                    horse.sire, 
                    horse.trainer, 
                    horse.draw ? parseInt(horse.draw) : undefined, 
                    horse.handicap ? parseInt(horse.handicap) : undefined
                );
                
                if (prediction.predictedTimeStr) {
                    console.log(`Horse: ${horse.name} (${horse.number}) - Predicted: ${prediction.predictedTimeStr}`);
                    
                    // Did it run 2.23.79?
                    const run223 = history.find(r => r.time === '2.23.79');
                    if (run223) {
                        console.log(`!!! FOUND THE HORSE !!! Name: ${horse.name}`);
                        console.log(`It ran 2.23.79 on ${run223.date} in ${run223.city} - Distance: ${run223.distance} - Track: ${run223.trackType} - Weight: ${run223.weight}`);
                        console.log(`Prediction Confidence: ${prediction.confidence}, Relevant races count: ${prediction.relevantRacesCount}`);
                        console.log(JSON.stringify(history.filter(r => r.distance >= 1600).slice(0, 5), null, 2));
                    }
                }
            }
        }
    }
}

main().catch(console.error);
