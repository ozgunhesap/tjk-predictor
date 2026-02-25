
import { getHorseHistory } from './src/lib/tjk';
import { predictRaceTime } from './src/lib/predictor';

async function run() {
    try {
        console.log("Fetching history for 106734...");
        const history = await getHorseHistory('106734');
        console.log("History length:", history.length);
        
        console.log("Running prediction...");
        const p = predictRaceTime(history, 1200, 'Kum', '19/02/2026', 'İzmir', 58, 'N.AVC');
        console.log("Prediction success!");
        console.log(p);
    } catch(e) {
        console.error("CRASH IN PREDICTOR:", e);
    }
}
run();
