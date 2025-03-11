const express = require('express');
const axios = require('axios');
//const db = require('../database');

const router = express.Router();

let marketData = {};

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
});

router.get('/terminal/getMarketData', async (req, res) => {
    try {
        const response = await axiosInstance.get('https://api.nasdaq.com/api/market-info');
        const data = response.data.data;
        // Extract the required fields
        const { mrktStatus, mrktCountDown, nextTradeDate } = data;
        marketData = { mrktStatus, mrktCountDown, nextTradeDate };

        // Send the extracted fields in the response
        res.json(marketData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

router.get('/terminal/getTickerData', async (req, res) => {
    const ticker = req.query.ticker;

    //https://api.nasdaq.com/api/quote/AMD/info?assetclass=stocks
    //https://api.nasdaq.com/api/quote/SPY/info?assetclass=etf
    //https://api.nasdaq.com/api/quote/SPX/info?assetclass=index

    try {
        const stockData = await axiosInstance.get(`https://api.nasdaq.com/api/quote/${ticker}/info?assetclass=stocks`);
        console.log(stockData);
        res.json(stockData.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

module.exports = router;