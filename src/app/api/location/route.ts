import { NextResponse } from 'next/server';
import { getRacesForLocation } from '@/lib/tjk';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const locationName = searchParams.get('locationName');
    const dateStr = searchParams.get('date') || new Date().toLocaleDateString('tr-TR');

    if (!locationId || !locationName) {
        return NextResponse.json({ error: 'Missing locationId or locationName' }, { status: 400 });
    }

    try {
        const races = await getRacesForLocation(locationId, locationName, dateStr);
        return NextResponse.json({ races });
    } catch (error) {
        console.error('API Error /location:', error);
        return NextResponse.json({ error: 'Failed to fetch races for location' }, { status: 500 });
    }
}
