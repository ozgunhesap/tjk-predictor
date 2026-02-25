import { NextResponse } from 'next/server';
import { getHorseHistory } from '@/lib/tjk';
import { predictRaceTime } from '@/lib/predictor';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const horseId = searchParams.get('horseId');
    const distanceStr = searchParams.get('distance');
    const trackType = searchParams.get('trackType');
    const targetDate = searchParams.get('date');
    const city = searchParams.get('city');
    const weightStr = searchParams.get('weight');
    const jockey = searchParams.get('jockey');
    const sire = searchParams.get('sire');
    const trainer = searchParams.get('trainer');
    const drawStr = searchParams.get('draw');
    const handicapStr = searchParams.get('handicap');

    if (!horseId) {
        return NextResponse.json({ error: 'Missing horseId' }, { status: 400 });
    }

    try {
        const history = await getHorseHistory(horseId);

        let prediction = null;
        if (distanceStr && trackType) {
            const distance = parseInt(distanceStr, 10);
            const weight = weightStr ? parseFloat(weightStr.replace(',', '.')) : undefined;
            const draw = drawStr ? parseInt(drawStr, 10) : undefined;
            const handicap = handicapStr ? parseInt(handicapStr, 10) : undefined;
            try {
                prediction = predictRaceTime(history, distance, trackType, targetDate || undefined, city || undefined, weight, undefined, jockey || undefined, sire || undefined, trainer || undefined, draw, handicap);
                console.log(`[API Debug] Horse ${horseId} predicted:`, prediction);
            } catch (e) {
                console.error(`[API Debug] predictRaceTime crash!`, e);
            }
        }

        return NextResponse.json({ history, prediction });
    } catch (error) {
        console.error('API Error /horse:', error);
        return NextResponse.json({ error: 'Failed to fetch horse history' }, { status: 500 });
    }
}
