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

    const filePath = path.join(__dirname, fileName);
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

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
