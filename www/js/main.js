document.addEventListener('DOMContentLoaded', function() {
  let canvas_div = document.getElementById("3d-graph");
  canvas_div.style.position='fixed'; //to scroll down togetehr with the page
  canvas_div.appendChild( renderer.domElement ); //create canvas element once
  //remove default scroll controls while hovering on canvas div
  canvas_div.addEventListener("keydown", function(e) { //removing scroll controls from arrows
      // space and arrow keys
      if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
          e.preventDefault();
      }
  }, false);
  canvas_div.addEventListener("mousedown", function(e) { //removing scroll controls from mouse wheel and middle click navigation
      // middle mouse click
      if(e.button == 1) {
          e.preventDefault();
      }
  }, false);
  canvas_div.addEventListener("mousewheel", function(e) { //removing scroll controls from mouse wheel and middle click navigation
      e.preventDefault(); // mouse wheel
  }, false);
  
  let canvas = document.getElementsByTagName("canvas")[0];
  canvas.tabIndex = 1; //default value = -1, giving focus on canvas so it can register keydown events
  canvas.addEventListener("wheel", sceneZoom);
  canvas.addEventListener("keydown", sceneArrowPan);
  canvas.addEventListener("keyup", axisRelease);
  canvas.addEventListener('mousedown', clickDown);
  canvas.addEventListener('mousemove', clickDrag);
  canvas.addEventListener('mouseup', clickUp);
  canvas.addEventListener('dblclick', dblClick);
  canvas.addEventListener('contextmenu', replaceContextMenuOverNode); //implementing right click toolbox over nodes

  document.getElementsByClassName("container-fluid")[0].children[0].addEventListener("mouseleave", clickUp); //release mouse buttons on network div exit

  window.onresize = canvasRescale;
  
  //node description div
  let descrDiv = document.getElementById("descrDiv");
  let btn = document.createElement("button");
  btn.id = "closeButton";
  btn.innerHTML = "X";
  btn.onclick = function(){
    descrDiv.style.display = "none";
    return true;
  };
  let p = document.createElement('p');
  p.className = "descrDiv_paragraph";
  descrDiv.appendChild(btn);
  descrDiv.appendChild(p);
  
  //scene colorpicker
  let sceneColorDiv = document.getElementById("sceneColorPicker");
  sceneColorDiv.innerHTML = '<input type="color" id="scene_color" name="scene_color" value="'.concat(sceneDefaultColor).concat('" onchange="setSceneColor(this.value)"> <label for="scene_color">Background Color</label>');
  //floor colorpicker
  let floorColorDiv = document.getElementById("floorColorPicker");
  floorColorDiv.innerHTML = '<input type="color" id="floor_color" name="floor_color" value="'.concat(floorDefaultColor).concat('" onchange="setFloorColor(this.value)"> <label for="floor_color">Floor Color</label>');
  
  let channelColorDiv = document.getElementById("channelColorPicker");

  let channelColorLayout = document.getElementById("channelColorLayout");
  
  let searchBar = document.getElementById("searchBar");
  searchBar.onkeypress = selectSearchedNodes;
  
  // themeDiv
  attachThemeButtons();
  
  document.getElementById("homeDiv").innerHTML='<object type="text/html" data="html/home.html" id="homeObject" ></object>'; // ΤΟDO
  document.getElementById("helpDiv").innerHTML='<object type="text/html" data="html/help.html" id="helpObject" ></object>';
  
}, false);
