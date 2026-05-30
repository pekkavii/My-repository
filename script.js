let selectedLat;
let selectedLon;
let customMarker = null;

document.addEventListener("DOMContentLoaded", function () {
    const map = L.map('map').setView([60.3714, 26.3469], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Create panes for dose layers so severe doses always render on top
    // Higher zIndex = rendered on top
    map.createPane('doseGreen');  map.getPane('doseGreen').style.zIndex  = 410;
    map.createPane('doseOrange'); map.getPane('doseOrange').style.zIndex = 420;
    map.createPane('doseRed');    map.getPane('doseRed').style.zIndex    = 430;
    map.createPane('doseBlack');  map.getPane('doseBlack').style.zIndex  = 440;
    
    let select = document.getElementById("powerPlantSelection");
    let marker;
    let plumeLayers = [];
    let isCustomActive = false;
    let animationLayersGenerated = false;
    let paramsChanged = false;

    // --- Day counter overlay ---
    const dayDisplay = document.createElement("div");
    dayDisplay.id = "dayDisplay";
    dayDisplay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 72px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.55);
        text-shadow: 2px 2px 8px rgba(0,0,0,0.7);
        pointer-events: none;
        z-index: 1002;
        display: none;
        font-family: Arial, sans-serif;
        letter-spacing: 2px;
    `;
    document.getElementById("map").appendChild(dayDisplay);

    function updateDayDisplay(frameIndex) {
        // frameIndex is 0-based; day = floor(hours / 24), hours start at 1
        const hour = frameIndex + 1;
        const day = Math.floor((hour - 1) / 24);
        dayDisplay.textContent = `DAY ${day + 1}`;
        dayDisplay.style.display = "block";
    }

    function hideDayDisplay() {
        dayDisplay.style.display = "none";
    }

    fetch('power_plants.json')
        .then(response => response.json())
        .then(data => {
            const byCountry = {};
            data.forEach(plant => {
                if (!byCountry[plant.country]) byCountry[plant.country] = [];
                byCountry[plant.country].push(plant);
            });

            Object.keys(byCountry).sort().forEach(country => {
                const group = document.createElement("optgroup");
                group.label = country;
                byCountry[country].forEach(plant => {
                    let option = document.createElement("option");
                    option.value = `${plant.lat},${plant.lon}`;
                    option.textContent = `${plant.name} (${plant.electrical_power_MW} MW)`;
                    option.dataset.details = JSON.stringify(plant);
                    group.appendChild(option);
                });
                select.appendChild(group);
            });

            const crossIcon = L.divIcon({
                className: '',
                html: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <line x1="8" y1="1" x2="8" y2="15" stroke="#cc0000" stroke-width="2.5"/>
                    <line x1="1" y1="8" x2="15" y2="8" stroke="#cc0000" stroke-width="2.5"/>
                </svg>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
                popupAnchor: [0, -10]
            });

            data.forEach(plant => {
                const nppMarker = L.marker([plant.lat, plant.lon], { icon: crossIcon }).addTo(map);
                const statusText = plant.electrical_power_MW === 0
                    ? '<span style="color:gray">(Suljettu)</span>'
                    : `${plant.electrical_power_MW} MW`;
                nppMarker.bindPopup(`
                    <b>${plant.name}</b><br>
                    <b>Maa:</b> ${plant.country}<br>
                    <b>Reaktori:</b> ${plant.reactor_type}<br>
                    <b>Sähköteho:</b> ${statusText}
                `, { maxWidth: 220 });
            });
       
            select.addEventListener("change", function () {
                let selectedOption = select.options[select.selectedIndex];
                clearAnimation();
                 
                if (!selectedOption.value) {
                    selectedLat = undefined;
                    selectedLon = undefined;
                    if (marker) map.removeLayer(marker);
                    plumeLayers.forEach(layer => map.removeLayer(layer));
                    plumeLayers = [];
                    document.getElementById("reactorTypeRow").style.display = "none";
                    Array.from(document.getElementById("ines").options).forEach(opt => opt.disabled = false);
                    return;
                }

                if (selectedOption.value === "custom") {
                    alert("Tuplaklikkaa kartalta vapaavalintainen voimalan paikka.");
                    if (marker) map.removeLayer(marker);
                    if (customMarker) { map.removeLayer(customMarker); customMarker = null; }
                    plumeLayers.forEach(layer => map.removeLayer(layer));
                    plumeLayers = [];
                    enableMapDoubleClick();
                    return;
                } else {
                    disableMapDoubleClick();
                }

                let plant = JSON.parse(selectedOption.dataset.details);
                let lat = parseFloat(plant.lat);
                let lon = parseFloat(plant.lon);

                if (isNaN(lat) || isNaN(lon)) {
                    console.error("Virhe: lat tai lon on NaN!", lat, lon);
                    return;
                }

                if (marker) map.removeLayer(marker);
                if (customMarker) { map.removeLayer(customMarker); customMarker = null; }
                plumeLayers.forEach(layer => map.removeLayer(layer));
                plumeLayers = [];

                const isClosed = plant.electrical_power_MW === 0;

                marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`
                        <b>${plant.name}</b><br>
                        <b>Maa:</b> ${plant.country}<br>
                        <b>Reaktori:</b> ${plant.reactor_type}<br>
                        <b>Sähköteho:</b> ${isClosed ? '<i>Suljettu</i>' : plant.electrical_power_MW + ' MW'}<br>
                        ${isClosed ? '<b style="color:gray">Laitos on suljettu. Vain INES 3–4 mahdollinen.</b>' : ''}
                    `).openPopup();

                map.setView([lat, lon], 7);
                selectedLat = lat;
                selectedLon = lon;

                // Hide custom reactor type selector for predefined plants
                document.getElementById("reactorTypeRow").style.display = "none";

                // Reset all INES options first, then apply closed-plant limit if needed
                const inesSelect = document.getElementById("ines");
                Array.from(inesSelect.options).forEach(opt => opt.disabled = false);
                if (isClosed) {
                    Array.from(inesSelect.options).forEach(opt => {
                        opt.disabled = parseInt(opt.value) > 4;
                    });
                    if (parseInt(inesSelect.value) > 4) inesSelect.value = "4";
                }

                if (document.getElementById("useWeatherBasedValues").checked) {
                    fetchWeather();
                }
            });
        })
        .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));

    document.getElementById("toggleControls").addEventListener("click", () => {
        const controls = document.getElementById("controls");
        controls.classList.toggle("collapsed");
        const toggleBtn = document.getElementById("toggleControls");
        toggleBtn.textContent = controls.classList.contains("collapsed")
            ? "Näytä ohjaimet"
            : "Piilota ohjaimet";
    });

    document.getElementById("useWeatherBasedValues").addEventListener("change", function () {
        if (this.checked) {
            if (selectedLat == null || selectedLon == null) {
                alert("Valitse ensin voimala ennen säätietojen hakua!");
                this.checked = false;
            } else {
                paramsChanged = true;
                animationLayersGenerated = false;
                fetchWeather();
            }
        }
    });

    document.getElementById("windDirection").addEventListener("input", function () {
        document.getElementById("useWeatherBasedValues").checked = false;
        paramsChanged = true;
        animationLayersGenerated = false;
        clearAnimation();
    });

    document.getElementById("windSpeed").addEventListener("input", function () {
        document.getElementById("useWeatherBasedValues").checked = false;
        paramsChanged = true;
        animationLayersGenerated = false;
        clearAnimation();
    });

    document.getElementById("stabilityClass").addEventListener("change", () => {
        document.getElementById("useWeatherBasedValues").checked = false;
        paramsChanged = true;
        animationLayersGenerated = false;
        clearAnimation();
    });

    document.getElementById("stackHeight").addEventListener("input", function () {
        paramsChanged = true;
        animationLayersGenerated = false;
        clearAnimation();
    });

    document.getElementById("ines").addEventListener("change", function () {
        paramsChanged = true;
        animationLayersGenerated = false;
        clearAnimation();
    });

    document.getElementById("simulateButton").addEventListener("click", function () {
        if (selectedLat === undefined || selectedLon === undefined) {
            alert("Valitse ensin voimala!");
            return;
        }

        // Enforce INES limit based on reactor type
        const reactorType = document.getElementById("reactorType").value;
        const ines = parseInt(document.getElementById("ines").value);
        const maxInes = { "mmr": 5, "smr": 6, "medium": 7, "large": 7, "custom": 7 };
        const limit = maxInes[reactorType] || 7;
        if (ines > limit) {
            alert(`Valittu reaktorityyppi sallii enintään INES ${limit} -onnettomuuden.\nValitse pienempi INES-luokka.`);
            return;
        }

        hideDayDisplay();
        simulateGaussian(selectedLat, selectedLon);
    });

    document.getElementById("resetAnimationButton").addEventListener("click", resetAnimation);
    document.getElementById("toggleAnimationButton").addEventListener("click", toggleAnimation);
    document.getElementById("jumpToEndButton").addEventListener("click", jumpToEnd);


    // -----------------------------------------------------------------------
    // Ellipse model (kept for reference, not currently used in UI)
    // -----------------------------------------------------------------------
    function simulateEllipse(lat, lon) {
        let ines = parseInt(document.getElementById("ines").value);
        if (isNaN(ines) || ines < 3 || ines > 7) return;
        if (isNaN(lat) || isNaN(lon)) return;

        let windDirection = parseFloat(document.getElementById("windDirection").value);
        if (!isNaN(windDirection)) windDirection = (windDirection + 180) % 360;
        if (isNaN(windDirection)) windDirection = 90;
        let windSpeed = parseFloat(document.getElementById("windSpeed").value);
        if (isNaN(windSpeed)) windSpeed = 5;

        let baseSize = (ines - 3) * 30 * 1000;
        let scaleFactors = [1, 0.5, 0.25];
        let colors = ['green', 'orange', 'red'];

        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];

        scaleFactors.forEach((scale, index) => {
            let semiMajor = baseSize * scale;
            let semiMinor = semiMajor / (1 + windSpeed / 5);
            if (semiMinor < 100) semiMinor = 100;
            let windRad = windDirection * (Math.PI / 180);
            let semiMajorKm = semiMajor / 1000;
            let newLat = lat + (semiMajorKm / 111) * Math.cos(windRad);
            let newLon = lon + (semiMajorKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(windRad);
            let plume = drawEllipse(newLat, newLon, semiMinor / 1000, semiMajor / 1000, windDirection, colors[index]);
            plumeLayers.push(plume);
        });
    }

    function drawEllipse(lat, lon, semiMajor, semiMinor, rotation, color) {
        let points = [];
        let rotationRad = rotation * (Math.PI / 180);
        for (let i = 0; i < 36; i++) {
            let angle = i * (2 * Math.PI / 36);
            let x = semiMajor * Math.cos(angle);
            let y = semiMinor * Math.sin(angle);
            let rotatedX = x * Math.cos(rotationRad) + y * Math.sin(rotationRad);
            let rotatedY = -x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
            points.push([lat + rotatedY / 111, lon + rotatedX / (111 * Math.cos(lat * Math.PI / 180))]);
        }
        points.push(points[0]);
        return L.polygon(points, { color, fillColor: color, fillOpacity: 0.4 }).addTo(map);
    }


    // -----------------------------------------------------------------------
    // Gaussian plume — static simulation
    // -----------------------------------------------------------------------
    function simulateGaussian(lat, lon) {
        let ines = parseInt(document.getElementById("ines").value);

        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];
        // Also clear any animation layers so old animation doesn't show under simulation
        animationLayers.forEach(layer => map.removeLayer(layer));
        animationLayers = [];
        clearInterval(animationTimer);
        isPlaying = false;

        // INES 3 — site area only
        if (ines === 3) {
            const circle = L.circle([lat, lon], {
                radius: 1000, color: "yellow", weight: 2,
                fillColor: "yellow", fillOpacity: 0.4
            }).addTo(map);
            circle.bindPopup("INES 3 – Vakava poikkeama:<br>Vaikutukset rajoittuvat laitosalueelle.<br>Ympäristöön ei tapahdu merkittävää radioaktiivista päästöä.");
            plumeLayers.push(circle);
            return;
        }

        // INES 4 — protective zone only
        if (ines === 4) {
            const circle = L.circle([lat, lon], {
                radius: 5000, color: "orange", weight: 2,
                fillColor: "orange", fillOpacity: 0.3
            }).addTo(map);
            circle.bindPopup("INES 4 – Onnettomuus:<br>Vaikutukset rajoittuvat suojavyöhykkeelle (n. 5 km).<br>Merkittävää ympäristöpäästöä ei odoteta.");
            plumeLayers.push(circle);
            return;
        }

        // INES 5–7 — full Gaussian plume with confidence cone
        let Q_TBq = Math.pow(10, ines - 4) * 10;
        let Q_tot = Q_TBq * 5 * 1e12;
        let Q = Q_tot / 7 / 24 / 3600;

        const windSpeed   = parseFloat(document.getElementById("windSpeed").value) || 5;
        const windDirection = parseFloat(document.getElementById("windDirection").value);
        const H           = parseFloat(document.getElementById("stackHeight").value) || 100;
        const stability   = document.getElementById("stabilityClass").value || "D";
        const breathingRate = 1.2 / 3600;
        const doseConversionFactor = 2.2e-8;
        const numOffsets  = 15;
        const spreadFactor = 4;

        const mixingHeight = (stability === "A" || stability === "B") ? 1500
                           : stability === "C" ? 1200
                           : stability === "D" ? 800 : 500;

        let actualMaxRangeKm = 0;

        // Centreline only — side plumes commented out by user
        const coneOffsets = [
            { angleDeg:  0, opacity: 0.35 },
        ];

        coneOffsets.forEach(({ angleDeg, opacity }) => {
            const offsetDirection = windDirection + angleDeg;
            const adjustedDirection = (270 - offsetDirection + 360) % 360;
            const rad = adjustedDirection * Math.PI / 180;

            for (let x = 500; x <= 500000; x += 1000) {
                let σy, σz;
                switch (stability) {
                    case "A": σy = 0.22*x*Math.pow(1+0.0001*x,-0.5); σz = 0.20*x*Math.pow(1+0.0001*x,-0.5); break;
                    case "B": σy = 0.16*x*Math.pow(1+0.0001*x,-0.5); σz = 0.12*x*Math.pow(1+0.0001*x,-0.5); break;
                    case "C": σy = 0.11*x*Math.pow(1+0.0001*x,-0.5); σz = 0.08*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "D": σy = 0.08*x*Math.pow(1+0.0001*x,-0.5); σz = 0.06*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "E": σy = 0.06*x*Math.pow(1+0.0001*x,-0.5); σz = 0.03*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "F": σy = 0.04*x*Math.pow(1+0.0001*x,-0.5); σz = 0.016*x*Math.pow(1+0.0015*x,-0.5); break;
                    default:  σy = 0.08*x*Math.pow(1+0.0001*x,-0.5); σz = 0.06*x*Math.pow(1+0.0015*x,-0.5);
                }
                σz = Math.min(σz, mixingHeight);

                for (let i = -(Math.floor(numOffsets/2)); i <= Math.floor(numOffsets/2); i++) {
                    const y = i * σy * spreadFactor / (numOffsets / 2);
                    const z = 1.5;
                    const exp1 = Math.exp(-Math.pow(y / σy, 2) / 2);
                    const exp2 = Math.exp(-Math.pow((z - H) / σz, 2) / 2);
                    const exp3 = Math.exp(-Math.pow((z + H) / σz, 2) / 2);
                    const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) * exp1 * (exp2 + exp3);
                    const doseRate_Sv_per_week = C * breathingRate * doseConversionFactor * 3600 * 24 * 7;
                    if (doseRate_Sv_per_week * 1e3 < 1) continue;

                    const dx = (x/1000)*Math.cos(rad) - (y/1000)*Math.sin(rad);
                    const dy = (x/1000)*Math.sin(rad) + (y/1000)*Math.cos(rad);
                    const pointLat = lat + dy / 111;
                    const pointLon = lon + dx / (111 * Math.cos(lat * Math.PI / 180));

                    let color = "green";
                    if (doseRate_Sv_per_week > 1)    color = "black";
                    else if (doseRate_Sv_per_week > 0.1)  color = "red";
                    else if (doseRate_Sv_per_week > 0.01) color = "orange";

                    const pane = color === "black" ? "doseBlack"
                                : color === "red"   ? "doseRed"
                                : color === "orange" ? "doseOrange"
                                : "doseGreen";
                    const circle = L.circle([pointLat, pointLon], {
                        radius: 500, fillColor: color, color: color,
                        weight: 0, fillOpacity: opacity, pane
                    }).addTo(map);

                    if (angleDeg === 0) {
                        circle.bindPopup(
                            `Etäisyys: ${(x/1000).toFixed(1)} km<br>
                            Poikkeama: ${Math.round(y)} m<br>
                            Pitoisuus: ${C.toExponential(2)} Bq/m³<br>
                            Annos viikossa: ${(doseRate_Sv_per_week * 1e3).toFixed(2)} mSv`
                        );
                        if (i === 0) actualMaxRangeKm = Math.max(actualMaxRangeKm, x / 1000);
                    }
                    plumeLayers.push(circle);
                }
            }
        });

        // Post-scan wedge
        if (actualMaxRangeKm > 0) {
            const coneHalfAngle = 30;
            const coneSteps = 30;
            const wedgePoints = [[lat, lon]];
            for (let s = 0; s <= coneSteps; s++) {
                const angleDeg = windDirection - coneHalfAngle + (s / coneSteps) * (2 * coneHalfAngle);
                const adjustedDir = (270 - angleDeg + 360) % 360;
                const wRad = adjustedDir * Math.PI / 180;
                const dx = actualMaxRangeKm * Math.cos(wRad);
                const dy = actualMaxRangeKm * Math.sin(wRad);
                wedgePoints.push([lat + dy/111, lon + dx/(111*Math.cos(lat*Math.PI/180))]);
            }
            wedgePoints.push([lat, lon]);
            const wedge = L.polygon(wedgePoints, {
                color: "gray", weight: 1, opacity: 0.4,
                fillColor: "yellow", fillOpacity: 0.2,
                interactive: false
            }).addTo(map);
            plumeLayers.push(wedge);
        }
    }


    // -----------------------------------------------------------------------
    // Animation
    // -----------------------------------------------------------------------
    let animationLayers = [];
    let animationTimer = null;
    let currentFrame = 0;
    const maxFrames = 168;
    const animationDelay = 500;

    function generateAnimationLayers(lat, lon) {
        if (!lat || !lon) { alert("Valitse ensin voimala tai paikka kartalta."); return; }

        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];
        animationLayers.forEach(layer => map.removeLayer(layer));
        animationLayers = [];

        let ines = parseInt(document.getElementById("ines").value);
        let Q_TBq = Math.pow(10, ines - 4) * 10;
        let Q_tot = Q_TBq * 5 * 1e12;
        let Q = Q_tot / 7 / 24 / 3600;

        const windSpeed   = parseFloat(document.getElementById("windSpeed").value) || 5;
        const windDirection = parseFloat(document.getElementById("windDirection").value);
        const H           = parseFloat(document.getElementById("stackHeight").value) || 100;
        const stability   = document.getElementById("stabilityClass").value || "D";
        const breathingRate = 1.2 / 3600;
        const doseConversionFactor = 2.2e-8;
        const numOffsets  = 15;
        const spreadFactor = 4;
        const adjustedDirection = (270 - windDirection + 360) % 360;
        const rad = adjustedDirection * Math.PI / 180;

        for (let hour = 1; hour <= maxFrames; hour++) {
            const frameGroup = L.layerGroup();

            for (let x = 500; x <= 500000; x += 2000) {
                const mixingHeight = (stability === "A" || stability === "B") ? 1500
                                   : stability === "C" ? 1200
                                   : stability === "D" ? 800 : 500;
                let σy, σz;
                switch (stability) {
                    case "A": σy = 0.22*x*Math.pow(1+0.0001*x,-0.5); σz = 0.20*x*Math.pow(1+0.0001*x,-0.5); break;
                    case "B": σy = 0.16*x*Math.pow(1+0.0001*x,-0.5); σz = 0.12*x*Math.pow(1+0.0001*x,-0.5); break;
                    case "C": σy = 0.11*x*Math.pow(1+0.0001*x,-0.5); σz = 0.08*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "D": σy = 0.08*x*Math.pow(1+0.0001*x,-0.5); σz = 0.06*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "E": σy = 0.06*x*Math.pow(1+0.0001*x,-0.5); σz = 0.03*x*Math.pow(1+0.0015*x,-0.5); break;
                    case "F": σy = 0.04*x*Math.pow(1+0.0001*x,-0.5); σz = 0.016*x*Math.pow(1+0.0015*x,-0.5); break;
                    default:  σy = 0.08*x*Math.pow(1+0.0001*x,-0.5); σz = 0.06*x*Math.pow(1+0.0015*x,-0.5);
                }
                σz = Math.min(σz, mixingHeight);

                for (let i = -(Math.floor(numOffsets/2)); i <= Math.floor(numOffsets/2); i++) {
                    const y = i * σy * spreadFactor / (numOffsets / 2);
                    const z = 1.5;
                    const exp1 = Math.exp(-Math.pow(y / σy, 2) / 2);
                    const exp2 = Math.exp(-Math.pow((z - H) / σz, 2) / 2);
                    const exp3 = Math.exp(-Math.pow((z + H) / σz, 2) / 2);
                    const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) * exp1 * (exp2 + exp3);
                    const dose = C * breathingRate * doseConversionFactor * 3600 * hour;
                    if (dose * 1000 < 1) continue;

                    const dx = (x/1000)*Math.cos(rad) - (y/1000)*Math.sin(rad);
                    const dy = (x/1000)*Math.sin(rad) + (y/1000)*Math.cos(rad);
                    const pointLat = lat + dy / 111;
                    const pointLon = lon + dx / (111 * Math.cos(lat * Math.PI / 180));

                    let color = dose > 1 ? "black" : dose > 0.1 ? "red" : dose > 0.01 ? "orange" : "green";
                    const pane = color === "black" ? "doseBlack"
                               : color === "red"   ? "doseRed"
                               : color === "orange" ? "doseOrange"
                               : "doseGreen";
                    frameGroup.addLayer(L.circle([pointLat, pointLon], {
                        radius: 400, fillColor: color, color: color,
                        weight: 0, fillOpacity: 0.4, pane
                    }));
                }
            }
            animationLayers.push(frameGroup);
        }
    }

    function playAnimation() {
        if (!selectedLat || !selectedLon) { alert("Valitse ensin voimala."); return; }
        // Clear any static simulation result before starting animation
        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];
        generateAnimationLayers(selectedLat, selectedLon);
        if (animationTimer) clearInterval(animationTimer);
        currentFrame = 0;

        animationTimer = setInterval(() => {
            if (currentFrame >= animationLayers.length) {
                clearInterval(animationTimer);
                return;
            }
            if (currentFrame > 0) map.removeLayer(animationLayers[currentFrame - 1]);
            map.addLayer(animationLayers[currentFrame]);
            updateDayDisplay(currentFrame);
            updateAnimationUI();
            currentFrame++;
        }, animationDelay);
    }

    let isPlaying = false;

    function updateAnimationUI() {
        const status = document.getElementById("animationStatus");
        const slider = document.getElementById("animationSlider");
        status.textContent = `${currentFrame + 1} / ${maxFrames} h`;
        slider.value = currentFrame + 1;
    }

    function showFrame(frame) {
        animationLayers.forEach(layer => map.removeLayer(layer));
        if (frame >= 0 && frame < animationLayers.length) {
            map.addLayer(animationLayers[frame]);
            updateDayDisplay(frame);
        }
        currentFrame = frame;
        updateAnimationUI();
    }

    function playStep() {
        if (!isPlaying) return;
        if (currentFrame < animationLayers.length - 1) {
            showFrame(currentFrame + 1);
        } else {
            isPlaying = false;
            clearInterval(animationTimer);
        }
    }

    function toggleAnimation() {
        if (!selectedLat || !selectedLon) { alert("Valitse ensin voimala."); return; }
        if (animationLayers.length === 0) {
            // Clear any static simulation result before generating animation
            plumeLayers.forEach(layer => map.removeLayer(layer));
            plumeLayers = [];
            generateAnimationLayers(selectedLat, selectedLon);
        }
        if (isPlaying) {
            clearInterval(animationTimer);
            isPlaying = false;
        } else {
            isPlaying = true;
            animationTimer = setInterval(playStep, animationDelay);
        }
    }

    function resetAnimation() {
        clearInterval(animationTimer);
        isPlaying = false;
        showFrame(0);
    }

    function jumpToEnd() {
        clearInterval(animationTimer);
        isPlaying = false;
        showFrame(animationLayers.length - 1);
    }

    function seekAnimation(value) {
        clearInterval(animationTimer);
        isPlaying = false;
        showFrame(parseInt(value));
    }

    // Make seekAnimation global so oninput in HTML can reach it
    window.seekAnimation = seekAnimation;

    // Update INES dropdown options based on reactor type
    function updateInesOptions() {
        const reactorType = document.getElementById("reactorType").value;
        const maxInes = { "mmr": 5, "smr": 6, "medium": 7, "large": 7, "custom": 7 };
        const limit = maxInes[reactorType] || 7;
        const inesSelect = document.getElementById("ines");
        Array.from(inesSelect.options).forEach(opt => {
            opt.disabled = parseInt(opt.value) > limit;
        });
        // If currently selected value exceeds limit, reset to limit
        if (parseInt(inesSelect.value) > limit) {
            inesSelect.value = String(limit);
        }
    }
    window.updateInesOptions = updateInesOptions;

    function clearAnimation() {
        animationLayers.forEach(layer => map.removeLayer(layer));
        animationLayers = [];
        currentFrame = 0;
        isPlaying = false;
        clearInterval(animationTimer);
        hideDayDisplay();
        const slider = document.getElementById("animationSlider");
        const status = document.getElementById("animationStatus");
        if (slider) slider.value = 0;
        if (status) status.textContent = "0 / 0 h";
    }


    // -----------------------------------------------------------------------
    // Weather fetch
    // -----------------------------------------------------------------------
    function fetchWeather() {
        const spinner = document.getElementById("loadingSpinner");
        spinner.style.display = "block";

        if (selectedLat == null || selectedLon == null) {
            alert("Valitse ensin voimala ennen säätietojen hakua!");
            document.getElementById("useWeatherBasedValues").checked = false;
            spinner.style.display = "none";
            return;
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLat}&longitude=${selectedLon}&current=wind_speed_10m,wind_direction_10m,cloud_cover,is_day,rain&wind_speed_unit=ms`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                spinner.style.display = "none";
                if (data && data.current) {
                    const weather = data.current;
                    document.getElementById("windDirection").value = weather.wind_direction_10m;
                    document.getElementById("windSpeed").value = weather.wind_speed_10m;

                    const clouds = weather.cloud_cover;
                    const speed  = weather.wind_speed_10m;
                    const isDay  = weather.is_day;
                    let pasquill = "D";

                    if (isDay) {
                        if (clouds < 25) {
                            if (speed < 2) pasquill = "A";
                            else if (speed < 3) pasquill = "B";
                            else if (speed < 5) pasquill = "C";
                            else pasquill = "D";
                        } else if (clouds < 75) {
                            if (speed < 3) pasquill = "B";
                            else if (speed < 5) pasquill = "C";
                            else pasquill = "D";
                        } else {
                            pasquill = "D";
                        }
                    } else {
                        if (clouds < 25)      pasquill = speed < 3 ? "F" : "E";
                        else if (clouds < 75) pasquill = speed < 3 ? "E" : "D";
                        else                  pasquill = "D";
                    }

                    document.getElementById("stabilityClass").value = pasquill;
                    document.getElementById("stackHeight").value = 100;
                }
            })
            .catch(err => {
                console.error("Virhe säätiedoissa:", err);
                alert("Säätietoja ei voitu hakea");
                document.getElementById("useWeatherBasedValues").checked = false;
                spinner.style.display = "none";
            });
    }


    // -----------------------------------------------------------------------
    // Custom location (double-click)
    // -----------------------------------------------------------------------
    function enableMapDoubleClick() {
        if (isCustomActive) return;
        isCustomActive = true;
        map.on("dblclick", handleCustomLocation);
    }

    function disableMapDoubleClick() {
        isCustomActive = false;
        map.off("dblclick", handleCustomLocation);
    }

    function handleCustomLocation(e) {
        const { lat, lng } = e.latlng;
        if (customMarker) {
            customMarker.setLatLng([lat, lng]);
        } else {
            customMarker = L.marker([lat, lng]).addTo(map);
        }
        selectedLat = lat;
        selectedLon = lng;
        map.setView([lat, lng], 7);

        // Update reactor type selector visibility
        document.getElementById("reactorTypeRow").style.display = "block";
        updateInesOptions();
        alert(`Vapaavalintainen paikka asetettu: ${lat.toFixed(4)}, ${lng.toFixed(4)}.\nValitse reaktorityyppi ja suorita mallinnus.`);
    }

});
