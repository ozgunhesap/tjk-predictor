import { NextResponse } from 'next/server';
import { predictRaceTime } from '@/lib/predictor';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            history,
            distance,
            trackType,
            date,
            city,
            weight,
            jockey,
            sire,
            trainer,
            draw,
            handicap,
            otherRaces,
            raceName
        } = body;

        if (!history || !distance || !trackType) {
            return NextResponse.json({ error: 'Missing required parameters (history, distance, trackType)' }, { status: 400 });
        }

        const prediction = predictRaceTime(
            history,
            distance,
            trackType,
            date,
            city,
            weight,
            undefined,
            jockey,
            sire,
            trainer,
            draw,
            handicap,
            otherRaces,
            raceName
        );

        return NextResponse.json({ prediction });
    } catch (error) {
        console.error('API Error /predict:', error);
        return NextResponse.json({ error: 'Prediction failed' }, { status: 500 });
    }
}
