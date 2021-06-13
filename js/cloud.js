let cloudClient = CloudClient.create("e05a6efa-ea5f-4adf-b090-ae0ca7d16c20");
let animationInputs;
let variationInputs;
let animation;
let parameterVariation;
let progressInterval;
let violinDiv;
let violinData;

cloudClient.getModelByName( "Transporters Moving in Free Space" )
    .then( model => cloudClient.getLatestModelVersion( model ) )
    .then( version => {
        cloudClient.getModelVersionExperiments(version)
            .then(experiments => {
                animationInputs = cloudClient.createInputs( version );
                variationInputs = cloudClient.createInputs( version );

                triggerModelReadyEvent();
            });
    });

function runAnimation() {
    cloudClient.startAnimation( animationInputs, "player-animation" )
        .then( a => {
            animation = a;
            startAnimationPlotDrawing(animation);
            return animation.stopped();
        })
        .then( () => stopAnimationPlotDrawing() )
        .catch( error => alert( "Unable to run animation. Error: " + error ) );
}
function runVariation() {
    parameterVariation = cloudClient.createParameterVariation(variationInputs);
    startProgressPolling();
    return parameterVariation.run();
}

const progressBar = document.getElementById("progressbar");
const progressBarAnimatedClass = "progress-bar-animated";
function startProgressPolling() {
    progressBar.style.width = "0";

    setTimeout(function() {
        progressBar.classList.add(progressBarAnimatedClass);
    }, 50);

    progressInterval = setInterval(() => {
        parameterVariation.getProgress().then(progress => {
            let progressValue;
            if (progress.message.length) {
                progressValue = JSON.parse(progress.message).total;
            }
            if (progress.status === "COMPLETED") {
                progressValue = "100";
            }
            progressBar.style.width = progressValue + "%";
        })
    }, 2000);
}

function endProgressPolling() {
    progressBar.classList.remove(progressBarAnimatedClass);
    progressBar.style.width = "100%";
    clearInterval(progressInterval);
}

let animationPlotInterval;

function startAnimationPlotDrawing() {
    animationPlotInterval = setInterval(() => {
        animation.getValue('experiment.root.wTimeToWS2')
            .then(data => {
                if (data && data.dataY && data.dataY.length) {
                    Plotly.relayout(violinDiv, {title: ""});
                } else {
                    Plotly.relayout(violinDiv, {title: "Waiting for data..."});
                }
                updateAnimationPlot(data);
            });
    }, 2000);
}

function drawAnimationPlot() {
    violinDiv = document.getElementById("animation-plot");

    violinData = [{
        type: 'violin',
        y: [],
        points: 'none',
        box: {
            visible: true
        },
        boxpoints: false,
        line: {
            color: 'black'
        },
        fillcolor: '#8dd3c7',
        opacity: 0.6,
        meanline: {
            visible: true
        },
        x0: "AGV Wait time at Workshop 2"
    }];

    let layout = {
        title: "Waiting for data...",
        margin: {
            l: 40,
            r: 40,
            b: 40,
            t: 30,
            pad: 5
        },
        yaxis: {
            zeroline: false
        }
    };

    Plotly.plot(violinDiv, violinData, layout, {responsive: true});
}

function updateAnimationPlot(data) {
    violinData[0].y = data.dataY;
    Plotly.redraw(violinDiv);
}

function stopAnimationPlotDrawing() {
    clearInterval(animationPlotInterval);
    violinData[0].y = [];
    Plotly.redraw(violinDiv);
    Plotly.relayout(violinDiv, {title: "Waiting for data..."});
}

const surfaceDiv = document.getElementById("variation-plot");
const startSurfaceData = {
    x: [0, 0],
    y: [0, 0],
    z: [[0, 1], [0, 1]]
};
let surfaceData = [{
    type: 'surface'
}];

let surfaceLayout = {
    title: 'Waiting for data...',
    margin: {
        l: 10,
        r: 10,
        b: 20,
        t: 38
    },
    scene: {
        xaxis: {title: 'Speed, m/s', range: [0, 1]},
        yaxis: {title: 'Fleet size', range: [0, 1]},
        zaxis: {title: 'Utilization', range: [0, 1], categoryorder: 'descending'}
    }
};
function drawParameterVariationPlot() {
    Object.assign(surfaceData[0], startSurfaceData);
    Plotly.plot(surfaceDiv, surfaceData, surfaceLayout, {responsive: true});
}

function updateParameterVariationPlot(outputs) {
    const aggregatedData = getAggregatedDataForSurfacePlot(outputs, "Agv utilization");

    Plotly.animate(surfaceDiv, {
            layout: {
                title: 'Utilization',
                scene: {
                    xaxis: {range: [aggregatedData.x[0], aggregatedData.x[aggregatedData.x.length-1]]},
                    yaxis: {range: [aggregatedData.y[0], aggregatedData.y[aggregatedData.y.length-1]]}
                }
            },
            data: [{
                x: aggregatedData.x,
                y: aggregatedData.y,
                z: aggregatedData.z
            }]
        },
        {
            transition: {
                duration: 500,
                easing: 'cubic-in-out'
            }
        }
    );

    exportToCsv("utilization_data.csv", aggregatedData);
}

function clearParameterVariationPlot() {
    //Plotly.purge(surfaceDiv);
    Object.assign(surfaceData[0], startSurfaceData);
    Plotly.redraw(surfaceDiv);
}

function getAggregatedDataForSurfacePlot(outputData, name) {
    let result = {
        x: [],
        y: [],
        z: []
    };

    let variableData = JSON.parse(outputData.find(d => {
        return d.inputs.length > 0 && d.inputs[0].type.startsWith("FIXED_RANGE");
    }).value);

    let values = JSON.parse(outputData.find(d => {
        return d.outputs.length > 0 && d.outputs[0].name === name
    }).value);

    let xSet = new Set();
    let ySet = new Set();
    variableData.forEach(v => {
        xSet.add(v[0]);
        ySet.add(v[1]);
    });
    result.y = Array.from(xSet).sort();
    result.x = Array.from(ySet).sort();

    for (let i = 0; i < result.y.length; i++) {
        let row = [];
        for (let j = 0; j < result.x.length; j++) {
            row.push(values[result.x.length * i + j] ? values[result.x.length * i + j] : 0.35);
        }
        result.z.push(row);
    }

    return result;
}

function triggerModelReadyEvent() {
    let event;
    if (window.CustomEvent) {
        event = new CustomEvent('isReady', {detail: {isReady: true}});
    } else {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('isReady', true, true, {isReady: true});
    }

    document.body.dispatchEvent(event);
}

function exportToCsv(filename, aggregatedData) {
    let rows = [];

    aggregatedData.z.forEach((itemArray, indexY) => {
        if (indexY === 0) {
            rows.push(["Speed", "Size", "Utilization"]);
        }
        itemArray.forEach((item, indexX) => {
            rows.push(['=\"' + aggregatedData.x[indexX] + '\"', aggregatedData.y[indexY], aggregatedData.z[indexY][indexX]]);
        });
    });

    let processRow = function (row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            };
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/(.|"|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = 'sep=,\n';
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    let blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    let link = document.getElementById("btn-download");
    if (navigator.msSaveOrOpenBlob) { // IE 10+
        link.onclick = () => navigator.msSaveOrOpenBlob(blob, filename);
    } else {
        if (link.download !== undefined) { // feature detection
            // Browsers that support HTML5 download attribute
            let url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
        }
    }
}