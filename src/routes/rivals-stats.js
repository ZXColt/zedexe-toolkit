const express = require('express');

const router = express.Router();

const heroes = [
    { hero_id: 1046, name: "Adam Warlock" },
    { hero_id: 1026, name: "Black Panther" },
    { hero_id: 1018, name: "Doctor Strange" },
    { hero_id: 1027, name: "Groot" },
    { hero_id: 1024, name: "Hela" },
    { hero_id: 1011, name: "Hulk" },
    { hero_id: 1034, name: "Iron Man" },
    { hero_id: 1047, name: "Jeff The Land Shark" },
    { hero_id: 1016, name: "Loki" },
    { hero_id: 1031, name: "Luna Snow" },
    { hero_id: 1029, name: "Magik" },
    { hero_id: 1037, name: "Magneto" },
    { hero_id: 1020, name: "Mantis" },
    { hero_id: 1045, name: "Namor" },
    { hero_id: 1042, name: "Peni Parker" },
    { hero_id: 1014, name: "The Punisher" },
    { hero_id: 1023, name: "Rocket Raccoon" },
    { hero_id: 1038, name: "Scarlet Witch" },
    { hero_id: 1043, name: "Star Lord" },
    { hero_id: 1015, name: "Storm" },
    { hero_id: 1039, name: "Thor" },
    { hero_id: 1035, name: "Venom" },
    { hero_id: 1036, name: "Spider Man" },
    { hero_id: 1049, name: "Wolverine" },
    { hero_id: 1025, name: "Cloak & Dagger" },
    { hero_id: 1052, name: "Iron Fist" },
    { hero_id: 1021, name: "Hawkeye" },
    { hero_id: 1030, name: "Moon Knight" },
    { hero_id: 1048, name: "Psylocke" },
    { hero_id: 1032, name: "Squirrel Girl" },
    { hero_id: 1041, name: "Winter Soldier" },
    { hero_id: 1033, name: "Black Widow" },
    { hero_id: 1022, name: "Captain America" },
    { hero_id: 1040, name: "Mister Fantastic" },
    { hero_id: 1050, name: "Invisible Woman" },
    { hero_id: 1017, name: "Human Torch" },
    { hero_id: 1051, name: "The Thing" },
];

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
            const requestBody = JSON.stringify({ name: playerName });
            console.log(`Requesting player ID for ${playerName} with body: ${requestBody}`);

            const findPlayerResponse = await fetch(findPlayerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestBody
            });

            if (!findPlayerResponse.ok) {
                console.error(`Failed to find player ID for ${playerName}: ${findPlayerResponse.status} ${findPlayerResponse.statusText}`);
                return res.status(findPlayerResponse.status).send(`Failed to find player ID for ${playerName}`);
            }

            const findPlayerData = await findPlayerResponse.json();
            const playerId = findPlayerData[0].aid;

            if (!playerId) {
                console.error(`Player ID not found for ${playerName}`);
                return res.status(404).send(`Player ID not found for ${playerName}`);
            }

            const url = `https://rivalsmeta.com/api/player/${playerId}?season=3`;

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to fetch stats for ${playerId}: ${response.status} ${response.statusText}`);
                return res.status(response.status).send(`Failed to fetch stats for ${playerId}`);
            }

            const data = await response.json();

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