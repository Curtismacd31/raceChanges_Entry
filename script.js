		let currentEquipmentField = null; // Store reference to Change Text field
		let selectedEquipmentChanges = []; // Array to hold selected changes
		let currentChangeTextField = null;  // Store reference to change text field
	
		/////////////////////////////////////////////////////////////////////////////////////////////////////////
		// VALIDATE LOGIN
		document.addEventListener("DOMContentLoaded", function () {
			function validateLogin() {
				const password = document.getElementById("passwordInput").value;
		
				fetch("/validate-login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					const username = document.getElementById("usernameInput").value;
					const password = document.getElementById("passwordInput").value;
					
					body: JSON.stringify({ username, password })

				})
					.then(async res => {
						if (!res.ok) {
							const errorText = await res.text();
							throw new Error(`Server responded with ${res.status}: ${errorText}`);
						}
						return res.json();
					})
					.then(data => {
						if (data.success) {
							console.log("✅ Login successful");
		
							// Hide login, show tabs
							const loginPage = document.getElementById("loginPage");
							const tabs = document.getElementById("tabs");
							const raceChangesTab = document.getElementById("raceChangesTab");
		
							if (loginPage && tabs && raceChangesTab) {
								loginPage.classList.add("hidden");
								tabs.classList.remove("hidden");
								showTab("raceChangesTab"); // Show Main tab after login
							} else {
								console.warn("❗ Login or tab containers not found.");
							}
		
							// Populate track dropdown
							const trackDropdown = document.getElementById("trackName");
							if (trackDropdown) {
								trackDropdown.innerHTML = "";
								data.trackOptions.forEach(track => {
									const option = document.createElement("option");
									option.value = track;
									option.textContent = track;
									trackDropdown.appendChild(option);
								});
							}
						} else {
							alert("Invalid Judges Number.");
						}
					})
					.catch(err => {
						console.error("Login check failed. Try again.", err);
						alert("Login check failed. Try again.");
					});
			}
		
			window.validateLogin = validateLogin;
		});

		////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		//SET WEATHER FROM TRACK NAME
		function fetchWeather() {
			const track = document.getElementById("trackName").value;
			if (!track) {
				alert("Please select a track to fetch weather.");
				return;
			}
		
			fetch(`/get-weather?track=${encodeURIComponent(track)}`)
				.then(res => res.json())
				.then(data => {
					if (data.weather) {
						const titleText = data.weather;
						console.log("🌤 Raw Weather Title:", titleText);
				
						// Match pattern like: "Current Conditions: Partly Cloudy, 1.8°C"
						const match = titleText.match(/Current Conditions:\s*(.+),\s*(-?\d+\.?\d*)°C/i);
				
						if (match) {
							const condition = match[1]; // e.g. "Partly Cloudy"
							const tempC = parseFloat(match[2]); // e.g. 1.8
							const roundedC = Math.round(tempC);
							const tempF = Math.round((roundedC * 9) / 5 + 32);
							const formatted = `Current Conditions: ${condition}, ${roundedC}°C / ${tempF}°F`;
				
							document.getElementById("weather").value = formatted;
							console.log("✅ Weather updated:", formatted);
						} else {
							// Fallback if format is unexpected
							document.getElementById("weather").value = titleText;
							console.warn("⚠ Could not parse weather format. Showing raw data.");
						}
					} else {
						console.warn("⚠ Weather data not found:", data);
						alert("Weather data not available.");
					}
				})
		}

		document.getElementById("trackName").addEventListener("change", fetchWeather);
		///////////////////////////////////////////////////////////////////////////////////////////////////////////////
		//HELPER FUNCTION
		function showTab(tabId) {
			document.querySelectorAll('.tab').forEach(tab => tab.classList.add('hidden'));
			const activeTab = document.getElementById(tabId);
			if (activeTab) {
				activeTab.classList.remove('hidden');
			}
		}

		///////////////////////////////////////////////////////////////////
		//LOCK IF LOGGED IN ALREADY
		function lockTrack(trackName, raceDate, userCode) {
		    fetch("/lock-track", {
		        method: "POST",
		        headers: { "Content-Type": "application/json" },
		        body: JSON.stringify({ trackName, raceDate, user: userCode })
		    })
		    .then(res => res.json())
		    .then(data => {
		        if (!data.success) {
		            alert(data.message);
		            // Optional: disable form or reload
		            return;
		        }
		
		        console.log("✅ Track locked by user.");
		        // Continue with loading UI...
		    })
		    .catch(err => {
		        console.error("❌ Error locking track:", err);
		    });
		}


		/////////////////////////////////////////////////////////////////////////////////////////////////////////
		//CHECK FOR EXISTING FILE
		function checkForExistingData() {
			const trackName = document.getElementById("trackName").value;
			const raceDate = document.getElementById("raceDate").value;
			if (!trackName || !raceDate) return;
		
			const changesFile = `${trackName}_${raceDate}_changes.json`;
			const entriesFile = `${trackName}_${raceDate}_entries.json`;
		
			console.log("📌 Checking for existing files:", changesFile, entriesFile);
		
			// ✅ Step 1: Load Entries First
			// ✅ Step 1: Load Entries from DB
			fetch(`/get-entries?trackName=${encodeURIComponent(trackName)}&raceDate=${encodeURIComponent(raceDate)}`)
				.then(response => response.ok ? response.json() : Promise.reject("Entries file not found"))
				.then(entries => {
					console.log("📌 Received Race Entries:", entries);
					if (entries.horseEntries) {
						window.horseEntries = entries.horseEntries;
						console.log("✅ Race entries loaded into memory:", window.horseEntries);
						updateAllDropdowns();
					}
				})
				.then(() => {
				    // ✅ Step 2: Load Changes from DB instead of JSON
				    return fetch(`/get-api/${trackName}/${raceDate}`);
				})
				.then(response => response.ok ? response.json() : Promise.reject("Changes not found in DB"))
				.then(data => {
				    console.log("📌 Received Changes Data:", data);
				    if (Array.isArray(data.changes) && data.changes.length > 0) {
				        loadExistingData(data.changes);
				
				        // Restore metadata
				        document.getElementById("trackCondition").value = data.trackCondition || "";
				        document.getElementById("weather").value = data.weather || "";
				        document.getElementById("variant").value = data.variant || "";
				    } else {
				        console.warn("⚠ No valid race changes found.");
				    }
				})
				.catch(error => {
				    console.log("❌ Error loading changes from DB:", error);
				});
		}



		/////////////////////////////////////////////////////////////////////////////////////////////////////////
		//UPDATE ALL DROPDOWNS		
		function updateAllDropdowns() {
			console.log("📌 Updating all Race Number & Saddle Pad dropdowns...");
			
			document.querySelectorAll(".raceNumber").forEach(raceSelect => {
				let selectedRace = raceSelect.value;
				raceSelect.innerHTML = '<option value="">Select</option>';

				Object.keys(window.horseEntries)
				  .sort((a, b) => {
				    const numA = parseInt(a.replace(/\D/g, ""), 10);
				    const numB = parseInt(b.replace(/\D/g, ""), 10);
				    return numA - numB;
				  })
				  .forEach(raceNum => {
				    let option = document.createElement("option");
				    option.value = raceNum;
				    option.textContent = raceNum;
				    raceSelect.appendChild(option);
				  });
				
				raceSelect.value = selectedRace; // ✅ Restore previous selection
				raceSelect.dispatchEvent(new Event("change")); // ✅ Trigger update for Saddle Pads
			});

			console.log("✅ Dropdowns updated with race entries.");
		}
		
		///////////////////////////////////////////////////////////////////////////////////////////////////////////
		// CHECK ENTRIES
		document.getElementById("raceDate").addEventListener("change", function () {
		    const selectedDate = this.value;
		    const trackName = document.getElementById("trackName").value;
		
		    if (!selectedDate || !trackName) return;
		
		    console.log("📌 Checking for existing entries:", trackName, selectedDate);
		
		    fetch(`/get-entries?trackName=${trackName}&raceDate=${selectedDate}`)
		        .then(res => res.ok ? res.json() : Promise.reject("No entries file found"))
		        .then(data => {
		            console.log("📌 Received JSON Response:", data);
		
		            const isEmpty = !data.horseEntries || Object.keys(data.horseEntries).length === 0;
		
		            if (isEmpty) {
		                if (confirm("No file loaded for today. Would you like to start with a blank file?")) {
		                    const blankEntries = {};
		                    for (let i = 1; i <= 20; i++) {
		                        let raceKey = `Race ${i}`;
		                        blankEntries[raceKey] = [];
		                        for (let j = 1; j <= 20; j++) {
		                            blankEntries[raceKey].push({ saddlePad: j.toString(), horseName: "" });
		                        }
		                    }
		
		                    const body = {
		                        trackName,
		                        raceDate: selectedDate,
		                        horseEntries: blankEntries,
		                        raceChanges: []
		                    };
		
		                    fetch("/save-entries", {
		                        method: "POST",
		                        headers: { "Content-Type": "application/json" },
		                        body: JSON.stringify(body)
		                    })
		                    .then(res => res.json())
		                    .then(result => {
		                        if (result.success) {
		                            alert("Blank file created.");
		                            window.horseEntries = blankEntries;
		                            updateAllDropdowns();
		                        } else {
		                            alert("Failed to create blank file.");
		                        }
		                    });
		                }
		                return;
		            }
		
		            // ✅ If data exists, continue loading
		            if (data.horseEntries) {
		                console.log("✅ Auto-loading horse entries...");
		                window.horseEntries = data.horseEntries;
		            }
		
		            if (data.raceChanges && data.raceChanges.length > 0) {
		                console.log("✅ Found existing race changes:", data.raceChanges);
		                loadExistingRaceChanges(data.raceChanges);
		            } else {
		                console.log("❌ No race changes found.");
		            }
		
		            updateAllDropdowns(); // ⬅️ Update UI
		        })
		        .catch(error => {
		            console.log("❌ Error loading entries:", error);
		        });
		});




		//////////////////////////////////////////////////////////////////////////////////////////////////////
		//LOAD EXISTING CHANGES
		function loadExistingData(raceChanges) {
			console.log("📌 Loading existing data:", raceChanges);

			if (!Array.isArray(raceChanges) || raceChanges.length === 0) {
				console.warn("⚠ No valid race changes to load.");
				return;
			}

			const tableBody = document.getElementById("tableBody");
			tableBody.innerHTML = ""; // ✅ Clear previous table content

			raceChanges.forEach(entry => {
				if (!entry.raceNumber || !entry.saddlePad || !entry.category) {
					console.warn("⚠ Skipping invalid entry:", entry);
					return;
				}
				addRow(entry); // ✅ Load each saved change into the table
			});

			console.log("✅ All changes successfully loaded into UI.");
		}

		///////////////////////////////////////////////////////////////////////////////////////////////////////
		//SAVE DATA
		function saveData() {
			const trackName = document.getElementById('trackName').value;
			const raceDate = document.getElementById('raceDate').value;
			if (!trackName || !raceDate) {
				alert("Please select Track Name and Date.");
				return;
			}
		
			let data = [];
			const rows = document.querySelectorAll("tbody tr");
		
			// ✅ Gather entered changes
			rows.forEach(row => {
				let raceNumber = row.querySelector(".raceNumber").value;
				let saddlePad = row.querySelector(".saddlePad").value;
				let horseName = row.querySelector(".horseName").value;
				let category = row.querySelector(".changeCategory").value;
				let changeText = row.querySelector(".changeText").value;
		
				if (!raceNumber || !category) return;
		
				data.push({
					raceNumber: raceNumber.toString(),
					saddlePad: saddlePad ? saddlePad.toString() : "",
					horseName,
					category,
					change: changeText
				});
			});
		
			// ✅ Inject "NO CHANGES" entries for missing races
			const allRaces = Object.keys(window.horseEntries || {});
			const racesWithChanges = new Set(data.map(change => change.raceNumber));
		
			allRaces.forEach(raceNum => {
				if (!racesWithChanges.has(raceNum)) {
					data.push({
						raceNumber: raceNum,
						saddlePad: "",
						horseName: "",
						category: "",
						change: "NO CHANGES"
					});
				}
			});
		
			const trackCondition = document.getElementById("trackCondition").value;
			const weather = document.getElementById("weather").value;
			const variant = document.getElementById("variant").value;
		
			const apiFilename = `${trackName}_${raceDate}_changes`;
		
			fetch(`/api/${encodeURIComponent(apiFilename)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trackCondition,
					weather,
					variant,
					changes: data
				})
			})
			.then(res => res.json())
			.then(result => {
				console.log("✅ Save successful:", result);
				alert(result.message || `CHANGES SAVED FOR ${trackName} ${raceDate}`);
			})
			.catch(error => console.error('❌ Error saving to DB:', error));
		}



		////////////////////////////////////////////////////////////////////////////////////////////////////////
		//DOWNLOAD PDF
		function downloadPDF() {
			if (!window.jspdf) {
				alert("Error: jsPDF library is not loaded.");
				return;
			}

			const { jsPDF } = window.jspdf;
			const doc = new jsPDF();

			let trackName = document.getElementById('trackName').value || "Unknown Track";
			let raceDate = document.getElementById('raceDate').value || "No Date";
			let trackCondition = document.getElementById('trackCondition').value || "N/A";
			let weather = document.getElementById('weather').value || "N/A";
			let variant = document.getElementById('variant').value || "N/A";
			
			 // ✅ Get Current Time (HH:MM AM/PM format)
			let now = new Date();
			let hours = now.getHours();
			let minutes = now.getMinutes().toString().padStart(2, "0");
			let ampm = hours >= 12 ? "PM" : "AM";
			hours = hours % 12 || 12; // Convert to 12-hour format
			let creationTime = `${hours}:${minutes} ${ampm}`;

			doc.setFont("helvetica", "bold");
			doc.setFontSize(16);
			doc.text(`Race Changes - ${trackName}`, 14, 20);
			doc.setFontSize(12);
			doc.text(`Date: ${raceDate}`, 14, 30);
			doc.text(`Creation Time: ${creationTime}`, 14, 36); // ✅ Added Creation Time
			doc.text(`Track: ${trackCondition}`, 94, 36);
			doc.text(`Weather: ${weather}`, 94, 30);
			doc.text(`Variant: ${variant}`, 164, 36);

			let startY = 40; // Start position for the table
			let columnWidths = [20, 20, 35, 40, 70]; // [Race #, Saddle Pad, Horse Name, Category, Change]

			let rows = document.querySelectorAll("tbody tr");

			// Extract and Sort Data
			let data = [];

			rows.forEach((row) => {
				let raceNumber = row.querySelector(".raceNumber").value || "N/A";
				let saddlePad = row.querySelector(".saddlePad").value || "N/A";
				let horseName = row.querySelector(".horseName").value || "N/A";
				let category = row.querySelector(".changeCategory").value || "N/A";
				let change = row.querySelector(".changeText").value || "N/A";

				if (change === "N/A" && category === "N/A") return; // Skip empty changes

				saddlePad = saddlePad === "N/A" ? "" : saddlePad;
				horseName = horseName === "N/A" ? "" : horseName;
				category = category === "N/A" ? "" : category;
				change = change === "N/A" ? "" : change;

				data.push({
					raceNumber: raceNumber, //"RACE " + parseInt(raceNumber),
					saddlePad: saddlePad === "" ? -1 : parseInt(saddlePad),
					horseName,
					category,
					change
				});
			});

			// ✅ Sorting logic
			data.sort((a, b) => {
			  const raceA = parseInt(a.raceNumber.replace(/\D/g, ""), 10);
			  const raceB = parseInt(b.raceNumber.replace(/\D/g, ""), 10);
			
			  if (raceA !== raceB) return raceA - raceB;
			
			  const padA = parseInt(a.saddlePad, 10);
			  const padB = parseInt(b.saddlePad, 10);
			  return padA - padB;
			});


			// Table Headers
			doc.setFontSize(10);
			doc.setTextColor(255, 255, 255);
			doc.setFillColor(50, 50, 50);
			doc.rect(14, startY, columnWidths[0], 10, "F");
			doc.rect(34, startY, columnWidths[1], 10, "F");
			doc.rect(54, startY, columnWidths[2], 10, "F");
			doc.rect(89, startY, columnWidths[3], 10, "F");
			doc.rect(129, startY, columnWidths[4], 10, "F");

			doc.text("Race #", 18, startY + 7);
			doc.text("Saddle", 38, startY + 7);
			doc.text("Horse Name", 58, startY + 7);
			doc.text("Category", 94, startY + 7);
			doc.text("Change", 134, startY + 7);

			startY += 10;

			data.forEach((entry, index) => {
				let textWidth = columnWidths[4] - 5;
				let wrappedText = doc.splitTextToSize(entry.change, textWidth);
				let rowHeight = Math.max(10, wrappedText.length * 5); // Expands row height dynamically

				if (index % 2 === 0) {
					doc.setFillColor(240, 240, 240);
				} else {
					doc.setFillColor(255, 255, 255);
				}

				doc.rect(14, startY, columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4], rowHeight, "F");

				doc.setFontSize(8);
				doc.setTextColor(0, 0, 0);

				let centerY = startY + rowHeight / 2 + 2; // ✅ Center text vertically

				doc.text(`${entry.raceNumber}`, 18, centerY);
				doc.text(`${entry.horseName}`, 58, centerY);
				doc.text(`${entry.category}`, 94, centerY);
				doc.text(wrappedText, 134, startY + 5); // ✅ Proper alignment for multi-line text

				// ✅ **Add Saddle Pad Color Box**
				if (entry.saddlePad !== -1) {
					let saddleX = 37;
					let saddleY = startY + (rowHeight / 2) - 3; // ✅ Centered vertically
					let squareSize = 6;

					let colors = {
						1: { bg: [255, 0, 0], text: [255, 255, 255] }, // Red
						2: { bg: [0, 0, 255], text: [255, 255, 255] }, // Blue
						3: { bg: [255, 255, 255], text: [0, 0, 0] }, // White
						4: { bg: [0, 128, 0], text: [255, 255, 255] }, // Green
						5: { bg: [0, 0, 0], text: [255, 255, 255] }, // Black
						6: { bg: [255, 255, 0], text: [0, 0, 0] }, // Yellow
						7: { bg: [255, 105, 180], text: [255, 255, 255] }, // Pink
						8: { bg: [128, 128, 128], text: [255, 255, 255] }, // Grey
						9: { bg: [128, 0, 128], text: [255, 255, 255] }, // Purple
						10: { bg: [255, 0, 0], text: [255, 255, 255], half: [0, 0, 255] }, // Half Red/Half Blue
						11: { bg: [173, 216, 230], text: [0, 0, 0] }, // Light Blue
						12: { bg: [139, 69, 19], text: [255, 255, 255] }, // Brown
					};

					let defaultColor = { bg: [50, 205, 50], text: [0, 0, 0] }; // Lime Green for others
					let colorConfig = colors[entry.saddlePad] || defaultColor;

					if (entry.saddlePad == 10) {
						doc.setFillColor(...colorConfig.bg);
						doc.rect(saddleX, saddleY, squareSize / 2, squareSize, "F");
						doc.setFillColor(...colorConfig.half);
						doc.rect(saddleX + squareSize / 2, saddleY, squareSize / 2, squareSize, "F");
					} else {
						doc.setFillColor(...colorConfig.bg);
						doc.rect(saddleX, saddleY, squareSize, squareSize, "F");
					}

					doc.setTextColor(...colorConfig.text);
					doc.setFontSize(8);
					doc.text(`${entry.saddlePad}`, saddleX + 3, saddleY + 4, { align: "center" });
				}

				doc.setDrawColor(0, 0, 0);
				doc.line(14, startY + rowHeight, 184, startY + rowHeight);

				startY += rowHeight;
			});

			if (data.length === 0) {
				doc.text("No valid race changes to display.", 14, startY + 10);
			}

			doc.save(`Race_Changes_${trackName}_${raceDate}.pdf`);
			saveData();
		}


		////////////////////////////////////////////////////////////////////////////////////////////////////////
		//ADD ROW
		function addRow(entry = {}) {
			const tableBody = document.getElementById("tableBody");
			let row = document.createElement("tr");

			console.log("📌 Adding row for entry:", entry);

			// ✅ Race Number Dropdown
			let raceCell = document.createElement("td");
			let raceSelect = document.createElement("select");
			raceSelect.className = "raceNumber";
			raceSelect.innerHTML = '<option value="">Select</option>';

			function updateRaceDropdown() {
				if (window.horseEntries && Object.keys(window.horseEntries).length > 0) {
					Object.keys(window.horseEntries)
						.sort((a, b) => {
							const numA = parseInt(a.replace(/\D/g, ""), 10);
							const numB = parseInt(b.replace(/\D/g, ""), 10);
							return numA - numB;
						})
						.forEach(raceNum => {
							let option = document.createElement("option");
							option.value = raceNum;
							option.textContent = raceNum;
							raceSelect.appendChild(option);
						});
				}
			}


			updateRaceDropdown();
			raceCell.appendChild(raceSelect);
			row.appendChild(raceCell);

			// ✅ Saddle Pad Dropdown
			let saddleCell = document.createElement("td");
			let saddleSelect = document.createElement("select");
			saddleSelect.className = "saddlePad";
			saddleSelect.innerHTML = '<option value="">Select</option>';
			saddleCell.appendChild(saddleSelect);
			row.appendChild(saddleCell);

			// ✅ Horse Name Input
			let horseCell = document.createElement("td");
			let horseInput = document.createElement("input");
			horseInput.type = "text";
			horseInput.className = "horseName";
			horseInput.value = entry.horseName || "";
			horseCell.appendChild(horseInput);
			row.appendChild(horseCell);

			// ✅ Auto-populate Saddle Pads based on Race Selection
			function updateSaddlePadOptions() {
				let selectedRace = raceSelect.value;
				saddleSelect.innerHTML = '<option value="">Select</option>';

				if (selectedRace && window.horseEntries[selectedRace]) {
					window.horseEntries[selectedRace].forEach(horse => {
						let option = document.createElement("option");
						option.value = horse.saddlePad;
						option.textContent = horse.saddlePad;
						saddleSelect.appendChild(option);
					});
				}

				if (entry.saddlePad) {
					saddleSelect.value = entry.saddlePad;
				}
			}

			raceSelect.addEventListener("change", updateSaddlePadOptions);

			saddleSelect.addEventListener("change", function () {
				let selectedRace = raceSelect.value;
				let selectedSaddlePad = saddleSelect.value;
				if (selectedRace && selectedSaddlePad && window.horseEntries[selectedRace]) {
					let horse = window.horseEntries[selectedRace].find(h => h.saddlePad === selectedSaddlePad);
					if (horse) {
						horseInput.value = horse.horseName;
					}
				}
			});

		// ✅ Category Dropdown
		let categoryCell = document.createElement("td");
		let categorySelect = document.createElement("select");
		categorySelect.className = "changeCategory";
		categorySelect.innerHTML = `
			<option value="">Select Category</option>
			<option value="Driver Change">Driver Change</option>
			<option value="Trainer Change">Trainer Change</option>
			<option value="Owner Change">Owner Change</option>
			<option value="Medication Change">Medication Change</option>
			<option value="SCRATCHED">SCRATCHED</option>
   			<option value="Line TBA">Line TBA</option>
			<option value="Equipment Change">Equipment Change</option>
			<option value="Claimed">Claimed</option>
			<option value="Other">Other</option>
		`;

		if (entry.category) {
			categorySelect.value = entry.category;
		}

		categorySelect.addEventListener("change", function () {
			if (this.value === "Driver Change") {
				console.log("📌 Opening Driver Popup...");
				openDriverPopup(changeInput);  // ✅ Pass the correct text field
			} else if (this.value === "Equipment Change") {
				console.log("📌 Opening Equipment Popup...");
				openEquipmentPopup(changeInput);  // ✅ Pass the correct text field
			}
		});

		categoryCell.appendChild(categorySelect);
		row.appendChild(categoryCell);


			// ✅ Change Text Area
			let changeCell = document.createElement("td");
			let changeInput = document.createElement("textarea");
			changeInput.className = "changeText";
			changeInput.value = entry.change || "";
			changeCell.appendChild(changeInput);
			row.appendChild(changeCell);

			// ✅ Delete Button
			let deleteCell = document.createElement("td");
			let deleteButton = document.createElement("button");
			deleteButton.className = "deleteBtn";
			deleteButton.textContent = "Delete";
			deleteButton.onclick = function () {
				row.remove();
			};
			deleteCell.appendChild(deleteButton);
			row.appendChild(deleteCell);

			tableBody.appendChild(row);

			// ✅ Load Saved Data
			raceSelect.value = entry.raceNumber || "";
			updateSaddlePadOptions();
			setTimeout(() => {
				saddleSelect.value = entry.saddlePad || "";
				saddleSelect.dispatchEvent(new Event("change"));
			}, 100);
		}




		////////////////////////////////////////////////////////////////////////////////////////////////////////
		//EQUIPMENT CHANGES POP-UP
//let currentEquipmentField; // Store the text field being updated



function openEquipmentPopup(changeTextField) {
    if (!changeTextField) {
        console.error("❌ Error: Equipment Text Field is undefined!");
        return;
    }

    currentEquipmentField = changeTextField; // ✅ Store reference properly
    console.log("📌 Equipment Popup Opened, Target Field Set:", currentEquipmentField);

    fetch("/json/equipment.json")
        .then(response => response.ok ? response.json() : [])
        .then(equipmentList => {
            let dropdown = document.getElementById("equipmentList");
            let newEquipmentField = document.getElementById("newEquipment");

            dropdown.innerHTML = ""; // Clear previous options

            equipmentList.forEach(item => {
                let option = document.createElement("option");
                option.value = item;
                option.textContent = item;
                dropdown.appendChild(option);
            });

            dropdown.addEventListener("change", function () {
                if (this.value.toUpperCase() === "HOPPLE LENGTH") {
                    newEquipmentField.value = "HOPPLE LENGTH "; // Pre-fill for user input
                } else {
                    newEquipmentField.value = this.value;
                }
            });

            let existingChanges = currentEquipmentField.value ? currentEquipmentField.value.split(", ") : [];
            selectedEquipmentChanges = [...existingChanges]; // Copy existing changes
            document.getElementById("equipmentPreview").value = selectedEquipmentChanges.join(", ");

            newEquipmentField.addEventListener("input", function () {
                filterEquipment(this.value, equipmentList);
            });

        })
        .catch(error => console.error("Error loading equipment:", error));

    document.getElementById("equipmentPopup").classList.remove("hidden");
}




function filterEquipment(searchTerm, equipmentList) {
    let dropdown = document.getElementById("equipmentList");
    dropdown.innerHTML = ""; // Clear previous list

    searchTerm = searchTerm.toLowerCase(); // Convert input to lowercase

    let filteredItems = equipmentList.filter(item => item.toLowerCase().includes(searchTerm));

    filteredItems.forEach(item => {
        let option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        dropdown.appendChild(option);
    });

    // If no match, allow new entry
    if (filteredItems.length === 0) {
        let option = document.createElement("option");
        option.value = searchTerm;
        option.textContent = `New: ${searchTerm}`;
        option.selected = true;
        dropdown.appendChild(option);
    }

    // ✅ Update input field when an item is clicked
    dropdown.addEventListener("change", function() {
        document.getElementById("newEquipment").value = this.value;
    });
}

function addEquipmentChange() {
    let newEquipmentField = document.getElementById("newEquipment");
    let selectedEquipment = document.getElementById("equipmentList").value;
    let newEquipment = newEquipmentField.value.trim();

    let finalEquipment = newEquipment !== "" ? newEquipment : selectedEquipment;

    // ✅ Prevent duplicate entries
    if (finalEquipment !== "" && !selectedEquipmentChanges.includes(finalEquipment)) {
        selectedEquipmentChanges.push(finalEquipment); // Add to list

        // ✅ Update preview field with all changes
        document.getElementById("equipmentPreview").value = selectedEquipmentChanges.join(", ");

        // ✅ Clear input field for next entry
        newEquipmentField.value = "";
    }
}


function saveEquipmentChanges() {
    if (currentEquipmentField) {
        currentEquipmentField.value = selectedEquipmentChanges.join(", "); // Update Change Text field
    }

    let newEquipmentEntries = selectedEquipmentChanges.filter(item => {
        // ✅ Do not store variations of "HOPPLE LENGTH"
        if (item.toUpperCase().startsWith("HOPPLE LENGTH")) {
            return false;
        }
        return !document.getElementById("equipmentList").innerHTML.includes(item);
    });

    if (newEquipmentEntries.length > 0) {
        fetch("/json/equipment.json")
            .then(response => response.ok ? response.json() : [])
            .then(existingEquipment => {
                let updatedEquipment = [...new Set([...existingEquipment, ...newEquipmentEntries])]; // Remove duplicates
                
                // ✅ Sort alphabetically (case-insensitive)
                updatedEquipment.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

                return fetch("/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileName: "equipment.json", data: updatedEquipment })
                });
            })
            .catch(error => console.error("Error saving new equipment:", error));
    }

    closeEquipmentPopup();
}



function closeEquipmentPopup() {
    document.getElementById("equipmentPopup").classList.add("hidden");
    document.getElementById("newEquipment").value = ""; // Reset input
    document.getElementById("equipmentPreview").value = ""; // Reset preview
}

function removeLastEquipmentChange() {
    if (selectedEquipmentChanges.length > 0) {
        selectedEquipmentChanges.pop(); // Remove the last item
        document.getElementById("equipmentPreview").value = selectedEquipmentChanges.join(", "); // Update preview
    } else {
        alert("No changes to remove.");
    }
}

function checkEnter(event) {
    if (event.key === "Enter") {
        validateLogin();
    }
}

//let currentChangeTextField; // Store the current text field for update

function openDriverPopup(changeTextField) {
    if (!changeTextField) {
        console.error("❌ Error: Change Text Field is undefined!");
        return;
    }

    currentChangeTextField = changeTextField; // ✅ Store reference properly
    console.log("📌 Driver Popup Opened, Target Field Set:", currentChangeTextField);

    fetch("/json/drivers.json")
        .then(response => response.ok ? response.json() : [])
        .then(drivers => {
            let driverList = document.getElementById("driverList");
            driverList.innerHTML = ""; // Clear previous list

            drivers.forEach(driver => {
                let option = document.createElement("option");
                option.value = driver;
                option.textContent = driver;
                driverList.appendChild(option);
            });

            document.getElementById("newDriver").addEventListener("input", function () {
                filterDrivers(this.value, drivers);
            });

        })
        .catch(error => console.error("Error loading drivers:", error));

    document.getElementById("driverPopup").classList.remove("hidden");
}




function filterDrivers(searchTerm, drivers) {
    let driverList = document.getElementById("driverList");
    driverList.innerHTML = ""; // Clear previous list

    searchTerm = searchTerm.toLowerCase(); // Convert input to lowercase

    let filteredDrivers = drivers.filter(driver => driver.toLowerCase().startsWith(searchTerm));

    filteredDrivers.forEach(driver => {
        let option = document.createElement("option");
        option.value = driver;
        option.textContent = driver;
        driverList.appendChild(option);
    });

    // If no match, allow new entry
    if (filteredDrivers.length === 0) {
        let option = document.createElement("option");
        option.value = searchTerm;
        option.textContent = `New: ${searchTerm}`;
        option.selected = true;
        driverList.appendChild(option);
    }

    // ✅ Add event listener to update input field when a name is clicked
    driverList.addEventListener("change", function() {
        document.getElementById("newDriver").value = this.value; // Set the input field to the selected value
    });
}


function saveDriverSelection() {
	const input = document.getElementById("newDriver");
	const list = document.getElementById("driverList");

	let selectedValue = list.value.trim();
	let typedValue = input.value.trim();

	let finalDriver = "";

	// ✅ Prefer dropdown selection if it's changed
	if (selectedValue && selectedValue !== "New: " + typedValue) {
		finalDriver = selectedValue;
	} else if (typedValue) {
		finalDriver = typedValue;
	}

	if (!finalDriver) {
		alert("Please enter or select a driver name.");
		return;
	}

	if (currentChangeTextField) {
		currentChangeTextField.value = finalDriver;
	}

	// ✅ Save new driver if not already in list
	fetch("/json/drivers.json")
		.then(res => res.ok ? res.json() : [])
		.then(drivers => {
			if (!drivers.includes(finalDriver)) {
				drivers.push(finalDriver);
				drivers.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

				return fetch("/save", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ fileName: "drivers.json", data: drivers })
				});
			}
		})
		.catch(error => console.error("Error saving new driver:", error));

	closePopup();
}




function closePopup() {
    document.getElementById("driverPopup").classList.add("hidden");
    document.getElementById("newDriver").value = ""; // Reset input field
}

function updateSaddlePadDropdown(row, raceNumber) {
    let saddleSelect = row.querySelector(".saddlePad");
    saddleSelect.innerHTML = '<option value="">Select</option>'; // Reset dropdown

    if (!window.horseEntries || !window.horseEntries[raceNumber]) return;

    let horseList = window.horseEntries[raceNumber];

    horseList.forEach(horse => {
        let option = document.createElement("option");
        option.value = horse.saddlePad; // Use saddle pad number
        option.textContent = horse.saddlePad; // Display saddle pad number
        saddleSelect.appendChild(option);
    });

    saddleSelect.addEventListener("change", function() {
        autoFillHorseName(row, raceNumber, this.value);
    });
}


function autoFillHorseName(row, raceNumber, saddlePad) {
    let horseInput = row.querySelector(".horseName");

    if (!window.horseEntries || !window.horseEntries[raceNumber]) return;

    let horseList = window.horseEntries[raceNumber];

    let horse = horseList.find(e => e.saddlePad === saddlePad);
    horseInput.value = horse ? horse.horseName : "";
}



function uploadFile() {
    const fileInput = document.getElementById("entryFile");
    if (!fileInput.files.length) {
        alert("Please select a file.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        const fileContent = event.target.result;
        console.log("File Content Loaded:", fileContent.substring(0, 500)); // Log first 500 chars

        // ✅ Parse horse entries (correcting order for 103 and 201)
        const horseEntries = {};
        let currentRace = null;
        let saddlePad = null;
        let extractedDate = null;
        const lines = fileContent.split("\n");

        lines.forEach(line => {
            let parts = line.trim().split(">"); // Split at '>' to isolate key-value pairs
            
            parts.forEach(part => {
                if (part.includes("<")) {
                    let keyValue = part.split("<");

                    if (keyValue.length < 2) {
                        return; // Skip if key-value format is incorrect
                    }

                    let key = keyValue[0].trim();
                    let value = keyValue[1].trim();

                    if (key === "001") {
                        // ✅ Extract the race date (ignoring first 4 chars & last 2)
                        let rawDate = value.substring(5, value.length - 2); // Extract DD-MMM-YY format

                        // ✅ Convert to YYYY-MM-DD
                        try {
                            let dateObj = new Date(rawDate.replace(/(\d{0})-(\w{3})-(\d{4})/, "$3-$2-$1"));
                            extractedDate = dateObj.toISOString().split("T")[0]; // Format YYYY-MM-DD
                        } catch (error) {
                            console.warn("Date parsing failed:", rawDate);
                        }
                    }

                    if (key === "103") {
                        // ✅ Store saddlePad BEFORE horse entry appears
                        saddlePad = value;

                    } else if (key === "201") {
                        // ✅ New Race Detected
                        if (currentRace === null) {
                            currentRace = `Race ${Object.keys(horseEntries).length + 1}`;
                            horseEntries[currentRace] = [];
                        }

                        // ✅ Assign the last stored saddlePad to the horse entry
                        horseEntries[currentRace].push({ saddlePad, horseName: value });

                    } else if (key === "999") {
                        // ✅ End of the race
                        currentRace = null;
                        saddlePad = null;
                    }
                }
            });
        });

	    // ✅ Step: Collect all driver names from key 601
	const newDriverNames = new Set();
	
	lines.forEach(line => {
	    let parts = line.trim().split(">");
	    parts.forEach(part => {
	        if (part.includes("<")) {
	            const [key, value] = part.split("<");
	            if (key.trim() === "601" && value.trim()) {
	                newDriverNames.add(value.trim());
	            }
	        }
	    });
	});
	
	// ✅ Step: Load existing drivers.json and sync
	if (newDriverNames.size > 0) {
	    fetch("/json/drivers.json")
	        .then(res => res.ok ? res.json() : [])
	        .then(existingDrivers => {
	            let updatedDrivers = [...new Set([...existingDrivers, ...newDriverNames])];
	            updatedDrivers.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
	
	            return fetch("/save", {
	                method: "POST",
	                headers: { "Content-Type": "application/json" },
	                body: JSON.stringify({ fileName: "drivers.json", data: updatedDrivers })
	            });
	        })
	        .then(() => console.log("✅ Drivers synced from race file."))
	        .catch(err => console.error("❌ Error syncing drivers:", err));
	}


        console.log("Extracted Horse Entries with SaddlePads:", horseEntries);
        console.log("Extracted Date:", extractedDate);

        // ✅ Set Date Field Automatically
        if (extractedDate) {
            document.getElementById("raceDate").value = extractedDate;
        }

        // ✅ Send data to the backend for temporary storage
        const trackName = document.getElementById("trackName").value;
        const raceDate = extractedDate || document.getElementById("raceDate").value; // Use extracted date if available

        fetch("/save-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackName, raceDate, horseEntries })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Entries stored successfully!");
                window.horseEntries = horseEntries; // Store in memory for dropdown use
            } else {
                alert("Error storing entries.");
            }
        })
        .catch(error => console.error("Error storing entries:", error));
    };

    reader.readAsText(file);
}
