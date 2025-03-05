const express = require('express');
const puppeteer = require('puppeteer');

const router = express.Router();

router.post('/getStats', async (req, res) => {
    const playerNames = req.body.playerNames;

    if (!Array.isArray(playerNames)) {
        return res.status(400).send('Request body must contain an array of playerNames');
    }

    const allResults = [];
    let browser;
    let page; // Declare page outside the loop

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--enable-javascript',
                '--disable-extensions',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
            ],
        });

        page = await browser.newPage(); // Create page once
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setJavaScriptEnabled(true);

        for (const playerName of playerNames) {
            const url = `https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/${playerName}/segments/career?mode=competitive&season=3`;

            try {
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
                    const playerRank = overallStats?.stats?.ranked?.displayValue || "Unranked";

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
                        const roundedRate = matchesPlayed > 0 ? Math.floor((matches / matchesPlayed) * 100) : 0;
                        otpList.push({ playerName: playerName, hero, rate: roundedRate, rank: playerRank });
                    });

                    allResults.push(...otpList);
                }
            } catch (pageError) {
                console.error(`Error fetching stats for ${playerName}:`, pageError);
            }
        }

        allResults.sort((a, b) => b.rate - a.rate);
        res.json(allResults);
    } catch (browserError) {
        console.error('Error:', browserError);
        res.status(500).send('An error occurred');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

module.exports = router;