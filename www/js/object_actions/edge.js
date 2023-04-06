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

  // releasing ram
  edgeValues = edgePairs_source = edgePairs_target = 
    edgeChannels = undefined;
};

const decideEdgeColors = (i) => {
  let edgeColors;

  if (edgeChannels && edgeChannels[i]) {
    edgeColors = [];
    for (let j = 0; j < edgeChannels[i].length; j++)
      edgeColors.push(channelColors[edgeChannels[i][j]]);
  } else
    edgeColors = [EDGE_DEFAULT_COLOR];
    
  return(edgeColors)
};

const decideEdgeLayerType = (i) => {
  let index1, index2, interLayer = false;

  index1 = nodeLayerNames.indexOf(edgePairs_source[i]);
  index2 = nodeLayerNames.indexOf(edgePairs_target[i]);
  if (nodeGroups[nodeLayerNames[index1]] !== nodeGroups[nodeLayerNames[index2]])
    interLayer = true;

  return(interLayer)
};

const attachChannelLayoutList = () => {
  let container = document.getElementById('channelColorLayoutDiv'),
    titleContainer, channelContainer;
    
  container.innerHTML = ''; // clear
  titleContainer = createLayoutTitleContainer();
  channelContainer = createLayoutChannelContainer();
  container.appendChild(titleContainer);
  container.appendChild(channelContainer);
};

const createLayoutTitleContainer = () => {
  let titleContainer = document.createElement('div'),
    label = document.createElement("label"),
    item = document.createElement('div'),
    icon = document.createElement('i');

  titleContainer.setAttribute('class', 'channelLayoutsub');
  label.textContent = 'Select Channels for Layouts';
  label.setAttribute("for", "channelsLayout");
  item.appendChild(label);
  icon.setAttribute('class', 'fas fa-angle-up buttonChannelLayout close');
  icon.setAttribute('id', 'buttonChannelLayout');
  icon.setAttribute('onclick', "toggleChannelLayoutMenu(this)");
  titleContainer.appendChild(item);
  titleContainer.appendChild(icon);

  return(titleContainer)
};

const createLayoutChannelContainer = () => {
  let channelContainer = document.createElement('div'),
    row, checkbox, p;

  channelContainer.setAttribute("name", "channelsLayout");
  channelContainer.setAttribute("id", "channelsLayout");
  channelContainer.setAttribute("class", "channelsLayout display-none");
  for (let i = 0; i < channels.length; i++) {
    row = document.createElement('div');

    checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = channels[i];
    checkbox.className = "checkbox_check channel_checkbox";
    checkbox.id = "checkbox_layout".concat(channels[i]);
    checkbox.checked = true;
    checkbox.setAttribute('onclick', "updateSelectedChannelsRShiny(this)");

    p = document.createElement("p");
    p.className = "channel_layout_name";
    p.textContent = channels[i];

    row.appendChild(checkbox);
    row.appendChild(p);

    channelContainer.appendChild(row);
    row = '';
  }

  return(channelContainer)
};

const toggleChannelLayoutMenu = () => {
  let icon = document.getElementById('buttonChannelLayout'),
    select = document.getElementById('channelsLayout');

  if (icon.classList.contains('close')) {
    icon.classList.remove("close");
    select.classList.remove('display-none');
  } else {
    icon.classList.add("close");
    select.classList.add('display-none');
  }
};

const attachChannelEditList = () => {
  let checkbox = "",
    label = "",
    label2 = "",
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
  if (edgeFileColorPriority)
    document.getElementById('channelColorPicker').style.display = 'none';
  else
    document.getElementById('channelColorPicker').style.display = 'block';
}

// On animate ======
const renderInterLayerEdges = () => {
  if (existsConditionToRemoveInterEdges()) {
    if (!interEdgesRemoved)
      removeInterLayerEdges();
  } else {
    if (renderInterLayerEdgesFlag)
      redrawInterLayerEdges();
  }
};

const existsConditionToRemoveInterEdges = () => {
  return(scene.dragging || interLayerEdgesRenderPauseFlag ||
    (!edgeWidthByWeight && interLayerEdgeOpacity === 0))
};

const removeInterLayerEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    if (edgeObjects[i].interLayer)
      scene.remove(edgeObjects[i].THREE_Object);

  interEdgesRemoved = true;
};

const redrawInterLayerEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    if (edgeObjects[i].interLayer)
      edgeObjects[i].redrawEdge();

  interEdgesRemoved = false;
  // locked flags for best edge redrawing below
  if (waitEdgeRenderFlag) {
    waitEdgeRenderFlag = false;
  } else {
    renderInterLayerEdgesFlag = false;
    waitEdgeRenderFlag = true;
  }
};

// Event Listeners ======




const redrawIntraLayerEdges = () => { // TODO just change this.THREE_Object
  for (let i = 0; i < edgeObjects.length; i++) {
    if (!edgeObjects[i].interLayer)
      edgeObjects[i].redrawEdge();
  }
}

// Channels ====================
const changeChannelColor = (el) => { // TODO channels colors from palette
  console.log("vagfafa")
  let channel_name = el.id.substring(5);
  channelColors[channel_name] = el.value;
  redrawIntraLayerEdges();
  updateEdgeColorsRShiny();
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

const getChannelColorsFromPalette = (palette) => {
  for (let i = 0; i < channels.length; i++)
    channelColors[channels[i]] = palette[i];
};

const setEdgeAttributes = (edgeAttributes) => {
  let pos, pos2;

  document.getElementById("edgeFileColorPriority").checked = true;
  edgeFileColorPriority = true;
  for (let i = 0; i < edgeAttributes.length; i++) {
    pos = edgePairs.indexOf(edgeAttributes[i].EdgePair);
    if (pos != -1) {
      if (edgeAttributes[i].Channel) {
        for (let j = 0; j < edgeObjects[pos].channels.length; j++) {
          pos2 = edgeObjects[pos].channels.indexOf(edgeAttributes[i].Channel);
          edgeObjects[pos].importedColors[pos2] = edgeAttributes[i].Color;
        }
      } else
        edgeObjects[pos].importedColors[0] = edgeAttributes[i].Color;
  
      edgeObjects[pos].repaint();
    }
  }

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
  updateEdgeColorsRShiny();
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

  renderInterLayerEdgesFlag = true;
};

const toggleDirection = (message) => {
  isDirectionEnabled = message;
  redrawAllEdges();
};

const redrawAllEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].redrawEdge();
}

const setIntraDirectionArrowSize = (message) => {
  intraDirectionArrowSize = message;
  redrawIntraLayerEdges();
};

const setInterDirectionArrowSize = (message) => {
  interDirectionArrowSize = message;
  renderInterLayerEdgesFlag = true;
};

const setEdgeFileColorPriority = (message) => {
  edgeFileColorPriority = message; //message = true or false
  if (edgeFileColorPriority)
    document.getElementById('channelColorPicker').style.display = 'none';
  else
    document.getElementById('channelColorPicker').style.display = 'block';
  redrawIntraLayerEdges();
}

const setEdgeSelectedColorPriority = (message) => { // true / false
  selectedEdgeColorFlag = message;
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].repaint();

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
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
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].deselect();

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
};
