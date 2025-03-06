const express = require('express');
const axios = require('axios');
const heroes = require('../data/heroes.json'); // Import heroes from JSON file

const router = express.Router();

function getHeroNames(heroIds) {
    return heroIds.map(id => {
        const hero = heroes.find(h => h.hero_id === id);
        return hero ? hero.name : `Hero ID ${id} not found`;
    });
}

router.post('/getStats', async (req, res) => {
    const playerNames = req.body.playerNames;

    if (!Array.isArray(playerNames)) {
        return res.status(400).send('Request body must contain an array of playerNames');
    }

    const allResults = [];

    try {
        for (const playerName of playerNames) {

            const findPlayerUrl = 'https://rivalsmeta.com/api/find-player';
            const requestBody = { name: playerName };
            console.log(`Requesting player ID for ${playerName} with body: ${JSON.stringify(requestBody)}`);

            const findPlayerResponse = await axios.post(findPlayerUrl, requestBody);

            if (findPlayerResponse.status !== 200) {
                console.error(`Failed to find player ID for ${playerName}: ${findPlayerResponse.status} ${findPlayerResponse.statusText}. Response: ${findPlayerResponse.data}`);
                return res.status(findPlayerResponse.status).send(`Failed to find player ID for ${playerName}`);
            }

            const findPlayerData = findPlayerResponse.data;
            const playerId = findPlayerData[0].aid;

            if (!playerId) {
                console.error(`Player ID not found for ${playerName}`);
                return res.status(404).send(`Player ID not found for ${playerName}`);
            }

            const url = `https://rivalsmeta.com/api/player/${playerId}?season=3`;

            const response = await axios.get(url);
            if (response.status !== 200) {
                console.error(`Failed to fetch stats for ${playerId}: ${response.status} ${response.statusText}. Response: ${response.data}`);
                return res.status(response.status).send(`Failed to fetch stats for ${playerId}`);
            }

            const data = response.data;

            if (data && data.heroes_ranked) {
                const heroesRanked = data.heroes_ranked;
                let matchesPlayed = 0;
                const otpList = [];

                for (const heroId in heroesRanked) {
                    if (heroesRanked.hasOwnProperty(heroId)) {
                        const heroStats = heroesRanked[heroId];
                        matchesPlayed += heroStats.matches;
                    }
                }

                for (const heroId in heroesRanked) {
                    if (heroesRanked.hasOwnProperty(heroId)) {
                        const heroStats = heroesRanked[heroId];
                        const roundedRate = matchesPlayed > 0 ? Math.floor((heroStats.matches / matchesPlayed) * 100) : 0;
                        const heroName = getHeroNames([parseInt(heroId)])[0]; // Get hero name
                        otpList.push({
                            playerName: data.player.info.name,
                            hero: heroName, // Use hero name
                            rate: roundedRate,
                            rank: Math.floor(data.player.info.rank_game_1001001.rank_game.rank_score),
                        });
                    }
                }

                allResults.push(...otpList);
            }
        }

        allResults.sort((a, b) => b.rate - a.rate);
        res.json(allResults);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

module.exports = router;