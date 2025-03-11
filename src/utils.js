const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

const downloadsDir = path.join(__dirname, 'downloads');

const createDownloadDirectory = async () => {
    const randomDirName = Math.random().toString(36).substring(2, 10);
    const downloadPath = path.join(downloadsDir, randomDirName);
    await fs.mkdir(downloadPath, { recursive: true });
    return downloadPath;
};

const downloadVideo = async (url, downloadPath) => {

    const trimmedUrl = url.split('?')[0];
    console.log('Downloading video:', trimmedUrl);
    const baseUrl = new URL(trimmedUrl).origin;
    let optionalArgs = '';
    if (baseUrl.includes('x.com')) {
        optionalArgs = '--extractor-arg "twitter:api=legacy"';
    }
    if (baseUrl.includes('instagram.com')) {
        optionalArgs = '';
    }

    const randomFileName = 'zedex-rip';
    const ytDlpCommand = `yt-dlp ${optionalArgs} -f 'best[ext=mp4]' -o '${path.join(
        downloadPath,
        `${randomFileName}.%(ext)s`
    )}' "${trimmedUrl}"`;

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
    const ffmpegCommand = `ffmpeg -i "${filePath}" -map_metadata -1 -metadata creation_time="${currentTime.toISOString()}" -codec copy "${tempFilePath}" && mv "${tempFilePath}" "${filePath}"`;
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

const updateDownloadData = async (url, fileSize) => {
    const downloadDataFilePath = path.join(__dirname, 'downloads', 'download_data.json');
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

    const baseUrl = new URL(url).origin;

    if (!downloadData[baseUrl]) {
        downloadData[baseUrl] = {
            totalSize: 0,
            downloadCount: 0,
        };
    }

    downloadData[baseUrl].totalSize += fileSize / (1024 * 1024); // Convert bytes to megabytes
    downloadData[baseUrl].downloadCount += 1;

    await fs.writeFile(downloadDataFilePath, JSON.stringify(downloadData, null, 2));
};

module.exports = {
    createDownloadDirectory,
    downloadVideo,
    updateMetadata,
    updateDownloadData,
};