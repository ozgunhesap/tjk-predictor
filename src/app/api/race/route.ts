import { NextResponse } from 'next/server';
import { getHorsesForRace } from '@/lib/tjk';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const locationName = searchParams.get('locationName');
    const dateStr = searchParams.get('date') || new Date().toLocaleDateString('tr-TR');
    const raceId = searchParams.get('raceId');

    if (!locationId || !locationName || !raceId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const horses = await getHorsesForRace(locationId, locationName, dateStr, raceId);
        return NextResponse.json({ horses });
    } catch (error) {
        console.error('API Error /race:', error);
        return NextResponse.json({ error: 'Failed to fetch horses for race' }, { status: 500 });
    }
}
