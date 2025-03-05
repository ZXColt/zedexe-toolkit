let playerArray = [];

function parseText() {
    const text = document.getElementById('textInput').value;
    const lines = text.split('\n');
    playerArray.push(...lines);
    console.log(playerArray);
    displayOutput(); // Call displayOutput to update the display
}

async function displayOutput() {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = ''; // Clear previous output

    // Create and add the loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    outputDiv.appendChild(spinner);

    try {
        const response = await fetch('/getStats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerNames: playerArray })
        });

        const data = await response.json();

        // Remove the spinner
        outputDiv.removeChild(spinner);

        const table = document.createElement('table');
        table.style.width = '100%'; // Make the table fill the whole container
        table.style.borderCollapse = 'collapse'; // Optional: to remove space between cells

        const headerRow = document.createElement('tr');
        const headers = ['Player Name', 'Hero', 'Rate', 'Rank'];

        headers.forEach(headerText => {
            const header = document.createElement('th');
            header.textContent = headerText;
            header.style.border = '1px solid black'; // Optional: add border to header cells
            headerRow.appendChild(header);
        });

        table.appendChild(headerRow);

        data.forEach(item => {
            const row = document.createElement('tr');

            Object.values(item).forEach(text => {
                const cell = document.createElement('td');
                cell.textContent = text;
                cell.style.border = '1px solid black'; // Optional: add border to data cells
                row.appendChild(cell);
            });

            table.appendChild(row);
        });

        outputDiv.appendChild(table);
    } catch (error) {
        console.error('Error fetching stats:', error);
        outputDiv.textContent = 'Error fetching stats';
    }
    playerArray = []; // Clear the playerArray after displaying the stats
}