document.addEventListener('DOMContentLoaded', () => {
    const apiKey = 'yoksxCkgnVyw76BK6gJ1ZGfZSi6ciZhP';
    const serviceUrl = 'https://api.os.uk/maps/vector/v1/vts';
    const placesUrl = 'https://api.os.uk/search/places/v1/postcode';

    // Setup the EPSG:27700 (British National Grid) projection.
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +datum=OSGB36 +units=m +no_defs");
    ol.proj.proj4.register(proj4);

    (async () => {
        const service = await fetch(serviceUrl + '?key=' + apiKey).then(response => response.json());
        const extent = [service.fullExtent.xmin, service.fullExtent.ymin, service.fullExtent.xmax, service.fullExtent.ymax];
        const origin = [service.tileInfo.origin.x, service.tileInfo.origin.y];
        const resolutions = service.tileInfo.lods.map(l => l.resolution).slice(0, 16);
        const tileSize = service.tileInfo.rows;
        const tiles = service.tiles[0];

        const tileGrid = new ol.tilegrid.TileGrid({
            extent,
            origin,
            resolutions,
            tileSize
        });

        const vectorTileLayer = new ol.layer.VectorTile({
            declutter: true
        });

        olms.applyStyle(
            vectorTileLayer,
            serviceUrl + '/' + service.defaultStyles + '?key=' + apiKey,
            '',
            { resolutions: tileGrid.getResolutions() }
        ).then(() => {
            vectorTileLayer.setSource(
                new ol.source.VectorTile({
                    format: new ol.format.MVT(),
                    url: tiles,
                    projection: 'EPSG:27700',
                    tileGrid: tileGrid
                })
            );
        });

        const map = new ol.Map({
            target: "map",
            layers: [vectorTileLayer],
            view: new ol.View({
                projection: 'EPSG:27700',
                extent: extent,
                resolutions: [...tileGrid.getResolutions(), ...Array(8).fill().map((_, i) => tileGrid.getResolutions()[15] / Math.pow(2, i + 1))],
                minZoom: 2,
                maxZoom: 23,
                center: [263804, 844010],
                zoom: 2
            }),
            interactions: ol.interaction.defaults.defaults({
                altShiftDragRotate: false,
                pinchRotate: false,
                doubleClickZoom: true,
                dragPan: true,
                mouseWheelZoom: true,
                shiftDragZoom: true
            })
        });

        // Add scale bar
        const scaleLineControl = new ol.control.ScaleLine({
            units: 'metric',
            bar: 'True'
        });
        map.addControl(scaleLineControl);

        const drawSource = new ol.source.Vector({ wrapX: false });
        const drawLayer = new ol.layer.Vector({
            source: drawSource
        });
        map.addLayer(drawLayer);

        const draw = new ol.interaction.Draw({
            source: drawSource,
            type: 'Polygon',
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'black',
                    width: 2,
                }),
                image: new ol.style.Circle({
                    radius: 4,
                    fill: new ol.style.Fill({
                        color: 'black',
                    }),
                }),
            }),
        });

        const modify = new ol.interaction.Modify({ source: drawSource });
        map.addInteraction(modify);

        // Function to create a tooltip overlay
        function createTooltip(coordinate, text, className = 'ol-tooltip ol-tooltip-measure') {
            const tooltipElement = document.createElement('div');
            tooltipElement.className = className;
            tooltipElement.innerHTML = text;
            const tooltip = new ol.Overlay({
                element: tooltipElement,
                offset: [0, -10], // Adjust the offset to move closer to the point
                positioning: 'bottom-center',
                stopEvent: false,
                insertFirst: false,
            });
            tooltip.setPosition(coordinate);
            map.addOverlay(tooltip);
        }

        // Function to add labels to the map
        function addLabelsToMap(coordinates) {
            coordinates.forEach((coord, index) => {
                const pointLabel = `${String.fromCharCode(65 + index)}`;
                createTooltip(coord, pointLabel, 'ol-tooltip ol-tooltip-static');
            });

            for (let i = 0; i < coordinates.length; i++) {
                const start = coordinates[i];
                const end = coordinates[(i + 1) % coordinates.length];
                const midPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
                const distance = calculateDistance(start[0], start[1], end[0], end[1]);
                createTooltip(midPoint, `${distance.toFixed(1)} m`);
            }
        }

        // Function to update the table with distances
        function updateTable(coordinates) {
            let tableHtml = '<table class="table"><tr><th>Segment</th><th>Distance (m)</th></tr>';
            coordinates.forEach((coord, index) => {
                const startLabel = String.fromCharCode(65 + index);
                const endLabel = String.fromCharCode(65 + (index + 1) % coordinates.length);
                const distance = calculateDistance(coord[0], coord[1], coordinates[(index + 1) % coordinates.length][0], coordinates[(index + 1) % coordinates.length][1]);
                tableHtml += `<tr><td>${startLabel} to ${endLabel}</td><td>${distance.toFixed(1)}</td></tr>`;
            });
            tableHtml += '</table>';
            document.getElementById('tableContainer').innerHTML = tableHtml;
        }

        draw.on('drawstart', (event) => {
            event.feature.getGeometry().on('change', (evt) => {
                const geom = evt.target;
                const coordinates = geom.getCoordinates()[0];
                document.querySelectorAll('.ol-tooltip-drawing').forEach(tooltip => tooltip.remove());
                for (let i = 0; i < coordinates.length - 1; i++) {
                    const start = coordinates[i];
                    const end = coordinates[i + 1];
                    const midPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
                    const distance = calculateDistance(start[0], start[1], end[0], end[1]);
                    createTooltip(midPoint, `${distance.toFixed(1)} m`, 'ol-tooltip ol-tooltip-drawing');
                }
            });
        });

        draw.on('drawend', (event) => {
            const coordinates = event.feature.getGeometry().getCoordinates()[0];
            const uniqueCoordinates = coordinates.slice(0, -1); // Remove the duplicate first point at the end
            addLabelsToMap(uniqueCoordinates);
            updateTable(uniqueCoordinates);

            // End drawing mode automatically
            map.removeInteraction(draw);
            document.getElementById('toggleDraw').textContent = 'Start Drawing';
        });

        modify.on('modifyend', () => {
            const features = drawSource.getFeatures();
            if (features.length > 0) {
                const coordinates = features[0].getGeometry().getCoordinates()[0];
                const uniqueCoordinates = coordinates.slice(0, -1); // Remove the duplicate first point at the end
                document.querySelectorAll('.ol-tooltip').forEach(tooltip => tooltip.remove()); // Clear existing labels
                addLabelsToMap(uniqueCoordinates);
                updateTable(uniqueCoordinates);
            }
        });

        document.getElementById('toggleDraw').addEventListener('click', () => {
            if (map.getInteractions().getArray().includes(draw)) {
                map.removeInteraction(draw);
                document.getElementById('toggleDraw').textContent = 'Start Drawing';
            } else {
                map.addInteraction(draw);
                document.getElementById('toggleDraw').textContent = 'Stop Drawing';
            }
        });

        document.getElementById('clearDrawings').addEventListener('click', () => {
            drawSource.clear();
            document.querySelectorAll('.ol-tooltip').forEach(tooltip => tooltip.remove());
            document.getElementById('tableContainer').innerHTML = '';
        });

        document.getElementById('searchButton').addEventListener('click', async () => {
            const postcode = document.getElementById('postcode').value;
            if (!postcode) return;

            try {
                const response = await fetch(`${placesUrl}?key=${apiKey}&postcode=${postcode}`);
                const data = await response.json();
                const resultSelect = document.getElementById('resultSelect');
                resultSelect.innerHTML = ''; // Clear previous options

                if (data.results && data.results.length > 0) {
                    data.results.forEach((result, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = `${result.DPA.ADDRESS}`;
                        resultSelect.appendChild(option);
                    });
                    resultSelect.style.display = 'block';
                    resultSelect.addEventListener('change', () => {
                        const selectedIndex = resultSelect.value;
                        const location = data.results[selectedIndex].DPA;
                        const eastings = parseFloat(location.X_COORDINATE);
                        const northings = parseFloat(location.Y_COORDINATE);
                        const coords = [eastings, northings];
                        const transformedCoords = ol.proj.transform(coords, 'EPSG:27700', 'EPSG:27700');
                        map.getView().setCenter(transformedCoords);
                        map.getView().setZoom(15);
                    });
                } else {
                    alert('Postcode not found');
                }
            } catch (error) {
                console.error('Error fetching postcode:', error);
            }
        });

        document.getElementById('generatePdf').addEventListener('click', async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            const mapContainerElement = document.getElementById('map');
            const northArrowElement = document.getElementById('northArrow');

            // Ensure North Arrow is displayed and positioned correctly
            northArrowElement.style.display = 'block';

            // Capture the map area including the North Arrow
            const mapCanvas = await html2canvas(mapContainerElement, {
                useCORS: true,
                allowTaint: true,
                logging: true,
                onclone: (clonedDoc) => {
                    // Ensure the North Arrow is visible in the cloned document
                    clonedDoc.getElementById('northArrow').style.display = 'block';
                }
            });

            northArrowElement.style.display = 'block';  // Ensure the North Arrow remains visible
            const mapImage = mapCanvas.toDataURL('image/png');

            // Calculate the aspect ratio of the captured image
            const mapWidth = mapContainerElement.offsetWidth;
            const mapHeight = mapContainerElement.offsetHeight;
            const aspectRatio = mapWidth / mapHeight;

            // Define the desired width and height in the PDF
            const pdfWidth = 200; // Fixed width for the PDF
            const pdfHeight = pdfWidth / aspectRatio; // Calculate height based on aspect ratio

            doc.addImage(mapImage, 'PNG', 10, 10, pdfWidth, pdfHeight);

            const tableStartX = 10 + pdfWidth + 10;
            const tableColumn2 = tableStartX + 38;
            const cellHeight = 10;
            const centerCellHeight = 15;
            let tableY = 20;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(200, 200, 200);
            doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight, 'F');
            doc.text('Segment', tableStartX, tableY);
            doc.text('Distance (m)', tableColumn2, tableY);
            doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight);
            doc.rect(tableColumn2 - 2, tableY - 6, 38, cellHeight);
            tableY += cellHeight;

            const features = drawSource.getFeatures();
            let centerX = 0, centerY = 0;
            features.forEach((feature) => {
                const coordinates = feature.getGeometry().getCoordinates()[0];
                const uniqueCoordinates = coordinates.slice(0, -1); // Remove the duplicate first point at the end
                uniqueCoordinates.forEach((coord, index) => {
                    centerX += coord[0];
                    centerY += coord[1];
                    const startLabel = String.fromCharCode(65 + index);
                    const endLabel = String.fromCharCode(65 + (index + 1) % uniqueCoordinates.length);
                    const distance = calculateDistance(coord[0], coord[1], uniqueCoordinates[(index + 1) % uniqueCoordinates.length][0], uniqueCoordinates[(index + 1) % uniqueCoordinates.length][1]);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`${startLabel} to ${endLabel}`, tableStartX, tableY);
                    doc.text(`${distance.toFixed(1)}`, tableColumn2, tableY);
                    doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight);
                    doc.rect(tableColumn2 - 2, tableY - 6, 38, cellHeight);
                    tableY += cellHeight;
                });

                centerX /= uniqueCoordinates.length;
                centerY /= uniqueCoordinates.length;
                const mapScale = calculateScale(map, pdfWidth);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(200, 200, 200);
                doc.rect(tableStartX - 2, tableY - 6, 38, centerCellHeight, 'F');
                doc.text('Center Point', tableStartX, tableY + 3);
                doc.setFont('helvetica', 'normal');
                doc.text(`E: ${centerX.toFixed(1)}`, tableColumn2, tableY);
                doc.text(`N: ${centerY.toFixed(1)}`, tableColumn2, tableY + 6);
                doc.rect(tableStartX - 2, tableY - 6, 38, centerCellHeight);
                doc.rect(tableColumn2 - 2, tableY - 6, 38, centerCellHeight);
                tableY += centerCellHeight;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(200, 200, 200);
                doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight, 'F');
                doc.text('Scale', tableStartX, tableY);
                doc.text(`1:${mapScale}`, tableColumn2, tableY);
                doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight);
                doc.rect(tableColumn2 - 2, tableY - 6, 38, cellHeight);
                tableY += cellHeight;

                // Calculate and add the area of the polygon in hectares
                const polygon = new ol.geom.Polygon([uniqueCoordinates]);
                const area = polygon.getArea() / 10000; // Convert square meters to hectares
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(200, 200, 200);
                doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight, 'F');
                doc.text('Area (ha)', tableStartX, tableY);
                doc.text(`${area.toFixed(2)}`, tableColumn2, tableY);
                doc.rect(tableStartX - 2, tableY - 6, 38, cellHeight);
                doc.rect(tableColumn2 - 2, tableY - 6, 38, cellHeight);
                tableY += cellHeight;
            });

            const pdfBlob = doc.output('blob');
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(pdfBlob);
            downloadLink.download = 'map.pdf';
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });

        document.getElementById('downloadShapefile').addEventListener('click', async () => {
            const features = drawSource.getFeatures();

            if (features.length === 0) {
                alert('No polygons to export');
                return;
            }

            const geojson = new ol.format.GeoJSON().writeFeaturesObject(features, {
                featureProjection: map.getView().getProjection(),
                dataProjection: 'EPSG:27700' // Shapefiles usually use WGS84 (EPSG:4326)
            });

            // Convert GeoJSON to shapefile
            const shapefileBlob = await convertGeoJSONToShapefile(geojson);
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(shapefileBlob);
            downloadLink.download = 'polygons.zip';
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });

        async function convertGeoJSONToShapefile(geojson) {
            return new Promise((resolve, reject) => {
                try {
                    const options = {
                        folder: 'shapefile',
                        types: {
                            point: 'points',
                            polygon: 'polygons',
                            line: 'lines'
                        }
                    };
                    shpwrite.download(geojson, options);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }

        function calculateDistance(x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }

        function calculateScale(map, pdfWidthMM) {
            const bounds = map.getView().calculateExtent(map.getSize());
            const bottomLeft = [bounds[0], bounds[1]];
            const bottomRight = [bounds[2], bounds[1]];
            const distanceMeters = calculateDistance(bottomLeft[0], bottomLeft[1], bottomRight[0], bottomRight[1]);

            const scalePdf = (distanceMeters / pdfWidthMM) * 1000;

            return Math.round(scalePdf);
        }

        // Debug output
        function debugScaleCalculation(map, pdfWidthMM) {
            const bounds = map.getView().calculateExtent(map.getSize());
            const bottomLeft = [bounds[0], bounds[1]];
            const bottomRight = [bounds[2], bounds[1]];
            const distanceMeters = calculateDistance(bottomLeft[0], bottomLeft[1], bottomRight[0], bottomRight[1]);

            const mapWidthOnScreenMM = map.getSize()[0] / 3.779528; // Pixels to mm conversion
            const scaleScreen = (distanceMeters / mapWidthOnScreenMM) * 1000;
            const scalePdf = (distanceMeters / pdfWidthMM) * 1000;

            document.getElementById('debug').innerHTML = `
                Bounds: ${bounds.join(', ')}\n
                Bottom Left: ${bottomLeft.join(', ')}\n
                Bottom Right: ${bottomRight.join(', ')}\n
                Distance (meters): ${distanceMeters}\n
                Map Width on Screen (mm): ${mapWidthOnScreenMM}\n
                Scale on Screen: 1:${scaleScreen}\n
                Scale in PDF: 1:${scalePdf}
            `;
        }

        // Ensure debug element is present
        const debugElement = document.createElement('pre');
        debugElement.id = 'debug';
        document.body.appendChild(debugElement);

        map.on('moveend', () => {
            debugScaleCalculation(map, 198.0); // Adjust the PDF width if necessary
        });
    })();
});
