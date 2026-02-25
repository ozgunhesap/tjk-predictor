const axios = require('axios');
const cheerio = require('cheerio');
const predictor = require('./src/lib/predictor.ts');

async function testPast() {
    const { getProgram, getRacesForLocation, getHorseHistory } = require('./src/lib/tjk.ts');
    // Load TS config correctly for direct run
}
