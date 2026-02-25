import * as cheerio from 'cheerio';
import * as fs from 'fs';

const data = fs.readFileSync('/tmp/tjk_istanbul.html', 'utf8');
const $ = cheerio.load(data);
console.log("Races tabs found:", $('ul[class*="races-tabs"]').length);
console.log("Links found:", $('ul[class*="races-tabs"] > li > h3.race-no > a').length);
