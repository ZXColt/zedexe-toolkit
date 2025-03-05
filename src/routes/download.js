const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const mime = require('mime-types');
const { createDownloadDirectory, downloadVideo, updateMetadata, updateDownloadData } = require('../utils');

const router = express.Router();

router.get('/download', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('URL is missing');
    }

    try {
        const downloadPath = await createDownloadDirectory();
        const filename = await downloadVideo(url, downloadPath);
        const filePath = path.join(downloadPath, filename);

        await updateMetadata(filePath);

        const fileBuffer = await fs.readFile(filePath);
        const mimeType = mime.lookup(filename);

        if (!mimeType) {
            console.error('Could not determine MIME type for file:', filename);
            return res.status(500).send('Could not determine file type');
        }

        const encodedFilename = encodeURIComponent(filename);

        console.log('Sending file:', encodedFilename);
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"`);
        res.setHeader('Content-Type', mimeType);
        res.send(fileBuffer);

        await updateDownloadData(req, fileBuffer.length);
        console.log('Cleaning up download:', downloadPath);
        await fs.rm(downloadPath, { recursive: true, force: true });
    } catch (error) {
        console.error('General error:', error);
        res.status(500).send('An error occurred');
    }
});

module.exports = router;