const express = require('express');
const axios = require('axios');

const router = express.Router();

// Create an Axios instance with common headers
const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
});

router.get('/terminal/getMarketData', async (req, res) => {
    try {
        // Use the Axios instance with common headers
        const marketData = await axiosInstance.get('https://api.nasdaq.com/api/market-info');
        console.log(marketData);
        res.json(marketData.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

module.exports = router;