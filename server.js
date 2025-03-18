const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); // Serve static files

app.post('/save', (req, res) => {
    const { fileName, data } = req.body;
    if (!fileName || !data) {
        return res.status(400).send("Invalid request: Missing fileName or data");
    }

    const filePath = path.join(__dirname, "json", fileName);
    console.log(`Saving file: ${filePath}`);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Error saving file:", err);
            return res.status(500).send("Error saving file.");
        } else {
            res.send(`File saved as ${fileName}`);
        }
    });
});

app.get("/json/:fileName", (req, res) => {
    const filePath = `${TEMP_DIR}/${req.params.fileName}`;

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log(`✅ Serving file: ${filePath}`);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error reading file ${filePath}:`, error);
        res.status(500).json({ error: "Error reading file" });
    }
});







// ✅ Increase request body size limit
app.use(express.json({ limit: "10mb" })); // Increase to 10MB
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const TEMP_DIR = "./temp_entries";

// ✅ Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

app.post("/save-entries", (req, res) => {
    const { trackName, raceDate, horseEntries, raceChanges } = req.body;

    if (!trackName || !raceDate || !horseEntries) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const filePath = `${TEMP_DIR}/${trackName}_${raceDate}_entries.json`;

    // ✅ Ensure both horseEntries and raceChanges are saved
    const dataToSave = {
        horseEntries,
        raceChanges: raceChanges || []
    };

    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`✅ Entries & changes saved for ${trackName} on ${raceDate}`);
        res.json({ success: true, message: "Entries stored successfully." });
    } catch (error) {
        console.error("❌ Error saving entries:", error);
        res.status(500).json({ error: "Failed to save entries." });
    }
});



// ✅ Retrieve stored entries
app.get("/get-entries", (req, res) => {
    const { trackName, raceDate } = req.query;
    const filePath = `${TEMP_DIR}/${trackName}_${raceDate}_entries.json`;

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "No stored entries found." });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    res.json({
        horseEntries: data.horseEntries || {},
        raceChanges: data.raceChanges || []
    });
});


// ✅ Flush expired files (older than 24 hours)
function cleanUpOldEntries() {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    files.forEach(file => {
        const filePath = `${TEMP_DIR}/${file}`;
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (now - data.timestamp > 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            console.log(`Deleted expired file: ${file}`);
        }
    });
}

// ✅ Run cleanup every hour
setInterval(cleanUpOldEntries, 60 * 60 * 1000);


const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
