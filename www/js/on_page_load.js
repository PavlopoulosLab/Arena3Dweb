document.addEventListener('DOMContentLoaded', function() {
    setRenderer();
    resetScreen();
    scene = new Scene();

    initializeCanvasDiv();
    addCanvasEventListeners();
    attachThemeButtons();
    initializeColorPickers();
    createNodeDescriptionDiv();
    
    // other events
    window.onresize = resetScreen;
    // release mouse buttons on network div exit
    document.getElementsByClassName("container-fluid")[0].children[0].addEventListener("mouseleave", clickUp);
    let nodeSearchBar = document.getElementById("nodeSearchBar");
    nodeSearchBar.onkeydown = selectSearchedNodes;
}, false);

const initializeCanvasDiv = () => {
    let canvas_div = document.getElementById("3d-graph");
    canvas_div.style.position='fixed'; // to scroll down along with the page
    //remove default scroll controls while hovering on canvas div
    canvas_div.addEventListener("keydown", function(e) {
        // space and arrow keys
        if([32, 37, 38, 39, 40].indexOf(e.key) > -1) {
            e.preventDefault();
        }
    }, false);
    // removing scroll controls from mouse navigation
    canvas_div.addEventListener("mousedown", function(e) { 
        // middle mouse click
        if(e.button == 1) {
            e.preventDefault();
        }
    }, false);
    canvas_div.addEventListener("mousewheel", function(e) {
        e.preventDefault();
    }, false);
    canvas_div.appendChild(renderer.domElement); //create canvas element once
};

const addCanvasEventListeners = () => {
    let canvas = document.getElementsByTagName("canvas")[0];
    canvas.tabIndex = 1; // default value = -1, giving focus on canvas so it can register keydown events
    canvas.addEventListener("wheel", sceneZoom);
    canvas.addEventListener("keydown", keyPressed);
    canvas.addEventListener("keyup", axisRelease);
    canvas.addEventListener('mousedown', clickDown);
    canvas.addEventListener('mousemove', clickDrag);
    canvas.addEventListener('mouseup', clickUp);
    canvas.addEventListener('dblclick', dblClick);
    canvas.addEventListener('contextmenu', replaceContextMenuOverNode); // implementing right click toolbox over nodes
};

const initializeColorPickers = () => {
    let sceneColorDiv = document.getElementById("sceneColorPicker");
    sceneColorDiv.innerHTML = '<input type="color" id="scene_color" name="scene_color" value="'.concat(
        scene.defaultColor).concat(
            '" onchange="setRendererColor(this.value)"> <label for="scene_color">Background Color</label>');
    let floorColorDiv = document.getElementById("floorColorPicker");
    floorColorDiv.innerHTML = '<input type="color" id="floor_color" name="floor_color" value="'.concat(
        LAYER_DEFAULT_COLOR).concat(
            '" onchange="repaintLayersFromPicker()"> <label for="floor_color">Floor Color</label>');
};
