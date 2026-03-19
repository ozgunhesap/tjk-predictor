import { getHorseHistory } from './src/lib/tjk';

async function test() {
    console.log("Fetching history for horse 109858 (MONETA FLY)...");
    const history = await getHorseHistory("109858");
    console.log(`History count: ${history.length}`);
    history.slice(0, 3).forEach(r => {
        console.log(`- ${r.date} | ${r.city} | ${r.distance}m | Track: ${r.trackType} | Time: ${r.time}`);
    });
}

test();
