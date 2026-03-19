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
        return NextResponse.json({ history });
    } catch (error) {
        console.error('API Error /horse:', error);
        return NextResponse.json({ error: 'Failed to fetch horse history' }, { status: 500 });
    }
}
