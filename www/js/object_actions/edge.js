// Initialization ======
const createEdgeObjects = () => {
  let edgeColors, channels = [], interLayer;

  for (let i = 0; i < edgePairs.length; i++) {
    edgeColors = decideEdgeColors(i);
    if (edgeChannels[i])
      channels = edgeChannels[i];
    interLayer = decideEdgeLayerType(i);
    
    edgeObjects.push(new Edge({id: i, source: edgePairs_source[i], target: edgePairs_target[i],
      colors: edgeColors, weights: edgeValues[i], channels: channels, interLayer: interLayer}));
  }
}

const decideEdgeColors = (i) => {
  let edgeColors, index;

  if (edgeChannels && edgeChannels[i]) {
    edgeColors = [];
    for (let j = 0; j < edgeChannels[i].length; j++)
      edgeColors.push(channelColors[edgeChannels[i][j]]);
  } else
    edgeColors = [EDGE_DEFAULT_COLOR];

  if (edge_attributes !== "") { // TODO for multi-channels
    index = edge_attributes.EdgePair.indexOf(edgePairs[i]);
    if (checkIfAttributeColorExist(edge_attributes, index))
      edgeColors = [edge_attributes.Color[index]];
  }

  return(edgeColors)
};

const checkIfAttributeColorExist = (attributes, pos) => { // TODO remove after edge_attributes removed
  return(pos > -1 && attributes.Color !== undefined && 
    attributes.Color[pos] !== "" && attributes.Color[pos] != " " && 
    attributes.Color[pos] != null)
};

const decideEdgeLayerType = (i) => {
  let index1, index2, interLayer = false;

  index1 = nodeLayerNames.indexOf(edgePairs_source[i]);
  index2 = nodeLayerNames.indexOf(edgePairs_target[i]);
  if (nodeGroups[nodeLayerNames[index1]] !== nodeGroups[nodeLayerNames[index2]])
    interLayer = true;

  return(interLayer)
};

// runs constantly on animate
const redrawInterLayerEdges_onAnimate = (showFlag = false) => { // TODO global flag to not even enter
  // let i;
  if (!showFlag && (scene.dragging || interLayerEdgesRenderPauseFlag)){
    // for (i = 0; i < layer_edges_pairs.length; i++){
    //   scene.remove(layerEdges[i]);
    // }
    removeInterLayerEdges();
  } else if (!showFlag && !(edgeWidthByWeight && interLayerEdgeOpacity > 0)){ //this optimizes execution for many connections by making them disappear
    removeInterLayerEdges();
    draw_inter_edges_flag = false;
  } else {
    if (renderInterLayerEdgesFlag) {
      redrawInterLayerEdges();
      if (waitEdgeRenderFlag) { // locked flags for best edge redrawing
        waitEdgeRenderFlag = false;
      } else {
        renderInterLayerEdgesFlag = false;
        waitEdgeRenderFlag = true;
      }
      
    }
    // let index1, index2, color,
    //   points, node_layer1, node_layer2,
    //   geometry, material, arrowHelper, ver_line, curve_group,
    //   hidelayerCheckboxes = document.getElementsByClassName("hideLayer_checkbox");
    // for (i = 0; i < layer_edges_pairs.length; i++){
    //   scene.remove(layerEdges[i]);
    //   // Keep default color
    //   if (layer_edges_pairs_channels && layer_edges_pairs_channels[i] &&  layer_edges_pairs_channels[i].length === 1) {  
    //     color = channelColors[layer_edges_pairs_channels[i][0]];
    //   } else {
    //     color = EDGE_DEFAULT_COLOR;
    //   }
    //   points = [];
    //   node_layer1 = layerGroups[nodeGroups[edgePairs_source[layer_edges_pairs[i]]]];
    //   node_layer2 = layerGroups[nodeGroups[edgePairs_target[layer_edges_pairs[i]]]];
    //   if (!hidelayerCheckboxes[node_layer1].checked && !hidelayerCheckboxes[node_layer2].checked) {
    //     index1 = nodeLayerNames.indexOf(edgePairs_source[layer_edges_pairs[i]]);
    //     index2 = nodeLayerNames.indexOf(edgePairs_target[layer_edges_pairs[i]]);
    //     points.push(
    //       nodeObjects[index1].getWorldPosition(),
    //       nodeObjects[index2].getWorldPosition()
    //     );
    // 		geometry = new THREE.BufferGeometry().setFromPoints( points );
    //     material = "";

    //     // set color to selectedDefault if the edge is selected
    // 		if (exists(selected_edges, layer_edges_pairs[i]) && selectedEdgeColorFlag)
    //       color = selectedDefaultColor;
    //     else if (edge_attributes !== "" && edgeAttributesPriority) 
    //       color = edge_attributes.Color[layer_edges_pairs[i]];
    		  
    //     if (edgeWidthByWeight)
    //       material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: edgeValues[layer_edges_pairs[i]] });
    //     else
    //       material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: interLayerEdgeOpacity });
        
    //     arrowHelper = createArrow(points, color,null, true);
    //     ver_line = new THREE.Line(geometry, material);

    //     // if the edge is multi channel create the multiple channels
    //     if (layer_edges_pairs_channels[i]) {
    //       curve_group = new THREE.Group();
    //       curve_group = createChannels(points[0], points[1], interChannelCurvature, ver_line, i, true);
    //       scene.add(curve_group);
    //       layerEdges[i] = curve_group;
    //     } else {
    //       //directed
    //       if (isDirectionEnabled) {
    //         const group = new THREE.Group();
    //         group.add( ver_line );
    //         group.add( arrowHelper );
    //         scene.add(group);
    //         layerEdges[i] = group;
    //       } else {
    //         scene.add(ver_line);
    //         layerEdges[i] = ver_line;
    //       }
    //     }
    //   }
    // }
  }
}

const removeInterLayerEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    if (edgeObjects[i].interLayer)
      scene.remove(edgeObjects[i].THREE_Object);
};

const redrawInterLayerEdges = () => {
  console.log("redrawInterLayerEdges");
  for (let i = 0; i < edgeObjects.length; i++) {
    if (edgeObjects[i].interLayer)
      edgeObjects[i].redrawEdge();
  }
};

const getInterLayerEdges = () => { // TODO remove if never used
  let interLayerEdges = edgeObjects.map(function(edge) {
    if (edge.interLayer)
      return(edge.id)
  });
  interLayerEdges = interLayerEdges.filter(function(id) {
    return(id !== undefined)
  });
  return(interLayerEdges)
};

const redrawAllEdges = () => {
  console.log("redrawAllEdges");
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].redrawEdge();
}

const redrawIntraLayerEdges = () => { // TODO just change this.THREE_Object
  console.log("redrawIntraLayerEdges");
  for (let i = 0; i < edgeObjects.length; i++) {
    if (!edgeObjects[i].interLayer)
      edgeObjects[i].redrawEdge();
  }
}

const setEdgeColor = () => { // TODO rename to repaintEdges
  let i;
  // inter-layer edges automatically change from EDGE_DEFAULT_COLOR
  for (i=0; i<edges.length; i++) {
    // intra-layer edges
    if (typeof (edges[i]) === 'object') {
      if (edges[i].children && edges[i].children.length > 0) {
        edges[i].children.forEach(child => {
          if (child.material && child.material.color) {
              if (exists(selected_edges, i) && selectedEdgeColorFlag) child.material.color = new THREE.Color(selectedDefaultColor);
              else if (child.userData && child.userData.tag) child.material.color = new THREE.Color(channelColors[child.userData.tag]);
              else child.material.color = new THREE.Color(EDGE_DEFAULT_COLOR);
            } else {
              if (child.userData && child.userData.tag) child.setColor(channelColors[child.userData.tag])
              else child.setColor(EDGE_DEFAULT_COLOR)
            }
        });
      } else {
        if (exists(selected_edges, i) && selectedEdgeColorFlag) edges[i].material.color = new THREE.Color(selectedDefaultColor);
        else edges[i].material.color = new THREE.Color(EDGE_DEFAULT_COLOR);
      } 
    } 
  }
}

// Channels ====================
const changeChannelColor = (el) => {
  let channel_name = el.id.substring(5);
  channelColors[channel_name] = el.value;
  redrawIntraLayerEdges();
  updateEdgesRShiny();
  return true;
}

const toggleChannelVisibility = (checkbox) => {
  let channelName = checkbox.value;
  toggleChildrenWithTag(channelName, checkbox.checked);
};

const toggleChildrenWithTag = (channelName, checked) => {
  let currentEdge;
  for (let i = 0; i < edgeObjects.length; i++) {
    currentEdge = edgeObjects[i].THREE_Object;
    for (let j = 0; j < currentEdge.children.length; j++) {
      if (currentEdge.children[j].userData.tag === channelName) {
          currentEdge.children[j].visible = !checked;
          if (isDirectionEnabled)
            currentEdge.children[j + 1].visible = !checked; // toggle the arrow
          channelVisibility[channelName] = !checked;
          break; // only one channel allowed per edge
      }
    }
  }
};

const toggleChannelLayoutMenu = (el) => {
  icon = document.getElementById('buttonChannelLayout');
  select = document.getElementById('channelsLayout');
  if (icon.classList.contains('close')) {
    icon.classList.remove("close");
    select.classList.remove('display-none');
  } else {
      icon.classList.add("close");
    select.classList.add('display-none');
  }
  
  return true;
}

const attachChannelLayoutList = () => {
  let
    checkbox = '',
    label = document.createElement("label"),
    p = '',
    container = document.getElementById('channelColorLayoutDiv'),
    channelContainer  = document.createElement('div'),
    icon = document.createElement('i'),
    subcontainer = document.createElement('div');
    item = document.createElement('div');
  
  container.innerHTML = ''; // clear
  icon.setAttribute('class', 'fas fa-angle-up buttonChannelLayout close');
  icon.setAttribute('id', 'buttonChannelLayout');
  icon.setAttribute('onclick', "toggleChannelLayoutMenu(this)");
  label.textContent = 'Select Channels for Layouts';
  label.setAttribute("for", "channelsLayout");

  channelContainer.setAttribute("name", "channelsLayout");
  channelContainer.setAttribute("id", "channelsLayout");
  channelContainer.setAttribute("class", "channelsLayout display-none");

  channels.forEach(channel => {
    row = document.createElement('div');

    checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = channel;
    checkbox.className = "checkbox_check channel_checkbox";
    checkbox.id = "checkbox_layout".concat(channel);
    checkbox.checked = true;
    checkbox.setAttribute('onclick', "updateSelectedChannelsRShiny(this)");

    p = document.createElement("p");
    p.className = "channel_layout_name";
    p.textContent = channel;

    row.appendChild(checkbox);
    row.appendChild(p);

    channelContainer.appendChild(row);
    row = '';
  });
  item.appendChild(label);
  subcontainer.appendChild(item);
  subcontainer.appendChild(icon);
  subcontainer.setAttribute('class', 'channelLayoutsub');
  container.appendChild(subcontainer);
  container.appendChild(channelContainer);

}

const attachChannelEditList = () => {
  let checkbox = "",
    label = "",
    label2 = "",
    br = "",
    colorPicker = "",
    subcontainer = "",
    title = "",
    container = document.getElementById('channelColorPicker');
    br = document.createElement('br');

    title = document.createElement("h4");
    title.textContent = 'Channels';
    container.innerHTML = ''; // clear
    container.appendChild(title);
    channels.forEach(channel => {
      subcontainer = document.createElement("div");
      subcontainer.className = "channel_subcontainer";

      label = document.createElement('h5');
      label.className = "channelLabel";
      label.textContent = channel.concat(":");

      colorPicker = document.createElement('input');
      colorPicker.type = "color";
      colorPicker.className = "colorPicker channel_colorPicker";
      colorPicker.name = "color".concat(channel);
      colorPicker.id = "color".concat(channel);
      colorPicker.value = channelColors[channel];
      colorPicker.setAttribute('onchange', "changeChannelColor(this)");
      

      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkbox".concat(channel);
      checkbox.className = "checkbox_check channel_checkbox";
      checkbox.id = "checkbox".concat(channel);
      checkbox.value = channel;
      checkbox.setAttribute('onclick', "toggleChannelVisibility(this)");

      label2 = document.createElement('label');
      label2.className = "channelCheckboxLabel";
      label2.textContent = "Hide";
    
      subcontainer.appendChild(label);
      subcontainer.appendChild(colorPicker);
      subcontainer.appendChild(checkbox);
      subcontainer.appendChild(label2);
      // subcontainer.appendChild(br);

      container.appendChild(subcontainer);
      subcontainer = '';
    });
  if (edgeAttributesPriority)
    document.getElementById('channelColorPicker').style.display = 'none';
  else
    document.getElementById('channelColorPicker').style.display = 'block';
}

const getChannelColorsFromPalette = (palette) => {
  for (let i = 0; i < channels.length; i++)
    channelColors[channels[i]] = palette[i];
};

// TODO rename to assignEdgeColor
const assignColor = (checkChannels, i, channels, tag, color, edgeNoChannel) => {
  if (checkChannels && checkChannels[i]) { //if this is a file with channels
       channels.forEach(channel => {
          if (channel.userData.tag === tag) {
            channel.material.color = new THREE.Color(color);
          }
        });
      } else { //if this is not a file with channels
        edgeNoChannel.material.color = new THREE.Color(color);
      }
}

const setEdgeAttributes = (message) => {
  edge_attributes = message;
  let pos1arr = -1,
    pos2arr = -1,
    pos3 = -1;
  for (let i = 0; i < edges.length; i++){
    if (edgeAttributesPriority) {

      pos1arr = findIndices(edge_attributes.SourceNode, edgePairs[i]);
      pos2arr = findIndices(edge_attributes.TargetNode, edgePairs[i]);
      pos1arr != -1 && pos1arr.forEach(pos1 => {
        if (checkIfAttributeColorExist(edge_attributes, pos1)) {//if node not currently selected and exists in node attributes file and color is assigned
          if (typeof (edges[i]) == "number") { //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            if (edge_attributes && edge_attributes.Channel) {
              assignColor(layer_edges_pairs_channels, pos3, layerEdges[pos3].children, edge_attributes.Channel[pos1], edge_attributes.Color[pos1], layerEdges[pos3]);
            } else {
              assignColor(layer_edges_pairs_channels, pos3, layerEdges[pos3].children, [], edge_attributes.Color[pos1], layerEdges[pos3]);
            }
            }
          else {
            assignColor(edgeChannels, i, edges[i].children, edge_attributes.Channel[pos1], edge_attributes.Color[pos1], edges[i]);
          }
        }
      });
      pos2arr != -1 && pos2arr.forEach(pos2 => {
      if (checkIfAttributeColorExist(edge_attributes, pos2)) { 
        if (typeof(edges[i]) == "number"){ //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
          layerEdges[pos3].material.color = new THREE.Color( edge_attributes.Color[pos2] );
        } else edges[i].material.color = new THREE.Color( edge_attributes.Color[pos2] );
      }
      });
    }
  }
  updateEdgesRShiny();
}

// Handlers ======
const redrawEdgeWidthByWeight = (message) => { // true or false
  edgeWidthByWeight = message;
  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
};

const setIntraLayerEdgeOpacity = (message) => {
  intraLayerEdgeOpacity = message;
  for (let i = 0; i < edgeObjects.length; i++)
    if (!edgeObjects[i].interLayer)
      edgeObjects[i].setOpacity(intraLayerEdgeOpacity);
};

const setInterLayerEdgeOpacity = (message) => {
  interLayerEdgeOpacity = message;
  for (let i = 0; i < edgeObjects.length; i++)
    if (edgeObjects[i].interLayer)
      edgeObjects[i].setOpacity(interLayerEdgeOpacity);
};

const toggleDirection = (message) => {
  isDirectionEnabled = message;
  redrawAllEdges();
};

const setIntraDirectionArrowSize = (message) => {
  intraDirectionArrowSize = message;
  redrawIntraLayerEdges();
};

const setInterDirectionArrowSize = (message) => {
  interDirectionArrowSize = message;
  renderInterLayerEdgesFlag = true;
};

const edgeFileColorPriority = (message) => {
  edgeAttributesPriority = message; //message = true or false
  if (edgeAttributesPriority) document.getElementById('channelColorPicker').style.display = 'none';
  else document.getElementById('channelColorPicker').style.display = 'block';
  redrawIntraLayerEdges();
  return true;
}

const edgeSelectedColorPriority = (message) => {
  selectedEdgeColorFlag = message;
  let pos1 = pos2 = pos3 = "";
  for (let i=0; i<selected_edges.length; i++){
    if (selectedEdgeColorFlag){
      if (typeof (edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(selected_edges[i]);
        assign2Children(layerEdges[pos3], selectedDefaultColor);
      } else {
        assign2Children(edges[selected_edges[i]], selectedDefaultColor);
      }
    }else if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
      pos1 = edge_attributes.SourceNode.indexOf(edgePairs[selected_edges[i]]);
      pos2 = edge_attributes.TargetNode.indexOf(edgePairs[selected_edges[i]]);
      if(checkIfAttributeColorExist(edge_attributes, pos1)){//if node not currently selected and exists in node attributes file and color is assigned
        if (typeof (edges[selected_edges[i]]) == "number") { //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
           assign2Children(layerEdges[pos3], edge_attributes.Color[pos1]);
        }
        else {
          assign2Children(edges[selected_edges[i]], edge_attributes.Color[pos1]);//edge is intra layer
        }
        }
      else if(checkIfAttributeColorExist(edge_attributes, pos2)){
        if (typeof (edges[selected_edges[i]]) == "number") { //edge is inter-layer
          pos3 = layer_edges_pairs.indexOf(i);
            assign2Children(layerEdges[pos3], edge_attributes.Color[pos2]);
        } else {
            assign2Children(edges[selected_edges[i]], edge_attributes.Color[pos2]);
        }
      }
      else{
        if (typeof (edges[selected_edges[i]]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          assign2Children(layerEdges[pos3], EDGE_DEFAULT_COLOR, true);
        } else {
          assign2Children( edges[selected_edges[i]], EDGE_DEFAULT_COLOR,  true);
        }   
      }
    } else{
      if (typeof (edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        assign2Children(layerEdges[pos3], EDGE_DEFAULT_COLOR, true);
      } else {
        assign2Children( edges[selected_edges[i]], EDGE_DEFAULT_COLOR, true);

      }
    } 
  }
  return true;
}

// Channels ====================
const toggleIntraChannelCurvature = (message) => {
  intraChannelCurvature = message;
  redrawIntraLayerEdges();
  return true;
}

const toggleInterChannelCurvature = (message) => {
  interChannelCurvature = message;
  renderInterLayerEdgesFlag = true;
};

const toggleInterLayerEdgesRendering = () => {
  let interLayerEdgesRenderPauseButton = document.getElementById('interLayerEdgesRenderPauseButton');
  if (interLayerEdgesRenderPauseFlag) {
    interLayerEdgesRenderPauseFlag = false;
    renderInterLayerEdgesFlag = true;
    interLayerEdgesRenderPauseButton.innerText = "Stop:Render Inter-Layer Edges";
  } else {
    interLayerEdgesRenderPauseFlag = true;
    interLayerEdgesRenderPauseButton.innerText = "Render Inter-Layer Edges";
  }
}

const unselectAllEdges = () => {
  let pos1 = pos2 = pos3 = -1;
  for (let i = 0; i < edges.length; i++) {
    if (edge_attributes !== "" && edgeAttributesPriority){ //check if color is overidden by user
      pos1 = edge_attributes.SourceNode.indexOf(edgePairs[i]);
      pos2 = edge_attributes.TargetNode.indexOf(edgePairs[i]);
      //if node not currently selected and exists in node attributes file and color is assigned
      if (pos1 > -1 && edge_attributes.Color !== undefined &&
        edge_attributes.Color[pos1] !== "" && edge_attributes.Color[pos1] != " ") {
          if (typeof (edges[i]) == "number") { //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            changeColor(layerEdges[pos3], edge_attributes.Color[pos3]);
          } else
            changeColor(edges[i], edge_attributes.Color[pos3]);
      } else if (pos2 > -1 && edge_attributes.Color !== undefined &&
        edge_attributes.Color[pos2] !== "" && edge_attributes.Color[pos2] != " ") { 
          if (typeof(edges[i]) == "number"){ //edge is inter-layer
            pos3 = layer_edges_pairs.indexOf(i);
            changeColor(layerEdges[pos3], edge_attributes.Color[pos2]);
          } else
            changeColor(edges[i], edge_attributes.Color[pos2]);
      } else {
        if (typeof(edges[i]) == "number") {
          pos3 = layer_edges_pairs.indexOf(i);
          changeColor(layerEdges[pos3], EDGE_DEFAULT_COLOR);
        } else changeColor(edges[i], EDGE_DEFAULT_COLOR);
      }
    } else {
      if (typeof (edges[i]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        changeColor(layerEdges[pos3], EDGE_DEFAULT_COLOR);
      } else
        changeColor(edges[i], EDGE_DEFAULT_COLOR);
    } 
  }
};
