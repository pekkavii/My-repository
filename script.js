let selectedLat;
let selectedLon;
let customMarker = null;

document.addEventListener("DOMContentLoaded", function () {
    // Määrittele kartta ensin!
    const map = L.map('map').setView([60.3714, 26.3469], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Nyt turvallista määritellä nämä
    let select = document.getElementById("powerPlantSelection");
    let marker;
    let plumeLayers = [];
    let isCustomActive = false;
    // Turhien animaatioiden laskennan minimointi
    let animationLayersGenerated = false;
    let paramsChanged = false;

    fetch('power_plants.json')
        .then(response => response.json())
        .then(data => {
            // Group plants by country
            const byCountry = {};
            data.forEach(plant => {
                if (!byCountry[plant.country]) byCountry[plant.country] = [];
                byCountry[plant.country].push(plant);
            });

            // Sort countries alphabetically, add grouped options
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
       
    select.addEventListener("change", function () {
    let selectedOption = select.options[select.selectedIndex];
    clearAnimation();
     
    if (!selectedOption.value) {
        selectedLat = undefined;
        selectedLon = undefined;
        if (marker) map.removeLayer(marker);
        plumeLayers.forEach(layer => map.removeLayer(layer));
        plumeLayers = [];
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
    disableMapDoubleClick(); // Estä kuuntelija, jos valinta ei ole "custom"
}


    // Normaalien voimaloiden käsittely
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

    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`
            <b>${plant.name}</b><br>
            <b>Maa:</b> ${plant.country}<br>
            <b>Reaktori:</b> ${plant.reactor_type}<br>
            <b>Sähköteho:</b> ${plant.electrical_power_MW} MW
        `).openPopup();

    map.setView([lat, lon], 7);
    selectedLat = lat;
    selectedLon = lon;

    if (document.getElementById("useWeatherBasedValues").checked) {
        fetchWeather();
    }
});
  
            
        })
        .catch(error => console.error("Voimaloiden lataaminen epäonnistui:", error));

// Event listenerit DOM:n latauduttua

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

        console.log("Checkbox klikattu");
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
        simulateGaussian(selectedLat, selectedLon);
    });

    
document.getElementById("resetAnimationButton").addEventListener("click", resetAnimation);
document.getElementById("toggleAnimationButton").addEventListener("click", toggleAnimation);
document.getElementById("jumpToEndButton").addEventListener("click", jumpToEnd);

    

 



function simulateEllipse(lat, lon) {

    let ines = parseInt(document.getElementById("ines").value);

    console.log("INES-arvo:", ines);
    if (isNaN(ines) || ines < 3 || ines > 7) {
        console.error("Virheellinen INES-arvo:", ines);
        return;
    }
    if (isNaN(lat) || isNaN(lon)) {
        console.error("Virhe: lat tai lon on NaN!", lat, lon);
        return;
    }
    
let windDirection = parseFloat(document.getElementById("windDirection").value);
if (!isNaN(windDirection)) {
    windDirection = (windDirection + 180) % 360; // Käännetään suunta
}
if (isNaN(windDirection)) {
    windDirection = 90; // Oletusarvo
}

let windSpeed = parseFloat(document.getElementById("windSpeed").value);
if (isNaN(windSpeed)) {
    windSpeed = 5; // Oletusarvo
}


    // Lasketaan ellipsin koko (metreinä)
    let baseSize = (ines - 3) * 30 * 1000;
    
    let scaleFactors = [1, 0.5, 0.25];
    let colors = ['green', 'orange', 'red'];

    // Poistetaan vanhat pilvet
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    scaleFactors.forEach((scale, index) => {
        let semiMajor = baseSize * scale;

let semiMinor = semiMajor / (1 + windSpeed / 5);
if (semiMinor < 100) {  // Vähintään 100m pienempi akseli
    semiMinor = 100;
}


        
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
    let steps = 36;
    let angleStep = (2 * Math.PI) / steps;
    
    let rotationRad = rotation * (Math.PI / 180);

    for (let i = 0; i < steps; i++) {
        let angle = i * angleStep;
        let x = semiMajor * Math.cos(angle);
        let y = semiMinor * Math.sin(angle);

        let rotatedX = x * Math.cos(rotationRad) + y * Math.sin(rotationRad);
        let rotatedY = -x * Math.sin(rotationRad) + y * Math.cos(rotationRad);

        let pointLat = lat + (rotatedY / 111);
        let pointLon = lon + (rotatedX / (111 * Math.cos(lat * Math.PI / 180)));

        points.push([pointLat, pointLon]);
    }

    points.push(points[0]); // Sulje polygoni

    return L.polygon(points, {
        color: color,
        fillColor: color,
        fillOpacity: 0.4
    }).addTo(map);
}

    

function simulateGaussian(lat, lon) {

    // INES-luokan mukainen päästö (TBq -> Bq)
    let ines = parseInt(document.getElementById("ines").value);

    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    // --- INES 3: only a site-area effect, no environmental release ---
    if (ines === 3) {
        const circle = L.circle([lat, lon], {
            radius: 1000,
            color: "yellow",
            weight: 2,
            fillColor: "yellow",
            fillOpacity: 0.4
        }).addTo(map);
        circle.bindPopup("INES 3 – Vakava poikkeama:<br>Vaikutukset rajoittuvat laitosalueelle.<br>Ympäristöön ei tapahdu merkittävää radioaktiivista päästöä.");
        plumeLayers.push(circle);
        return;
    }

    // --- INES 4: limited local release, protective zone only ---
    if (ines === 4) {
        const circle = L.circle([lat, lon], {
            radius: 5000,
            color: "orange",
            weight: 2,
            fillColor: "orange",
            fillOpacity: 0.3
        }).addTo(map);
        circle.bindPopup("INES 4 – Onnettomuus:<br>Vaikutukset rajoittuvat suojavyöhykkeelle (n. 5 km).<br>Merkittävää ympäristöpäästöä ei odoteta.");
        plumeLayers.push(circle);
        return;
    }

    // --- INES 5-7: full Gaussian plume with confidence cone ---
    let Q_TBq = Math.pow(10, ines - 4) * 10;
    let Q_tot = Q_TBq * 5 * 1e12; // Bq
    let Q = Q_tot / 7 / 24 / 3600; // Bq/s viikon ajan

    const windSpeed = parseFloat(document.getElementById("windSpeed").value) || 5;
    const windDirection = (parseFloat(document.getElementById("windDirection").value));
    const H = parseFloat(document.getElementById("stackHeight").value) || 100;
    const stability = document.getElementById("stabilityClass").value || "D";

    const breathingRate = 1.2 / 3600;
    const doseConversionFactor = 2.2e-8;

    const numOffsets = 15;
    const spreadFactor = 4;

    // --- Determine max range: furthest x where centreline dose >= 10 mSv ---
    // Pre-scan the centreline to find the plume extent before drawing anything.
    const mixingHeight = (stability === "A" || stability === "B") ? 1500
                       : stability === "C" ? 1200
                       : stability === "D" ? 800
                       : 500;
    let maxRangeKm = 10; // minimum fallback
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
        const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) *
                  Math.exp(-Math.pow((1.5 + H) / σz, 2) / 2); // centreline y=0
        const dose = C * breathingRate * doseConversionFactor * 3600 * 24 * 7;
        if (dose >= 0.01) maxRangeKm = x / 1000; // keep updating to furthest point >= 10 mSv
    }
    maxRangeKm = Math.min(maxRangeKm, 500); // hard cap at 500 km

    // --- Confidence cone background wedge ---
    // Fills the entire ±30° fan so there are no empty gaps that could be
    // misread as "safe" areas. The wedge is drawn before the dose circles
    // so dose colours always appear on top.
    (function drawConeBackground() {
        const coneHalfAngle = 30; // degrees
        const coneSteps = 30;     // polygon smoothness
        // maxRangeKm is pre-calculated above based on 10 mSv dose threshold

        // Find the furthest x where any dose circle was drawn — approximate
        // by using maxRange directly. We draw the wedge to max range.
        const wedgePoints = [[lat, lon]]; // tip at source

        for (let s = 0; s <= coneSteps; s++) {
            const angleDeg = windDirection - coneHalfAngle + (s / coneSteps) * (2 * coneHalfAngle);
            const adjustedDir = (270 - angleDeg + 360) % 360;
            const rad = adjustedDir * Math.PI / 180;
            const dx = maxRangeKm * Math.cos(rad);
            const dy = maxRangeKm * Math.sin(rad);
            const pLat = lat + (dy / 111);
            const pLon = lon + (dx / (111 * Math.cos(lat * Math.PI / 180)));
            wedgePoints.push([pLat, pLon]);
        }
        wedgePoints.push([lat, lon]); // close back to tip

        const wedge = L.polygon(wedgePoints, {
            color: "gray",
            weight: 1,
            opacity: 0.4,
            fillColor: "yellow",
            fillOpacity: 0.07  // very subtle — just enough to fill gaps
        }).addTo(map);
        wedge.bindPopup("Epävarmuuskartion alue (±30°):<br>Tuuli voi suuntautua tälle alueelle.<br>Säteilyannos riippuu todellisesta tuulen suunnasta.");
        plumeLayers.push(wedge);
    })();

    // Confidence cone: render centreline + ±15° and ±30° offset plumes.
    // Opacity decreases with angular offset to visualise wind direction uncertainty.
    // ±15°: probability ~60% of actual centreline being within this range
    // ±30°: probability ~90% — outer boundary of realistic uncertainty
    const coneOffsets = [
        { angleDeg:   0, opacity: 0.35 },  // centreline — full opacity
        { angleDeg:  15, opacity: 0.20 },  // ±15° inner cone
        { angleDeg: -15, opacity: 0.20 },
        { angleDeg:  30, opacity: 0.08 },  // ±30° outer cone
        { angleDeg: -30, opacity: 0.08 },
    ];

    // mixingHeight already declared above in the pre-scan block

    coneOffsets.forEach(({ angleDeg, opacity }) => {

        const offsetDirection = windDirection + angleDeg;
        const adjustedDirection = (270 - offsetDirection + 360) % 360;
        const rad = adjustedDirection * Math.PI / 180;

        for (let x = 500; x <= maxRangeKm * 1000; x += 1000) {

            let σy, σz;
            switch (stability) {
                case "A":
                    σy = 0.22 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.20 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    break;
                case "B":
                    σy = 0.16 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.12 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    break;
                case "C":
                    σy = 0.11 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.08 * x * Math.pow(1 + 0.0015 * x, -0.5);
                    break;
                case "D":
                    σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
                    break;
                case "E":
                    σy = 0.06 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.03 * x * Math.pow(1 + 0.0015 * x, -0.5);
                    break;
                case "F":
                    σy = 0.04 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.016 * x * Math.pow(1 + 0.0015 * x, -0.5);
                    break;
                default:
                    σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5);
                    σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
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

                const dx = (x / 1000) * Math.cos(rad) - (y / 1000) * Math.sin(rad);
                const dy = (x / 1000) * Math.sin(rad) + (y / 1000) * Math.cos(rad);

                const pointLat = lat + (dy / 111);
                const pointLon = lon + (dx / (111 * Math.cos(lat * Math.PI / 180)));

                let color = "green";
                if (doseRate_Sv_per_week > 1)    color = "black";
                else if (doseRate_Sv_per_week > 0.1)  color = "red";
                else if (doseRate_Sv_per_week > 0.01) color = "orange";
                // else: 1-10 mSv -> green

                const circle = L.circle([pointLat, pointLon], {
                    radius: 500,
                    fillColor: color,
                    color: color,
                    weight: 0,
                    fillOpacity: opacity
                }).addTo(map);

                // Only attach popup to centreline points to avoid clutter
                if (angleDeg === 0) {
                    circle.bindPopup(
                        `Etäisyys: ${(x/1000).toFixed(1)} km<br>
                        Poikkeama: ${Math.round(y)} m<br>
                        Pitoisuus: ${C.toExponential(2)} Bq/m³<br>
                        Annos viikossa: ${(doseRate_Sv_per_week * 1e3).toFixed(2)} mSv`
                    );
                }

                plumeLayers.push(circle);
            }
        }
    });
}


let animationLayers = [];
let animationTimer = null;
let currentFrame = 0;
const maxFrames = 168; // 168 tuntia = 1 viikko
const animationDelay = 500; // millisekunteina per ruutu

function generateAnimationLayers(lat, lon) {

   if (!lat || !lon) {
        alert("Valitse ensin voimala tai paikka kartalta.");
        return;
    }
    // Poista aiemmat simulaatiopiirrokset
    plumeLayers.forEach(layer => map.removeLayer(layer));
    plumeLayers = [];

    animationLayers.forEach(layer => map.removeLayer(layer));
    animationLayers = [];

    // Perustiedot
    // FIX 3: Q_tot now uses the same * 5 factor as simulateGaussian
    let ines = parseInt(document.getElementById("ines").value);
    let Q_TBq = Math.pow(10, ines - 4) * 10;
    let Q_tot = Q_TBq * 5 * 1e12; // Bq — matches simulateGaussian
    let Q = Q_tot / 7 / 24 / 3600; // Bq/s viikon ajan

    const windSpeed = parseFloat(document.getElementById("windSpeed").value) || 5;
    const windDirection = (parseFloat(document.getElementById("windDirection").value));
    const H = parseFloat(document.getElementById("stackHeight").value) || 100;
    const stability = document.getElementById("stabilityClass").value || "D";

    const breathingRate = 1.2 / 3600;
    const doseConversionFactor = 2.2e-8;

    const numOffsets = 15;
    const spreadFactor = 4;
    const adjustedDirection = (270 - windDirection + 360) % 360;
    const rad = adjustedDirection * Math.PI / 180;

    for (let hour = 1; hour <= maxFrames; hour++) {
        const frameGroup = L.layerGroup();

        for (let x = 500; x <= 500000; x += 2000) {
            let σy, σz;
            const mixingHeight = (stability === "A" || stability === "B") ? 1500
                               : stability === "C" ? 1200
                               : stability === "D" ? 800
                               : 500; // E, F
            switch (stability) {
                case "A": σy = 0.22 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.20 * x * Math.pow(1 + 0.0001 * x, -0.5); break;
                case "B": σy = 0.16 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.12 * x * Math.pow(1 + 0.0001 * x, -0.5); break;
                case "C": σy = 0.11 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.08 * x * Math.pow(1 + 0.0015 * x, -0.5); break;
                case "D": σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5); break;
                case "E": σy = 0.06 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.03 * x * Math.pow(1 + 0.0015 * x, -0.5); break;
                case "F": σy = 0.04 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.016 * x * Math.pow(1 + 0.0015 * x, -0.5); break;
                default:  σy = 0.08 * x * Math.pow(1 + 0.0001 * x, -0.5); σz = 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5);
            }
            σz = Math.min(σz, mixingHeight); // cap at mixing layer height

            for (let i = -(Math.floor(numOffsets/2)); i <= Math.floor(numOffsets/2); i++) {
                const y = i * σy * spreadFactor / (numOffsets / 2);
                const z = 1.5;
                const exp1 = Math.exp(-Math.pow(y / σy, 2) / 2);
                const exp2 = Math.exp(-Math.pow((z - H) / σz, 2) / 2);
                const exp3 = Math.exp(-Math.pow((z + H) / σz, 2) / 2);
                const C = (Q / (2 * Math.PI * windSpeed * σy * σz)) * exp1 * (exp2 + exp3);

                const dose = C * breathingRate * doseConversionFactor * 3600 * hour; // kumuloitu tähän tuntiin

                if (dose * 1000 < 1) continue;

                const dx = (x / 1000) * Math.cos(rad) - (y / 1000) * Math.sin(rad);
                const dy = (x / 1000) * Math.sin(rad) + (y / 1000) * Math.cos(rad);
                const pointLat = lat + (dy / 111);
                const pointLon = lon + (dx / (111 * Math.cos(lat * Math.PI / 180)));

                let color = dose > 1 ? "black" : dose > 0.1 ? "red" : dose > 0.01 ? "orange" : "green";

                const circle = L.circle([pointLat, pointLon], {
                    radius: 400,
                    fillColor: color,
                    color: color,
                    weight: 0,
                    fillOpacity: 0.4
                });

                frameGroup.addLayer(circle);
            }
        }

        animationLayers.push(frameGroup);
    }


}
    
function playAnimation() {
    if (!selectedLat || !selectedLon) {
        alert("Valitse ensin voimala.");
        return;
    }

    // Always regenerate layers so they reflect current parameters
    generateAnimationLayers(selectedLat, selectedLon);

    if (animationTimer) clearInterval(animationTimer);
    currentFrame = 0;

    // Show every frame including the last one, keep last frame visible
    animationTimer = setInterval(() => {
        if (currentFrame >= animationLayers.length) {
            clearInterval(animationTimer);
            return;
        }
        if (currentFrame > 0) {
            map.removeLayer(animationLayers[currentFrame - 1]);
        }
        map.addLayer(animationLayers[currentFrame]);
        updateAnimationUI(); // show before increment so display is 1-based (frame+1 below)
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
    }
    currentFrame = frame;
    updateAnimationUI();
}

// FIX 2: Stop BEFORE going out of bounds so the last frame stays visible
function playStep() {
    if (!isPlaying) return;
    if (currentFrame < animationLayers.length - 1) {
        showFrame(currentFrame + 1);
    } else {
        // Already on last frame — stop, leave it visible
        isPlaying = false;
        clearInterval(animationTimer);
    }
}

function toggleAnimation() {
    if (!selectedLat || !selectedLon) {
        alert("Valitse ensin voimala.");
        return;
    }

    // If no layers yet, generate them first
    if (animationLayers.length === 0) {
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


function fetchWeather() {

    const spinner = document.getElementById("loadingSpinner");
    spinner.style.display = "block"; // Näytä spinneri

    if (selectedLat == null || selectedLon == null) {
        alert("Valitse ensin voimala ennen säätietojen hakua!");
        document.getElementById("useCurrentWeather").checked = false;
        spinner.style.display = "none"; // Piilota spinneri
        return;
    }
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLat}&longitude=${selectedLon}&current=wind_speed_10m,wind_direction_10m,cloud_cover,is_day,rain&wind_speed_unit=ms`;
    console.log("URL!", url);
    fetch(url)
            .then(res => res.json())
            .then(data => {
                console.log("Haettu säädata:", data);
                spinner.style.display = "none"; // Piilota spinneri
                
                if (data && data.current) {
                    const weather = data.current;
                    console.log("Haetaan säädatoja openmeteosta");
                    document.getElementById("windDirection").value = weather.wind_direction_10m;
                    document.getElementById("windSpeed").value = weather.wind_speed_10m;

                    const clouds = weather.cloud_cover;
                    const speed = weather.wind_speed_10m;
                    const isDay = weather.is_day; // 1 = day, 0 = night
                    let pasquill = "D"; // default neutral

                    if (isDay) {
                        // Daytime: driven by solar heating vs wind
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
                            pasquill = "D"; // overcast day -> neutral
                        }
                    } else {
                        // Nighttime: driven by cloud cover (radiative cooling)
                        if (clouds < 25) {
                            pasquill = speed < 3 ? "F" : "E";
                        } else if (clouds < 75) {
                            pasquill = speed < 3 ? "E" : "D";
                        } else {
                            pasquill = "D"; // overcast night -> neutral
                        }
                    }
                      
                    document.getElementById("stabilityClass").value = pasquill;
                    document.getElementById("stackHeight").value = 100;
                }
            })
            .catch(err => {
                console.error("Virhe säätiedoissa:", err);
                alert("Säätietoja ei voitu hakea");
                document.getElementById("useWeatherBasedValues").checked = false;
                spinner.style.display = "none"; // Piilota spinneri
            });
    }

function enableMapDoubleClick() {
    if (isCustomActive) return; // Estetään tuplakuuntelijat

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
    alert(`Voimalan paikka asetettu: ${lat.toFixed(4)}, ${lng.toFixed(4)}.\nVoit nyt suorittaa mallinnuksen.`);
}

function clearAnimation() {
    animationLayers.forEach(layer => map.removeLayer(layer));
    animationLayers = [];
    currentFrame = 0;
    isPlaying = false;
    clearInterval(animationTimer);

    const slider = document.getElementById("animationSlider");
    const status = document.getElementById("animationStatus");

    if (slider) slider.value = 0;
    if (status) status.textContent = "0 / 0 h";
}


    
});
