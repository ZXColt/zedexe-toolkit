// filepath: /home/colton/dl-api/src/routes/rivals-stats.js
const express = require('express');
const { Cluster } = require('puppeteer-cluster');

const router = express.Router();

router.post('/getStats', async (req, res) => {
    const playerNames = req.body.playerNames;

    if (!Array.isArray(playerNames)) {
        return res.status(400).send('Request body must contain an array of playerNames');
    }

    const allResults = [];

    try {
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 1, // Adjust this based on your server's capacity
            puppeteerOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--enable-javascript',
                    '--disable-extensions',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--incognito',
                    '--disable-blink-features=AutomationControlled',
                ],
                timeout: 60000, // Increase the timeout to 60 seconds
            },
        });

        await cluster.task(async ({ page, data: playerName }) => {
            const url = `https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/${playerName}/segments/career?mode=competitive&season=3`;

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            await page.setExtraHTTPHeaders({
                'accept-language': 'en-US,en;q=0.9',
                'upgrade-insecure-requests': '1',
            });

            await page.setJavaScriptEnabled(true);
            await page.goto(url, { waitUntil: 'networkidle2' });

            const jsonData = await page.evaluate(() => {
                const preElement = document.querySelector('pre');
                if (!preElement) return null;
                return JSON.parse(preElement.innerText).data;
            });

            if (jsonData) {
                let matchesPlayed = 0;
                const otpList = [];

                const overallStats = jsonData.find(item => item.type === 'overview');
                const playerRank = overallStats.stats.ranked.displayValue;

                const heroStats = jsonData.filter(item => item.type === 'hero');
                const heroMap = new Map();

                heroStats.forEach(hero => {
                    const heroName = hero.metadata.name;
                    const matches = hero.stats.matchesPlayed.value;
                    if (matches) {
                        heroMap.set(heroName, matches);
                        matchesPlayed += matches;
                    }
                });

                const sortedHeroMap = new Map([...heroMap.entries()].sort((a, b) => b[1] - a[1]));

                sortedHeroMap.forEach((matches, hero) => {
                    const roundedRate = Math.floor((matches / matchesPlayed) * 100);
                    otpList.push({ playerName: playerName, hero, rate: roundedRate, rank: playerRank });
                });

                allResults.push(...otpList);
            }
        });

        for (const playerName of playerNames) {
            cluster.queue(playerName);
        }

        await cluster.idle();
        await cluster.close();

        // Sort all results by rate outside the loop
        allResults.sort((a, b) => b.rate - a.rate);

        res.json(allResults);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).send('An error occurred while fetching stats');
    }
});

module.exports = router;