import axios from 'axios';
import { getHorseHistory } from './src/lib/tjk';

async function test() {
    console.log("Fetching history for MONETA FLY (109858)...");
    const history = await getHorseHistory("109858");
    
    console.log("Calling local API /api/predict...");
    try {
        const res = await axios.post('http://localhost:3000/api/predict', {
            history: history,
            distance: 2000,
            trackType: "Sentetik",
            date: "19/03/2026",
            city: "Antalya",
            weight: "58",
            jockey: "M.KAYA"
        });
        
        console.log("Response:", JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.error("API Call failed:", e.response?.data || e.message);
    }
}

test();
