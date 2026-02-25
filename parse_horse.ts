import * as cheerio from 'cheerio';
import * as fs from 'fs';
import axios from 'axios';

axios.get("https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=109646")
.then(res => {
    const $ = cheerio.load(res.data);
    let count = 0;
    $('tr').each((i, tr) => {
        const tds = $(tr).find('td');
        if(tds.length > 10 && count < 3) {
            console.log("--- Race ---");
            tds.each((j, td) => {
                console.log(`TD ${j}: ` + $(td).text().trim().replace(/\s+/g, ' '));
                const d = $(td).attr('data-original-title');
                if (d) console.log(`  title: ` + d);
            });
            count++;
        }
    })
});
