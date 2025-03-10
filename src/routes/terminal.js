const express = require('express');
const axios = require('axios');

const router = express.Router();

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
});

router.get('/terminal/getMarketData', async (req, res) => {
    try {
        const marketData = await axiosInstance.get('https://api.nasdaq.com/api/market-info');
        console.log(marketData);
        res.json(marketData.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

router.get('/terminal/getStockData', async (req, res) => {
    try {
        // Use the Axios instance with common headers

        //https://api.nasdaq.com/api/quote/AMD/info?assetclass=stocks
        //https://api.nasdaq.com/api/quote/SPY/info?assetclass=etf
        //https://api.nasdaq.com/api/quote/SPX/info?assetclass=index

        const stockData = await axiosInstance.get('https://api.nasdaq.com/api/quote/AMD/info?assetclass=stocks');
        console.log(stockData);
        res.json(stockData.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

module.exports = router;