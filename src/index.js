const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

const app = express();
const downloadsDir = path.join(__dirname, 'downloads');
const logFilePath = path.join(__dirname, 'download.log');

app.get('/download', async (req, res) => {
	const url = req.query.url;

	if (!url) {
		return res.status(400).send('URL is missing');
	}

	try {
		const randomDirName = crypto.randomUUID();
		const downloadPath = path.join(downloadsDir, randomDirName);
		await fs.mkdir(downloadPath, { recursive: true });

		const randomFileName = crypto.randomUUID();
		const ytDlpCommand = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o '${path.join(
			downloadPath,
			`${randomFileName}.mp4`
		)}' --no-mtime "${url}"`;

		const ytDlpProcess = spawn('/usr/bin/env', ['bash', '-c', ytDlpCommand], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		ytDlpProcess.on('error', (error) => {
			console.error('yt-dlp error:', error);
			return res.status(500).send('Error executing yt-dlp');
		});

		let stderrOutput = '';
		ytDlpProcess.stderr.on('data', (data) => {
			stderrOutput += data.toString();
			console.error(`yt-dlp stderr: ${data.toString()}`);
		});

		ytDlpProcess.on('exit', async (code) => {
			if (code !== 0) {
				return res
					.status(500)
					.send(`yt-dlp exited with code ${code}.\nStderr:\n${stderrOutput}`);
			}

			try {
				const files = await fs.readdir(downloadPath);
				if (!files || files.length === 0) {
					return res.status(500).send('No files downloaded');
				}

				const filename = files[0];
				const filePath = path.join(downloadPath, filename);

				// Set the modification and access times to the current time
				const currentTime = new Date();
				await fs.utimes(filePath, currentTime, currentTime);

				const fileBuffer = await fs.readFile(filePath);
				const mimeType = mime.lookup(filename);

				if (!mimeType) {
					console.error('Could not determine MIME type for file:', filename);
					return res.status(500).send('Could not determine file type');
				}

				const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
				const encodedFilename = encodeURIComponent(safeFilename);

				res.setHeader(
					'Content-Disposition',
					`attachment; filename="${encodedFilename}"`
				);
				res.setHeader('Content-Type', mimeType);
				res.send(fileBuffer);

				// Log the download details
				const fileSize = fileBuffer.length;
				const logEntry = `${new Date().toISOString()} - IP: ${req.ip} - File: ${safeFilename} - Size: ${fileSize} bytes\n`;
				console.log(logEntry);
				await fs.appendFile(logFilePath, logEntry);

				await fs.rm(downloadPath, { recursive: true, force: true });
			} catch (fileError) {
				console.error('Error processing downloaded file:', fileError);
				res.status(500).send('Error processing downloaded file');
			}
		});
	} catch (error) {
		console.error('General error:', error);
		res.status(500).send('An error occurred');
	}
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
