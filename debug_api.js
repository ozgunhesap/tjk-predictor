async function run() {
    try {
        const locRes = await fetch('http://localhost:3000/api/program?date=22/02/2026');
        const locData = await locRes.json();
        const izmir = locData.locations.find(l => l.name === 'İzmir');

        if (!izmir) {
            console.log("Izmir not found");
            return;
        }

        const raceRes = await fetch(`http://localhost:3000/api/location?locationId=${izmir.id}&locationName=İzmir&date=22/02/2026`);
        const raceData = await raceRes.json();
        const lastRace = raceData.races[raceData.races.length - 1];

        console.log("Last Race:", lastRace);

        const horseRes = await fetch(`http://localhost:3000/api/race?locationId=${izmir.id}&locationName=İzmir&raceId=${lastRace.id}&date=22/02/2026`);
        const horseData = await horseRes.json();

        const horse9 = horseData.horses.find(h => h.number === '9');
        console.log("Horse 9:", horse9);

        // Fetch prediction for horse 9
        const pURL = `http://localhost:3000/api/horse?horseId=${horse9.id}&distance=${lastRace.distance}&trackType=${encodeURIComponent(lastRace.trackType)}&date=22/02/2026&city=İzmir&weight=${horse9.weight}&jockey=${encodeURIComponent(horse9.jockey)}&sire=${encodeURIComponent(horse9.sire || '')}&trainer=${encodeURIComponent(horse9.trainer || '')}&draw=${horse9.draw || ''}`;
        const p9 = await fetch(pURL);
        console.log("Prediction 9:", await p9.json());

        // Fetch prediction for top horse as comparison
        const horse8 = horseData.horses.find(h => h.number === '8');
        const pURL8 = `http://localhost:3000/api/horse?horseId=${horse8.id}&distance=${lastRace.distance}&trackType=${encodeURIComponent(lastRace.trackType)}&date=22/02/2026&city=İzmir&weight=${horse8.weight}&jockey=${encodeURIComponent(horse8.jockey)}&sire=${encodeURIComponent(horse8.sire || '')}&trainer=${encodeURIComponent(horse8.trainer || '')}&draw=${horse8.draw || ''}`;
        const p8 = await fetch(pURL8);
        console.log("Prediction 8:", await p8.json());

        const sortedHorses = [...horseData.horses];
        for (let horse of sortedHorses) {
            const up = `http://localhost:3000/api/horse?horseId=${horse.id}&distance=${lastRace.distance}&trackType=${encodeURIComponent(lastRace.trackType)}&date=22/02/2026&city=İzmir&weight=${horse.weight}&jockey=${encodeURIComponent(horse.jockey)}&sire=${encodeURIComponent(horse.sire || '')}&trainer=${encodeURIComponent(horse.trainer || '')}&draw=${horse.draw || ''}`;
            const res = await fetch(up);
            const data = await res.json();
            horse.pred = data.prediction;
        }

        sortedHorses.sort((a, b) => {
            const predA = a.pred.predictedSeconds;
            const predB = b.pred.predictedSeconds;
            if (predA && predB) return predA - predB;
            if (predA) return -1;
            if (predB) return 1;
            return parseInt(a.number) - parseInt(b.number);
        });

        console.log("Top 3:");
        console.log(sortedHorses.slice(0, 3).map(h => `${h.number} - ${h.name} : ${h.pred.predictedTimeStr} (${h.pred.predictedSeconds}) | Jockey: ${h.jockey} | Weight: ${h.weight} | Sire: ${h.sire} | Draw: ${h.draw}`));

    } catch (e) {
        console.error(e);
    }
}
run();
