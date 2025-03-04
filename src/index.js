const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const mime = require('mime-types');

const app = express();
app.use(cors());

const downloadsDir = path.join(__dirname, 'downloads');
const downloadDataFilePath = path.join(__dirname, 'download_data.json');

app.get('/download', async (req, res) => {
	const url = req.query.url;

	if (!url) {
		return res.status(400).send('URL is missing');
	}

	try {
		const downloadPath = await createDownloadDirectory();
		//const cleanedUrl = await cleanUrl(url);
		const filename = await downloadVideo(url, downloadPath);
		const filePath = path.join(downloadPath, filename);

		await updateMetadata(filePath);
		//await addWatermark(filePath);

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

const createDownloadDirectory = async () => {
	const randomDirName = Math.random().toString(36).substring(2, 10);
	const downloadPath = path.join(downloadsDir, randomDirName);
	await fs.mkdir(downloadPath, { recursive: true });
	return downloadPath;
};

const downloadVideo = async (url, downloadPath) => {
	console.log('Downloading video:', url);
	const randomFileName = 'zedex-rip';
	const ytDlpCommand = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o '${path.join(
		downloadPath,
		`${randomFileName}.mp4`
	)}' --no-mtime "${url}"`;

	const ytDlpProcess = spawn('/usr/bin/env', ['bash', '-c', ytDlpCommand], {
		stdout: 'pipe',
		stderr: 'pipe',
	});

	let stderrOutput = '';
	ytDlpProcess.stderr.on('data', (data) => {
		stderrOutput += data.toString();
		console.error(`yt-dlp stderr: ${data.toString()}`);
	});

	return new Promise((resolve, reject) => {
		ytDlpProcess.on('exit', async (code) => {
			if (code !== 0) {
				return reject(new Error(`yt-dlp exited with code ${code}.\nStderr:\n${stderrOutput}`));
			}

			try {
				const files = await fs.readdir(downloadPath);
				if (!files || files.length === 0) {
					return reject(new Error('No files downloaded'));
				}
				console.log('Finished downloading video');
				resolve(files[0]);
			} catch (err) {
				reject(err);
			}
		});
	});
};

const updateMetadata = async (filePath) => {
	console.log('Updating metadata for video:', filePath);
	const currentTime = new Date();
	const tempFilePath = `${filePath}.temp.mp4`;
	const ffmpegCommand = `ffmpeg -i "${filePath}" -metadata creation_time="${currentTime.toISOString()}" -codec copy "${tempFilePath}" && mv "${tempFilePath}" "${filePath}"`;
	const ffmpegProcess = spawn('/usr/bin/env', ['bash', '-c', ffmpegCommand]);

	let ffmpegStderrOutput = '';
	ffmpegProcess.stderr.on('data', (data) => {
		ffmpegStderrOutput += data.toString();
	});

	return new Promise((resolve, reject) => {
		ffmpegProcess.on('error', (error) => {
			console.error('ffmpeg error:', error);
			reject(new Error('Error updating metadata'));
		});

		ffmpegProcess.on('exit', (ffmpegCode) => {
			if (ffmpegCode !== 0) {
				console.error(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`);
				reject(new Error(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`));
			} else {
				console.log('Finished updating metadata');
				resolve();
			}
		});
	});
};

const addWatermark = async (filePath) => {
	console.log('Adding watermark to video:', filePath);
	const tempFilePath = `${filePath}.temp.mp4`;
	const watermarkPath = path.join(__dirname, 'watermark.png');
	const ffmpegCommand = `ffmpeg -i "${filePath}" -i "${watermarkPath}" -filter_complex "[1]scale=iw/12:ih/12[wm];[0][wm]overlay=5:5" -codec:a copy "${tempFilePath}" && mv "${tempFilePath}" "${filePath}"`;
	const ffmpegProcess = spawn('/usr/bin/env', ['bash', '-c', ffmpegCommand]);

	let ffmpegStderrOutput = '';
	ffmpegProcess.stderr.on('data', (data) => {
		ffmpegStderrOutput += data.toString();
	});

	return new Promise((resolve, reject) => {
		ffmpegProcess.on('error', (error) => {
			console.error('ffmpeg error:', error);
			reject(new Error('Error updating metadata'));
		});

		ffmpegProcess.on('exit', (ffmpegCode) => {
			if (ffmpegCode !== 0) {
				console.error(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`);
				reject(new Error(`ffmpeg exited with code ${ffmpegCode}.\nStderr:\n${ffmpegStderrOutput}`));
			} else {
				console.log('Finished adding watermark');
				resolve();
			}
		});
	});
}

const updateDownloadData = async (req, fileSize) => {
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
			const response = await fetch(`https://ipwhois.app/json/8.8.8.8`);
			const locationData = await response.json();
			const location = `${locationData.city}, ${locationData.region}, ${locationData.country}`;
			downloadData[ip].location = location;
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
};

const cleanedUrl = async (url) => {
	//https://www.tiktok.com/@leedm9/video/7451719137040026886?is_from_webapp=1&sender_device=pc
	return url;
}

app.use(express.static(path.join(__dirname, 'web-frontend')));

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
