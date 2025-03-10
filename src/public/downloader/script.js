let downloadedVideoUrl = '';

function downloadVideo() {
    const linkInput = document.getElementById('videoLink').value;
    const videoContainer = document.getElementById('videoContainer');
    const saveButton = document.getElementById('saveButton');
    const spinner = document.getElementById('spinner');

    // Clear previously downloaded data
    URL.revokeObjectURL(downloadedVideoUrl);
    downloadedVideoUrl = '';
    videoContainer.innerHTML = '';
    saveButton.style.display = 'none';

    // Show the spinner
    spinner.style.display = 'block';

    fetch(`/download?url=${encodeURIComponent(linkInput)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();
        })
        .then(videoBlob => {
            downloadedVideoUrl = URL.createObjectURL(videoBlob);
            videoContainer.innerHTML = `<video controls src="${downloadedVideoUrl}" width="600"></video>`;
            saveButton.style.display = 'block'; // Show the save button
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            saveButton.style.display = 'none'; // Hide the save button if there's an error
        })
        .finally(() => {
            // Hide the spinner
            spinner.style.display = 'none';
        });
}

function saveVideo() {
    if (!downloadedVideoUrl) {
        console.error('No video URL available for download');
        return;
    }

    const a = document.createElement('a');
    a.href = downloadedVideoUrl;
    a.download = 'video.mp4';
    document.body.appendChild(a);

    // Trigger the download
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadedVideoUrl);
}

function pasteFromClipboard() {
    navigator.clipboard.readText()
        .then(text => {
            document.getElementById('videoLink').value = text;
        })
        .catch(err => {
            console.error('Failed to read clipboard contents: ', err);
        });
}

document.getElementById('submitButton').addEventListener('click', downloadVideo);
document.getElementById('saveButton').addEventListener('click', saveVideo);
document.getElementById('pasteButton').addEventListener('click', pasteFromClipboard);

// Initially hide the save button
document.getElementById('saveButton').style.display = 'none';