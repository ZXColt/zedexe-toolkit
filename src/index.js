const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const crypto = require('crypto');
const mime = require('mime-types');

const app = express();
const downloadsDir = path.join(__dirname, 'downloads');
const downloadDataFilePath = path.join(__dirname, 'download_data.json');

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

				const currentTime = new Date();
				const tempFilePath = `${filePath}.temp.mp4`;
				const ffmpegCommand = `ffmpeg -i "${filePath}" -metadata creation_time="${currentTime.toISOString()}" -codec copy "${tempFilePath}" && mv "${tempFilePath}" "${filePath}"`;
				const ffmpegProcess = spawn('/usr/bin/env', ['bash', '-c', ffmpegCommand]);

				let ffmpegStderrOutput = '';
				ffmpegProcess.stderr.on('data', (data) => {
					ffmpegStderrOutput += data.toString();
				});

				ffmpegProcess.on('error', (error) => {
					console.error('ffmpeg error:', error);
					return res.status(500).send('Error updating metadata');
				});

				ffmpegProcess.on('exit', async (ffmpegCode) => {
					if (ffmpegCode !== 0) {
						console.error(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`);
						return res.status(500).send(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`);
					}

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


					// Update download data JSON and log the download
					const fileSize = fileBuffer.length;
					let downloadData = {};
					try {
						const data = await fs.readFile(downloadDataFilePath, 'utf8');
						downloadData = JSON.parse(data);
					} catch (err) {
						if (err.code === 'ENOENT') {
							// File does not exist, create it
							await fs.writeFile(downloadDataFilePath, JSON.stringify({}, null, 2));
						} else {
							console.error('Error reading download data file:', err);
						}
					}

					const ip = req.ip.startsWith('::ffff:') ? req.ip.substring(7) : req.ip;
					if (!downloadData[ip]) {
						downloadData[ip] = { downloads: 0, totalDataMB: 0 };
					}
					if (!downloadData[ip].location) {
						try {
							const locationResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.GEOIP_API_KEY}&ip=${ip}`);
							const locationData = await locationResponse.json();
							const location = `${locationData.city}, ${locationData.state_prov}, ${locationData.country_name}`;
							downloadData[ip].location = location
						} catch (locationError) {
							console.error('Error getting location:', locationError);
						}
					}
					downloadData[ip].downloads += 1;
					downloadData[ip].totalDataMB += fileSize / (1024 * 1024);

					const centralTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
					const logEntry = `${centralTime} -- IP:${ip} -- Size:${fileSize / (1024 * 1024)}MB -- Location: ${downloadData[ip].location}\n`;
					console.log(logEntry);

					await fs.writeFile(downloadDataFilePath, JSON.stringify(downloadData, null, 2));

					await fs.rm(downloadPath, { recursive: true, force: true });
				});
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
