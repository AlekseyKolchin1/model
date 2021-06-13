class FullScreenUtils {
    static isFullScreenEnabled() {
        return document.fullscreenEnabled || document.mozFullScreenEnabled ||
            document.webkitFullscreenEnabled || document.msFullscreenEnabled;
    }

    static isFullScreen() {
        return document.fullscreenElement || document.mozFullScreenElement ||
            document.webkitFullscreenElement || document.msFullscreenElement;
    }

    static requestFullScreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    static cancelFullScreen() {
        if (document.cancelFullScreen) { // Standard API
            document.cancelFullScreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) { // Chrome and Safari
            document.webkitCancelFullScreen();
        } else if (document.msExitFullscreen) { // IE
            document.msExitFullscreen();
        }
    }

    static toggleFullScreen(id) {
        if (FullScreenUtils.isFullScreen()) {
            FullScreenUtils.cancelFullScreen();
        } else {
            let element = document.getElementById(id);
            FullScreenUtils.requestFullScreen(element);
        }
    }
}

class Inputs  {
    constructor(modelVersion) {
        this.modelVersion = modelVersion;
        this.outputs = modelVersion.experimentTemplate.outputs;
        this.setDefaultInputs();
    }

    setDefaultInputs() {
        this.inputsArray = this.modelVersion.experimentTemplate.inputs.map(i => Object.assign({}, i));
        this.inputsArray.push({name: "{RANDOM_SEED}", type: "LONG", units: null, value: "1"});
    }

    getInput(name) {
        let input = this.inputsArray.find(i => i.name === name);
        return input.value;
    }

    setInput(name, value) {
        let input = this.inputsArray.find(i => i.name === name);
        input.value = value;
    }

    setIntegerRangeInput(name, min, max, step) {
        let input = this.inputsArray.find(i => i.name === name);
        input.type = "FIXED_RANGE_INTEGER";
        input.value ='{"min":"' + ~~min + '","max":"' + ~~max + '","step":"' + ~~step + '"}';
    }

    setDoubleRangeInput(name, min, max, step) {
        let input = this.inputsArray.find(i => i.name === name);
        input.type = "FIXED_RANGE_DOUBLE";
        input.value ='{"min":"' + min + '","max":"' + max + '","step":"' + step + '"}';
    }

    setInputsFromExperiment(experiment) {
        this.inputsArray = experiment.inputs.map(i => Object.assign({}, i));
    }

    getData(type) {
        return JSON.stringify({
            inputs: this.inputsArray,
            experimentType: type
        });
    }
}

class Animation {
    constructor(cloudClient, svgClient, inputs, info) {
        this.cloudClient = cloudClient;
        this.svgClient = svgClient;
        this.inputs = inputs;
        this.info = info;
        this.nodeUrl = `${this.cloudClient.HOST_URL}/nodes/${this.info.restUrl}sessions/${this.info.sessionUuid}`;
        this.version = ALVersion.fromString(info.version);
    }

    stop() {
        this.svgClient.stop("STOPPED");
        this.cloudClient.apiRequest(`${this.nodeUrl}/stop`, "POST");
        if (this.onStopped)
            this.onStopped();
    }

    pause() {
        let url = `${this.nodeUrl}/command?cmd=pause&parameters=`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    resume() {
        let url = `${this.nodeUrl}/command?cmd=run&parameters=`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    setSpeed(speed) {
        let url = `${this.nodeUrl}/command?cmd=setspeed&parameters=${speed}`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    setVirtualTime(speed) {
        let url = `${this.nodeUrl}/command?cmd=setspeed&parameters=Infinity`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    navigateTo(viewArea) {
        let url = `${this.nodeUrl}/command?cmd=navigateto&parameters=${viewArea}`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    setPresentable(pathToPresentable) {
        let url = `${this.nodeUrl}/command?cmd=setpresentable&parameters=${pathToPresentable}`;
        return this.cloudClient.apiRequest(url, "POST");
    }

    setValue(pathToField, value) {
        if (this.version.greaterOrEquals(this.cloudClient.ANIMATION_VERSION)) {
            let url = `${this.nodeUrl}/set-value?pathtofield=${pathToField}`;
            return this.cloudClient.apiRequest(url, "POST", { data: JSON.stringify(value) });
        } else {
            alert("Set value is not supported!");
        }
    }

    getValue(pathToField) {
        if (this.version.greaterOrEquals(this.cloudClient.ANIMATION_VERSION)) {
            let url = `${this.nodeUrl}/get-value?pathtofield=${pathToField}`;
            return this.cloudClient.apiRequest(url, "GET")
                .then(r => {
                    return JSON.parse(JSON.parse(r)); // Due to double serialization on server side
                });
        } else {
            alert("Set value is not supported!");
        }
    }

    callFunction(pathToFunction, args) {
        if (this.version.greaterOrEquals(this.cloudClient.ANIMATION_VERSION)) {
            let url = `${this.nodeUrl}/call-function?pathtofunction=${pathToFunction}`;
            return this.cloudClient.apiRequest(url, "POST", {
                data: JSON.stringify(args.map(a => JSON.stringify(a)))
            }).then(r => {
                return JSON.parse(JSON.parse(r)); // Due to double serialization on server side
            });
        } else {
            alert("Call function is not supported!");
        }
    }

    stopped() {
        return new Promise(resolve => {
            this.onStopped = resolve;
        })
    }
}

class ModelRun {

    constructor(client, inputs, modelVersion, type) {
        this.client = client;
        this.inputs = inputs;
        this.modelVersion = modelVersion;
        this.type = type;
        this.versionsUrl = this.client.OPEN_API_URL + "/versions/" + this.modelVersion.id;
    }

    getRequestParams() {
        return {
            data: this.inputs.getData(this.type),
            contentType: "application/json"
        };
    }

    run() {
        return this.client.apiRequest(this.versionsUrl + "/runs", "POST", this.getRequestParams())
            .then(() => this.requestOutputs());
    }

    stop() {
        return this.client.apiRequest(this.versionsUrl + "/runs/stop", "POST", this.getRequestParams());
    }

    getStatus() {
        return this.runState.status;
    }

    getProgress() {
        if (this.runState && this.runState.id) {
            return this.client.apiRequest(`${this.versionsUrl}/runs/${this.runState.id}/progress`);
        } else {
            return Promise.resolve({});
        }
    }

    requestOutputs() {
        return this.client.apiRequest(this.versionsUrl + "/run", "POST", this.getRequestParams())
            .then(runState => {
                this.runState = runState;
                switch (runState.status) {
                    case "FRESH":
                    case "RUNNING":
                        return new Promise(resolve => setTimeout(() => resolve(this.requestOutputs()), 5000));
                    case "COMPLETED":
                        return this.getRunOutputs(runState);
                    case "ERROR":
                    case "STOPPED":
                        return Promise.reject(runState.status);
                    default:
                        // Unexpected status
                        break;
                }
            });
    }

    getRunOutputs(runState) {
        switch (this.type) {
            case "SIMULATION":
                return this.getSimulationRunOutputs(runState);
            case "PARAMETER_VARIATION":
                return this.getVariationRunOutputs(runState);
            default:
                return Promise.reject(runState);
        }
    }

    getSimulationRunOutputs(runState) {
        let aggregations = this.inputs.outputs.map(output => {
            return {
                aggregationType: "IDENTITY",
                inputs: [],
                outputs: [output]
            }
        });
        return this.client.apiRequest(this.versionsUrl + "/runs/" + runState.id, "POST", {
            data: JSON.stringify(aggregations)
        })
            .then(result => {
                return result.map(r => Object.assign({}, r.outputs[0], {value: r.value}));
            });
    }

    getVariationRunOutputs(runState) {
        let aggregations = this.inputs.outputs.map(output => {
            return {
                aggregationType: "ARRAY",
                inputs: [],
                outputs: [output]
            }
        });
        let variableInputs = this.inputs.inputsArray
            .filter(i => i.type === "FIXED_RANGE_INTEGER" || i.type === "FIXED_RANGE_DOUBLE");
        aggregations.push({
            aggregationType: "ARRAY",
            inputs: variableInputs,
            outputs: []
        });

        return this.client.apiRequest(this.versionsUrl + "/runs/" + runState.id, "POST", {
            data: JSON.stringify(aggregations),
            contentType: "application/json"
        });
    }
}

class CloudClient {
    static create(apiKey, host) {
        return new CloudClient(apiKey, host ? host : "https://cloud.anylogic.com");
    }

    constructor(apiKey, host) {
        this.VERSION = "8.4.0";
        this.SERVER_VERSION = "8.4.0";
        this.ANIMATION_VERSION =  new ALVersion(8, 4, 1);
        this.apiKey = apiKey;
        this.setHost(host);
        this.loadHeaders();
    }

    setHost(host) {
        this.HOST_URL = host;
        this.REST_URL = this.HOST_URL + "/api";
        this.OPEN_API_URL = this.REST_URL + "/open/" + this.SERVER_VERSION;
    }

    getModels() {
        return this.apiRequest(this.OPEN_API_URL + "/models");
    }

    getModelById(id) {
        return this.apiRequest(this.OPEN_API_URL + "/models/" + id);
    }

    getModelByName(name) {
        return this.apiRequest(this.OPEN_API_URL + "/models/name/" + name);
    }

    getModelVersionById(model, versionId) {
        return this.apiRequest(this.OPEN_API_URL + "/models/" + model.id + "/versions/" + versionId);
    }

    getModelVersionByNumber(model, versionNumber) {
        return this.apiRequest(this.OPEN_API_URL + "/models/" + model.id + "/versions/number/" + versionNumber);
    }

    getLatestModelVersion(model) {
        let versionId = model.modelVersions[model.modelVersions.length - 1];
        return this.getModelVersionById(model, versionId);
    }

    getModelVersionExperiments(modelVersion) {
        return this.apiRequest(this.OPEN_API_URL + "/versions/" + modelVersion.id + "/experiments");
    }

    createInputs(version) {
        return new Inputs(version);
    }

    createSimulation(inputs) {
        return this.createModelRun(inputs, "SIMULATION");
    }

    createParameterVariation(inputs) {
        return this.createModelRun(inputs, "PARAMETER_VARIATION");
    }

    createModelRun(inputs, type) {
        return new ModelRun(this, inputs, inputs.modelVersion, type);
    }

    startAnimation(inputs, divId) {
        let requestData = {
            data: JSON.stringify({
                inputs: inputs.inputsArray,
                experimentType: "ANIMATION_SVG"
            }),
            contentType: "application/json"
        };
        let cloudClient = this;

        return this.apiRequest(this.OPEN_API_URL + "/versions/" + inputs.modelVersion.id + "/runs/animation", "POST", requestData).then(info => {
            return this.loadContentToDiv("assets/svg/svg-template.html", divId).then(() => {
                let svgClient = SVGFactory.createClient(info.version);
                let animation = new Animation(cloudClient, svgClient, inputs, info);
                info.host = this.HOST_URL;
                if (FullScreenUtils.isFullScreenEnabled()) {
                    svgClient.setCallback("ontogglefullscreen", () => FullScreenUtils.toggleFullScreen("svg-video-container"));
                }
                let stop = () => this.apiRequest(info.host + "/nodes/" + info.restUrl + "sessions/" + info.sessionUuid + "/stop", "POST").then(() => {
                    animation.stop();
                });
                svgClient.setCallback("onstop", () => stop());
                svgClient.start(info);
                return Promise.resolve(animation);
            });
        });
    }

    loadContentToDiv(url, id) {
        return this.apiRequest(url, "GET", {responseType: "text"}, true).then(content => {
            document.getElementById(id).innerHTML = content;
        });
    }

    apiRequest(url, type, params, noAuth) {
        return new Promise((resolve, reject) => {
            let xhttp = new XMLHttpRequest();
            if (!type) type = "GET";
            if (!params) params = {};
            xhttp.open(type, url, true);
            if (params.contentType)
                xhttp.setRequestHeader("Content-Type", "application/json");
            if (!noAuth)
                xhttp.setRequestHeader("Authorization", this.apiKey);
            xhttp.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        let result = xhttp.responseText;
                        if (!params.responseType)
                            result = JSON.parse(result);
                        resolve(result);
                    } else {
                        reject("Request error status " + this.status);
                    }
                }
            };
            xhttp.send(params.data);
        });
    }

    loadHeaders() {
        this.loadScript("assets/api.bundle.js");
        this.loadStyle("assets/svg/css/presentation-html.css");
        this.loadStyle("assets/svg/css/presentation-svg.css");
    }

    loadScript(url){
        let script = document.createElement("script");
        script.type = "text/javascript";
        // script.onload = () => callback();
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    loadStyle(url){
        let link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.getElementsByTagName("head")[0].appendChild(link);
    }
}

class ALVersion {

    //static VERSION_8_4_0 = new ALVersion(8, 4, 0);

    constructor(major, minor, extra) {
        if (major === undefined || minor === undefined || extra === undefined) {
            throw new Error("Illegal argument");
        }
        this.major = major;
        this.minor = minor;
        this.extra = extra;
    }

    compare(other) {
        let res;
        res = this.major - other.major;
        if(res != 0) { return res; }
        res = this.minor - other.minor;
        if(res != 0) { return res; }
        res = this.extra - other.extra;
        return res;
    }

    between(obj1, obj2) {
        return this.compare(obj1) >= 0 && this.compare(obj2) <= 0;
    }

    greaterOrEquals(obj1) {
        return this.compare(obj1) >= 0;
    }

    static fromString(version) {
        let numbers = version.split(".");
        let major = Number(numbers[0]);
        let minor = Number(numbers[1]);
        let extra = Number(numbers[2]);
        return new ALVersion(major, minor, extra);
    }
}

window.CloudClient = CloudClient;
