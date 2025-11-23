
// --- Plant Info Data ---
const plantInfo = {
    Ahwagandha: {
        name: "Ashwagandha",
        info: "Ashwagandha is an ancient medicinal herb. It's classified as an adaptogen, meaning it can help your body manage stress."
    },
    Cardamom: {
        name: "Cardamom",
        info: "Cardamom is known for its strong aroma and is commonly used in traditional medicine for digestive issues and oral health."
    },
    Cinnamon: {
        name: "Cinnamon",
        info: "Cinnamon is loaded with antioxidants and has anti-inflammatory properties. It can help regulate blood sugar levels."
    },
    clove: {
        name: "Clove",
        info: "Cloves contain powerful antioxidants and have antibacterial properties. They're traditionally used for dental pain and digestive issues."
    },
    tulsi: {
        name: "Tulsi (Holy Basil)",
        info: "Tulsi is considered a sacred plant in Ayurveda. It has adaptogenic properties and helps combat stress and boost immunity."
    },
    Turmeric: {
        name: "Turmeric",
        info: "Turmeric contains curcumin, a powerful anti-inflammatory compound. It's known for its antioxidant properties and potential health benefits."
    }
};

// --- UI and AR Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Only select the first plantSelector (avoid duplicate IDs)
    const plantSelector = document.querySelectorAll('#plantSelector')[0];
    const debugMsg = document.getElementById('debug-message');
    const infoCard = document.getElementById('plantInfo');
    const canvas = document.getElementById('xr-canvas');
    const statusIcon = document.getElementById('status-icon');

    let selectedPlant = null;
    let placedModel = null;
    let gltfLoader = null;

    // --- Debug Messaging & Status Icon ---
    function showDebug(msg) {
        if (debugMsg) {
            debugMsg.textContent = msg;
            console.log(msg);
        }
    }
    function setStatusIcon(state) {
        if (!statusIcon) return;
        if (state === 'yes') {
            statusIcon.textContent = '✔';
            statusIcon.classList.remove('status-no', 'status-unknown');
            statusIcon.classList.add('status-yes');
        } else if (state === 'no') {
            statusIcon.textContent = '✖';
            statusIcon.classList.remove('status-yes', 'status-unknown');
            statusIcon.classList.add('status-no');
        } else {
            statusIcon.textContent = '?';
            statusIcon.classList.remove('status-yes', 'status-no');
            statusIcon.classList.add('status-unknown');
        }
    }

    // --- Plant Info Card ---
    function updatePlantInfo(plantKey) {
        if (infoCard && plantInfo[plantKey]) {
            infoCard.innerHTML = `
                <h2>${plantInfo[plantKey].name}</h2>
                <p>${plantInfo[plantKey].info}</p>
            `;
            infoCard.style.display = 'block';
        } else if (infoCard) {
            infoCard.style.display = 'none';
        }
    }

    // --- Plant Selection ---
    plantSelector.addEventListener('change', (e) => {
        selectedPlant = e.target.value;
        updatePlantInfo(selectedPlant);
        showDebug(selectedPlant ? `Selected: ${selectedPlant}` : 'No plant selected');
    });

    // --- Three.js and WebXR AR Setup ---
    let renderer, scene, camera, xrRefSpace, xrHitTestSource;

    function initThree() {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(1, 2, 3);
        scene.add(directional);

        // GLTF Loader
        gltfLoader = new THREE.GLTFLoader();
    }

    // --- Load Plant Model ---
    function loadPlantModel(plantKey, callback) {
        if (!plantKey) return;
        const modelPath = `models/${plantKey}.glb`;
        gltfLoader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            callback(model);
        }, undefined, (err) => {
            showDebug(`ERROR: Failed to load model for '${plantKey}'.`);
            callback(null);
        });
    }

    // --- WebXR AR Session ---
    async function startAR() {
        if (!navigator.xr) {
            showDebug('WebXR not supported on this device/browser.');
            return;
        }
        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'local-floor']
            });
            renderer.xr.setSession(session);

            xrRefSpace = await session.requestReferenceSpace('local-floor');
            const viewerSpace = await session.requestReferenceSpace('viewer');
            xrHitTestSource = await session.requestHitTestSource({ space: viewerSpace });

            showDebug('AR session started. Tap to place plant.');

            session.addEventListener('select', (event) => {
                // Place model at hit test location
                if (!selectedPlant) {
                    showDebug('Select a plant first.');
                    return;
                }
                if (!lastHitMatrix) {
                    showDebug('No surface detected.');
                    return;
                }
                // Remove previous model
                if (placedModel) {
                    scene.remove(placedModel);
                    placedModel = null;
                }
                loadPlantModel(selectedPlant, (model) => {
                    if (model) {
                        model.matrixAutoUpdate = false;
                        model.matrix.fromArray(lastHitMatrix);
                        scene.add(model);
                        placedModel = model;
                        showDebug(`Placed ${selectedPlant} on surface.`);
                    } else {
                        showDebug('Failed to load model.');
                    }
                });
            });

            renderer.setAnimationLoop(renderXR);
        } catch (err) {
            showDebug('Failed to start AR session.');
        }
    }

    let lastHitMatrix = null;
    let surfaceDetected = false;
    function renderXR(timestamp, frame) {
        if (frame) {
            const hitTestResults = frame.getHitTestResults(xrHitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(xrRefSpace);
                if (pose) {
                    lastHitMatrix = pose.transform.matrix;
                    if (!surfaceDetected) {
                        showDebug('Flat surface detected! Tap to place your plant.');
                        setStatusIcon('yes');
                        surfaceDetected = true;
                    }
                }
            } else {
                lastHitMatrix = null;
                if (surfaceDetected) {
                    showDebug('No flat surface detected. Move your device to find one.');
                    setStatusIcon('no');
                    surfaceDetected = false;
                }
            }
        }
        renderer.render(scene, camera);
    }

    // Set initial status icon
    setStatusIcon('unknown');

    // --- Start AR on user gesture ---
    canvas.addEventListener('click', () => {
        if (!renderer || !renderer.xr.isPresenting) {
            startAR();
        }
    });

    // --- Init ---
    initThree();
    showDebug('Tap the screen to start AR.');
});
