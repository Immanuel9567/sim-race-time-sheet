document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const form = document.getElementById('timeForm');
    const leaderboard = document.getElementById('leaderboard');

    let records = JSON.parse(localStorage.getItem('records')) || [];
    let isAdmin = false; // default

    function parseTime(timeStr) {
        const [minSec, ms] = timeStr.split('.');
        const [minutes, seconds] = minSec.split(':').map(Number);
        return minutes * 60 + seconds + (ms ? parseFloat('0.' + ms) : 0);
    }

    function updateLeaderboard() {
        leaderboard.innerHTML = '';
        if(records.length === 0) return;

        records.sort((a, b) => parseTime(a.time) - parseTime(b.time));
        const fastestTime = parseTime(records[0].time);

        records.forEach((record, index) => {
            const row = document.createElement('tr');
            if(parseTime(record.time) === fastestTime) row.classList.add('fastest');

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${record.name}</td>
                <td>${record.time}</td>
                <td>${record.team || ''}</td>
                ${isAdmin ? `<td><button class="deleteBtn" data-index="${index}">Delete</button></td>` : `<td></td>`}
            `;
            leaderboard.appendChild(row);
        });

        localStorage.setItem('records', JSON.stringify(records));

        if(isAdmin) {
            document.querySelectorAll('.deleteBtn').forEach(btn => {
                btn.addEventListener('click', e => {
                    const idx = parseInt(e.target.dataset.index);
                    records.splice(idx, 1);
                    updateLeaderboard();
                });
            });
        }
    }

    // Add new record
    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('driverName').value;
        const time = document.getElementById('lapTime').value;
        const team = document.getElementById('teamName').value;

        if(name && time) {
            records.push({ name, time, team });
            updateLeaderboard();
            form.reset();
        } else {
            alert('Please enter both name and time.');
        }
    });

    // Admin login
    loginBtn.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if(username === 'V8' && password === 'racing123') {
            isAdmin = true;
            alert('Logged in as Admin.');
        } else {
            isAdmin = false;
            alert('Logged in as Team Member.');
        }

        updateLeaderboard(); // show/hide delete buttons
    });

    updateLeaderboard(); // initial render
});
