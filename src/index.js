const path = require('path');
const express = require('express');
const cors = require('cors');
const { createDownloadDirectory, downloadVideo, updateMetadata, updateDownloadData } = require('./utils');

const app = express();
app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
const downloadDataFilePath = path.join(__dirname, 'download_data.json');

app.use(express.static(path.join(__dirname, 'public')));

// Define routes for /eoa and /downloader
app.get('/eoa', (req, res) => {
	res.sendFile(path.join(__dirname, 'public/eoa', 'index.html'));
});

app.get('/downloader', (req, res) => {
	res.sendFile(path.join(__dirname, 'public/downloader', 'index.html'));
});

// Use the routes
const downloadRoute = require('./routes/download');
const getStatsRoute = require('./routes/rivals-stats');

app.use(downloadRoute);
app.use(getStatsRoute);

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});