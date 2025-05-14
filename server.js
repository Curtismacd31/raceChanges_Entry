// ✅ Full server.js with SQLite + all your existing routes

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require("axios");
const xml2js = require("xml2js");
const Database = require('better-sqlite3');
require('dotenv').config();


const app = express();
const JSON_DIR = path.join(__dirname, "json");
const db = new Database(path.join(__dirname, 'race_changes.db'));

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(__dirname));

app.use('/logos', express.static(path.join(__dirname, 'logos')));

// ✅ Ensure JSON directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    console.log("✅ JSON directory created.");
}

// ✅ Create SQLite table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY,
    track TEXT,
    date TEXT,
    raceNumber TEXT,
    saddlePad TEXT,
    horseName TEXT,
    category TEXT,
    change TEXT,
    trackCondition TEXT,
    weather TEXT,
    variant TEXT
  )
`).run();

//Entries DB Creation
db.prepare(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    track TEXT,
    date TEXT,
    raceNumber TEXT,
    saddlePad TEXT,
    horseName TEXT
  )
`).run();

// CREATE USERS DB
// ✅ Create Users table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    trackOptions TEXT NOT NULL -- JSON array stored as string
  )
`).run();

// ✅ Setup simple text-based logging
const LOG_FILE = path.join(__dirname, 'logs.txt');

function logChange(username, action) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${username} - ${action}\n`;
    fs.appendFile(LOG_FILE, entry, (err) => {
        if (err) console.error("❌ Failed to write log:", err);
    });
}


// ✅ Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'changes_entry.html'));
});

// ✅ API version of saving changes to DB instead of JSON file
app.post('/api/:filename', (req, res) => {
    const [track, datePart] = decodeURIComponent(req.params.filename).split("_");
    const date = datePart.replace("_changes", "");

    const { trackCondition, weather, variant, changes } = req.body;

    if (!track || !date || !Array.isArray(changes)) {
        return res.status(400).json({ error: "Missing or invalid data structure" });
    }

   // 🧹 First, clear old data for this track and date
    db.prepare("DELETE FROM changes WHERE track = ? AND date = ?").run(track, date);
    
    // Then insert new records
    const insert = db.prepare(`
      INSERT INTO changes (
        track, date, raceNumber, saddlePad, horseName, category, change,
        trackCondition, weather, variant
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);


    const insertMany = db.transaction((rows) => {
        for (const c of rows) {
            if (!c.raceNumber) {
                console.log("⚠️ Skipping incomplete row:", c);
                continue; // Skip invalid entries
            }
    
            insert.run(
                track,
                date,
                c.raceNumber,
                c.saddlePad || '',
                c.horseName || '',
                c.category,
                c.change,
                trackCondition || '',
                weather || '',
                variant || ''
            );
        }
    });


    try {
    // Step 1: Get existing changes BEFORE clearing them
    const previous = db.prepare(`
        SELECT raceNumber, saddlePad, category, change
        FROM changes
        WHERE track = ? AND date = ?
    `).all(track, date);

    const previousMap = new Map();
    for (const row of previous) {
        const key = `${row.raceNumber}|${row.saddlePad}|${row.category}`;
        previousMap.set(key, row.change);
    }

    // Step 2: Delete and insert fresh (overwrite)
    db.prepare("DELETE FROM changes WHERE track = ? AND date = ?").run(track, date);
    insertMany(changes);

    // Step 3: Compare with what was there before
    const newChanges = changes.filter(c => {
      const key = `${c.raceNumber}|${c.saddlePad}|${c.category}`;
      const isUpdated = previousMap.get(key) !== c.change;
      const isNoChanges = (c.change || "").trim().toUpperCase() === "NO CHANGES";
      return isUpdated && !isNoChanges;
    });


    // Step 4: Log only real new/changed ones
    const username = req.body.username || 'Unknown User';

    if (newChanges.length > 0) {
        const changeDetails = newChanges.map(c => {
            const race = (c.raceNumber || '?').replace(/^Race\s*/i, '');
            const pad = c.saddlePad || '?';
            const horse = c.horseName || '?';
            const category = c.category || '?';
            const change = c.change || '?';
            return `Race ${race}, #${pad} (${horse}) - ${category.toUpperCase()}: ${change}`;
        }).join('\n    ');
        logChange(username, `NEW changes for ${track} on ${date}:\n    ${changeDetails}`);
    }

    res.json({ success: true, message: "Saved to database." });

} catch (e) {
    console.error("❌ DB Error:", e);
    res.status(500).json({ error: "Failed to save to DB" });
}


});


// ✅ Existing route: Save JSON Files
app.post('/save', (req, res) => {
    const { fileName, data, trackCondition, weather, variant } = req.body;
    if (!fileName || !data) return res.status(400).json({ error: "Missing fileName or data" });

    const filePath = path.join(JSON_DIR, fileName);
    const sortedChanges = Array.isArray(data)
        ? data.sort((a, b) => {
            const raceA = parseInt(a.raceNumber?.replace(/\D/g, "") || 0, 10);
            const raceB = parseInt(b.raceNumber?.replace(/\D/g, "") || 0, 10);
            if (raceA !== raceB) return raceA - raceB;
            const padA = parseInt(a.saddlePad || 0, 10);
            const padB = parseInt(b.saddlePad || 0, 10);
            return padA - padB;
        }) : data;

    const finalData = fileName.endsWith("_changes.json")
        ? { trackCondition: trackCondition || "", weather: weather || "", variant: variant || "", changes: sortedChanges }
        : data;

    try {
        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
        res.json({ success: true, message: "File saved: " + fileName });
    } catch (e) {
        console.error("❌ File save failed:", e);
        res.status(500).json({ error: "Failed to save file" });
    }
});

// ✅ Serve JSON files
app.get("/json/:fileName", (req, res) => {
    const filePath = path.join(JSON_DIR, req.params.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found." });

    try {
        const data = fs.readFileSync(filePath, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ File read error:", err);
        res.status(500).json({ error: "Error reading file" });
    }
});

// ✅ Serve JSON data
app.get('/get-api/:track/:date', (req, res) => {
  const track = decodeURIComponent(req.params.track);
  const date = decodeURIComponent(req.params.date);

  try {
    // Fetch all rows for this track/date
    const rows = db.prepare(`
      SELECT raceNumber, saddlePad, horseName, category, change,
             trackCondition, weather, variant
      FROM changes
      WHERE track = ? AND date = ?
      ORDER BY
        CAST(SUBSTR(raceNumber, INSTR(raceNumber, ' ') + 1) AS INTEGER),
        CAST(saddlePad AS INTEGER)
    `).all(track, date);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No changes found for this track and date." });
    }

    // Extract common fields (assumes same per group)
    const { trackCondition, weather, variant } = rows[0];

    const changes = rows.map(row => ({
      raceNumber: row.raceNumber,
      saddlePad: row.saddlePad,
      horseName: row.horseName,
      category: row.category,
      change: row.change
    }));

    res.json({
      trackCondition: trackCondition || "",
      weather: weather || "",
      variant: variant || "",
      changes
    });

  } catch (e) {
    console.error("❌ Error fetching from DB:", e);
    res.status(500).json({ error: "Failed to fetch changes from DB." });
  }
});


// ✅ Save entries
app.post("/save-entries", (req, res) => {
    const { trackName, raceDate, horseEntries } = req.body;
    if (!trackName || !raceDate || !horseEntries) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const insert = db.prepare(`
      INSERT INTO entries (track, date, raceNumber, saddlePad, horseName)
      VALUES (?, ?, ?, ?, ?)
    `);

    const deleteOld = db.prepare(`DELETE FROM entries WHERE track = ? AND date = ?`);
    const insertMany = db.transaction((entries) => {
        deleteOld.run(trackName, raceDate);
        for (const raceNumber in entries) {
            for (const horse of entries[raceNumber]) {
                insert.run(trackName, raceDate, raceNumber, horse.saddlePad, horse.horseName);
            }
        }
    });

    try {
        insertMany(horseEntries);
        res.json({ success: true, message: "Entries saved to DB." });
    } catch (e) {
        console.error("❌ Error saving entries to DB:", e);
        res.status(500).json({ error: "Failed to save entries to DB." });
    }
});



// ✅ Get Entries
app.get("/get-entries", (req, res) => {
    const { trackName, raceDate } = req.query;
    if (!trackName || !raceDate) return res.status(400).json({ error: "Missing fields" });

    try {
        const rows = db.prepare(`
            SELECT raceNumber, saddlePad, horseName FROM entries
            WHERE track = ? AND date = ?
            ORDER BY raceNumber, CAST(saddlePad AS INTEGER)
        `).all(trackName, raceDate);

        const horseEntries = {};
        rows.forEach(row => {
            if (!horseEntries[row.raceNumber]) {
                horseEntries[row.raceNumber] = [];
            }
            horseEntries[row.raceNumber].push({
                saddlePad: row.saddlePad,
                horseName: row.horseName
            });
        });

        res.json({ horseEntries });
    } catch (e) {
        console.error("❌ Error reading entries from DB:", e);
        res.status(500).json({ error: "Failed to load entries from DB." });
    }
});


// ✅ Login Validator
const bcrypt = require("bcrypt");

app.post("/validate-login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: "Missing credentials" });

  try {
    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!row) return res.status(401).json({ success: false, message: "Invalid username or password" });

    bcrypt.compare(password, row.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ success: false, message: "Invalid username or password" });
      }

      const trackOptions = JSON.parse(row.trackOptions);
      return res.json({ success: true, trackOptions });
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});


// ✅ Weather Fetcher
app.get("/get-weather", async (req, res) => {
    const { track } = req.query;
    try {
        const map = JSON.parse(fs.readFileSync(path.join(JSON_DIR, "weather.json"), "utf8"));
        const url = map[track];
        if (!url) return res.status(404).json({ error: "No weather URL for track." });

        const response = await axios.get(url);
        xml2js.parseString(response.data, (err, result) => {
            if (err) return res.status(500).json({ error: "Failed to parse weather XML." });

            const entries = result.feed.entry || [];
            if (entries.length < 2 || !entries[1].title?.[0]) {
                return res.status(404).json({ error: "No current conditions." });
            }

            res.json({ weather: entries[1].title[0] });
        });
    } catch (e) {
        console.error("❌ Weather error:", e);
        res.status(500).json({ error: "Failed to fetch weather." });
    }
});

// ✅ Track locking
app.post("/lock-track", (req, res) => {
    const { trackName, raceDate, user } = req.body;
    if (!trackName || !raceDate || !user) return res.status(400).json({ error: "Missing fields." });

    const lockFile = path.join(JSON_DIR, "locks.json");
    let locks = {};

    if (fs.existsSync(lockFile)) {
        locks = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    }

    const key = `${trackName}_${raceDate}`;

    if (locks[key] && locks[key].user !== user) {
        return res.status(403).json({ success: false, message: `Track is locked by ${locks[key].user}` });
    }

    locks[key] = {
        user,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
    res.json({ success: true, message: "Track locked." });
});

// ✅ Server Health
app.get("/status", (req, res) => {
    res.json({ success: true, message: "Server is running." });
});


// ✅ ADD ADMIN PANEL
// Serve admin UI page
app.get('/admin_users.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_users.html'));
});

// Get list of users
app.get('/admin/users', (req, res) => {
    try {
        const users = db.prepare("SELECT id, username, role, trackOptions FROM users").all();
        users.forEach(u => {
            u.trackOptions = u.trackOptions ? JSON.parse(u.trackOptions) : [];
        });
        res.json(users);
    } catch (e) {
        console.error("❌ Failed to load users:", e);
        res.status(500).json({ error: "Failed to load users." });
    }
});



// Add user
app.post('/admin/users', async (req, res) => {
    const { username, password, role, trackOptions } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const insert = db.prepare(`
            INSERT INTO users (username, password, role, trackOptions)
            VALUES (?, ?, ?, ?)
        `);
        insert.run(username, hashedPassword, role, JSON.stringify(trackOptions || []));
        res.json({ success: true });
    } catch (e) {
        console.error("❌ Failed to create user:", e);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// Delete user
app.delete('/admin/users/:username', (req, res) => {
  const { username } = req.params;
  try {
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete user." });
  }
});

//SETUP FTP USE
const ftp = require("basic-ftp");

app.get("/ftp-list", async (req, res) => {
  const client = new ftp.Client(10000);
  client.ftp.verbose = true;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false
    });

    // Optionally change directory if needed:
    // await client.cd("CTA2$DISK:[PRIPRD.LGI.PBA470FT]");

    const list = await client.list();
    console.log("📄 Raw directory list:", list.map(f => f.name));

    const zipFiles = list
      .filter(file => file.name && file.name.toLowerCase().endsWith(".zip;1"))
      .map(file => file.name.replace(/;1$/, "")); // Strip ;1

    res.json(zipFiles);
  } catch (err) {
    console.error("❌ FTP error:", err);
    res.status(500).json({ error: "Failed to connect to FTP" });
  } finally {
    client.close();
  }
});




/////SETUP ROUTES
const unzipper = require("unzipper"); // npm install unzipper
const os = require("os");

app.post("/ftp-download", async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Missing filename" });

  const client = new ftp.Client();
  const tempPath = path.join(os.tmpdir(), filename);

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false
    });

    await client.downloadTo(tempPath, filename + ";1");
    client.close();

    // ✅ Wrap unzip logic in try-catch to prevent crash
    try {
      const stream = fs.createReadStream(tempPath).pipe(unzipper.ParseOne());
      let chunks = [];

      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        try {
          const content = Buffer.concat(chunks).toString("utf8");
          const json = JSON.parse(content); // may throw
          res.json(json);
        } catch (parseErr) {
          console.error("❌ JSON parse error:", parseErr);
          res.status(400).json({ error: "Extracted file is not valid JSON." });
        }
      });

      stream.on("error", err => {
        console.error("❌ Unzip error:", err);
        res.status(500).json({ error: "Failed to extract file." });
      });
    } catch (unzipErr) {
      console.error("❌ Unzip exception:", unzipErr);
      res.status(500).json({ error: "Error during unzip operation." });
    }

  } catch (err) {
    console.error("❌ FTP download error:", err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

/////////////////////////////////////////////////////////////////////////////////
//DISPLAY SECTION
////////////////////////////////////////////////////////////////////////////////
app.get('/get-api/display/:track/:date', async (req, res) => {
  const track = decodeURIComponent(req.params.track);
  const date = decodeURIComponent(req.params.date);

  try {
    const rows = db.prepare(`
      SELECT raceNumber, saddlePad, horseName, category, change,
             trackCondition, weather, variant
      FROM changes
      WHERE track = ? AND date = ?
      ORDER BY
        CAST(SUBSTR(raceNumber, INSTR(raceNumber, ' ') + 1) AS INTEGER),
        CAST(saddlePad AS INTEGER)
    `).all(track, date);

    if (!rows.length) {
      return res.status(404).send(`<h2>No changes found for ${track} on ${date}.</h2>`);
    }

    const { trackCondition, weather, variant } = rows[0];

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.raceNumber]) grouped[row.raceNumber] = [];
      grouped[row.raceNumber].push(row);
    }

    let logoPath = '';
    try {
      const logoMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'json', 'logos.json'), 'utf8'));
      logoPath = logoMap[track] ? '/' + logoMap[track] : '';
    } catch (e) {
      console.warn("⚠️ Could not load logos.json or logo not found.");
    }

    const getColor = (num) => {
      const map = {
        1: '#FF0000',    // Red
        2: '#0000FF',    // Blue
        3: '#FFFFFF',    // White (black text)
        4: '#008000',    // Green
        5: '#000000',    // Black
        6: '#FFFF00',    // Yellow (black text)
        7: '#FF69B4',    // Pink
        8: '#808080',    // Grey (black text)
        9: '#800080',    // Purple
        10: 'linear-gradient(to right, red 50%, blue 50%)'
      };
      return map[num] || '';
    };

    const getFontColor = (num) => {
      return [3, 6, 8].includes(num) ? '#000' : '#fff';
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Race Changes - ${track} - ${date}</title>
  <meta http-equiv="refresh" content="10">
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f4f4f4;
      padding: 30px;
      margin: 0;
      color: #333;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #222;
      color: white;
      padding: 20px 30px;
    }
    header img {
      height: 100px;
    }
    h1 {
      margin: 0;
    }
    .meta {
      margin: 10px 0 30px 0;
      font-size: 14px;
      color: #ccc;
    }
    .race-section {
      margin-bottom: 40px;
    }
    .race-section h2 {
      font-size: 20px;
      margin-bottom: 15px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .change-line {
      display: flex;
      align-items: center;
      margin: 8px 0;
    }
    .pad {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .text {
      flex: 1;
    }
    .horse {
      font-weight: bold;
      margin-right: 5px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Race Changes - ${track}</h1>
      <div class="meta">
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Track Condition:</strong> ${trackCondition}</div>
        <div><strong>Weather:</strong> ${weather}</div>
        <div><strong>Variant:</strong> ${variant}</div>
      </div>
    </div>
    ${logoPath ? `<img src="${logoPath}" alt="Logo">` : ''}
  </header>

  ${Object.entries(grouped).map(([race, entries]) => {
    const isNoChanges = entries.length === 1 && entries[0].change?.toUpperCase() === "NO CHANGES";
    return `
      <div class="race-section">
        <h2>${race}${isNoChanges ? ' - <strong>NO CHANGES</strong>' : ''}</h2>
        ${!isNoChanges ? entries.map(e => {
         const isAE1 = e.saddlePad === "AE1";
         const padNum = isAE1 ? null : parseInt(e.saddlePad);
         const padColor = isAE1 ? "#FFFFFF" : getColor(padNum);
         const fontColor = isAE1 ? "#000000" : getFontColor(padNum);
         const hasPad = !!e.saddlePad;


          return `
            <div class="change-line">
              ${hasPad ? `
                <div class="pad" style="${padNum === 10 ? `background: ${padColor};` : `background-color: ${padColor}; color: ${fontColor};`}">${e.saddlePad}</div>
              ` : `<div class="pad"></div>`}
              <div class="text">
                ${e.horseName ? `<span class="horse">${e.horseName}</span>` : ""}
                ${e.category ? `${e.category.toUpperCase()}:` : ""} ${e.change || ""}
              </div>
            </div>
          `;
        }).join("") : ""}
      </div>
    `;
  }).join("")}
</body>
</html>
`;

    res.send(html);
  } catch (e) {
    console.error("❌ Display route error:", e);
    res.status(500).send(`<h2>Internal Server Error</h2>`);
  }
});


// ✅ Logs viewer
app.get('/logs', (req, res) => {
    if (!fs.existsSync(LOG_FILE)) {
        return res.send("No logs found.");
    }
    fs.readFile(LOG_FILE, 'utf-8', (err, data) => {
        if (err) {
            res.status(500).send("Unable to read logs.");
        } else {
            res.type('text/plain').send(data);
        }
    });
});





// ✅ Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
