import axios from 'axios';

async function test() {
    console.log("Fetching main page to get cookies...");
    const session = await axios.get('https://www.tjk.org/TR/YarisSever/Info/Page/GunlukYarisProgrami', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const cookies = session.headers['set-cookie'];
    console.log("Got cookies:", cookies?.length || 0);

    const url = 'https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisProgrami';
    const params = new URLSearchParams();
    params.append('SehirId', '3');
    params.append('QueryParameter_Tarih', '21/02/2026');
    params.append('Era', 'today');

    console.log("Fetching city data with cookies...");
    try {
        const { data } = await axios.post(url, params, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies ? cookies.join('; ') : ''
            }
        });
        console.log("Data length:", data.length);
        console.log("Matches '223288':", data.includes('223288'));
    } catch(e: any) {
        console.log("Error:", e.message);
    }
}
test();
