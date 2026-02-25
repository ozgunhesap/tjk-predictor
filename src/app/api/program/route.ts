import { NextResponse } from 'next/server';
import { getTodayLocations } from '@/lib/tjk';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    try {
        const locations = await getTodayLocations(date || undefined);
        return NextResponse.json({ locations });
    } catch (error) {
        console.error('API Error /program:', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }
}
