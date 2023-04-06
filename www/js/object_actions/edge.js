// Initialization ======
const assignChannelColorsFromPalette = (palette = CHANNEL_COLORS_LIGHT) => {
  for (let i = 0; i < channels.length; i++)
    channelColors[channels[i]] = palette[i];
};

const createEdgeObjects = () => {
  let tempEdgeColors, channels = [], interLayer;

  for (let i = 0; i < edgePairs.length; i++) {
    tempEdgeColors = decideEdgeColors(i);
    if (edgeChannels[i])
      channels = edgeChannels[i];
    interLayer = decideEdgeLayerType(i);
    
    edgeObjects.push(new Edge({id: i, source: edgePairs_source[i], target: edgePairs_target[i],
      colors: tempEdgeColors, weights: edgeValues[i], channels: channels, interLayer: interLayer}));
  }

  // releasing ram
  edgeValues = edgePairs_source = edgePairs_target = 
    edgeChannels = edgeColors = undefined;
};

const decideEdgeColors = (i) => {
  let tempEdgeColors = [EDGE_DEFAULT_COLOR];

  if (edgeChannels && edgeChannels[i]) {
      tempEdgeColors = [];
    for (let j = 0; j < edgeChannels[i].length; j++) {
      if (edgeColors[i][j] !== "")
        tempEdgeColors.push(edgeColors[i][j]);
      else
        tempEdgeColors.push(channelColors[edgeChannels[i][j]]);
    }
  } else if (edgeColors[i] !== "")
    tempEdgeColors = edgeColors[i];
    
  return(tempEdgeColors)
};

const decideEdgeLayerType = (i) => {
  let index1, index2, interLayer = false;

  index1 = nodeLayerNames.indexOf(edgePairs_source[i]);
  index2 = nodeLayerNames.indexOf(edgePairs_target[i]);
  if (nodeGroups[nodeLayerNames[index1]] !== nodeGroups[nodeLayerNames[index2]])
    interLayer = true;

  return(interLayer)
};

// Components attached during initialization
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

const attachChannelEditList = () => {
  let container = document.getElementById('channelColorPicker'),
    title = document.createElement("h4"),
    row, label, colorPicker, checkbox, hideLabel;

    container.innerHTML = ''; // clear
    title.textContent = 'Channels';
    container.appendChild(title);
    for (let i = 0; i < channels.length; i++) {
      row = document.createElement("div");
      row.className = "channel_subcontainer";

      label = document.createElement('h5');
      label.className = "channelLabel";
      label.textContent = channels[i].concat(":");

      colorPicker = document.createElement('input');
      colorPicker.type = "color";
      colorPicker.className = "colorPicker channel_colorPicker";
      colorPicker.name = channels[i];
      colorPicker.id = "color".concat(channels[i]);
      colorPicker.value = channelColors[channels[i]];
      colorPicker.setAttribute('onchange', "changeChannelColor(this)");
      

      checkbox = document.createElement('input'); 
      checkbox.type = "checkbox";
      checkbox.name = "checkbox".concat(channels[i]);
      checkbox.className = "checkbox_check channel_checkbox";
      checkbox.id = "checkbox".concat(channels[i]);
      checkbox.value = channels[i];
      checkbox.setAttribute('onclick', "toggleChannelVisibility(this)");

      hideLabel = document.createElement('label');
      hideLabel.className = "channelCheckboxLabel";
      hideLabel.textContent = "Hide";
    
      row.appendChild(label);
      row.appendChild(colorPicker);
      row.appendChild(checkbox);
      row.appendChild(hideLabel);

      container.appendChild(row);
    }
    
    toggleChannelColorPicker();
};

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

const changeChannelColor = (pickerElement) => {
  let channel_name = pickerElement.name;
  channelColors[channel_name] = pickerElement.value;

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
  updateEdgeColorsRShiny();
}

const redrawIntraLayerEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    if (!edgeObjects[i].interLayer)
      edgeObjects[i].redrawEdge();
};

// TODO refactor
const toggleChannelVisibility = (checkbox) => {
  let channelName = checkbox.value,
    checked = checkbox.checked,
    currentEdge;

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
}

const toggleChannelColorPicker = () => {
  if (edgeFileColorPriority)
    document.getElementById('channelColorPicker').style.display = 'none';
  else
    document.getElementById('channelColorPicker').style.display = 'block';

  updateEdgeColorsRShiny();
};

const unselectAllEdges = () => {
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].deselect();

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
};

// Handlers ======
const redrawEdgeWidthByWeight = (message) => { // true or false
  edgeWidthByWeight = message;
  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
};

const setIntraLayerEdgeOpacity = (message) => {
  intraLayerEdgeOpacity = message;
  redrawIntraLayerEdges();
};

const setInterLayerEdgeOpacity = (message) => {
  interLayerEdgeOpacity = message;
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

const setEdgeFileColorPriority = (message) => { // true or false
  edgeFileColorPriority = message;

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
  toggleChannelColorPicker();
}

const setEdgeSelectedColorPriority = (message) => { // true / false
  selectedEdgeColorFlag = message;
  for (let i = 0; i < edgeObjects.length; i++)
    edgeObjects[i].repaint();

  renderInterLayerEdgesFlag = true;
  redrawIntraLayerEdges();
}

const toggleIntraChannelCurvature = (message) => {
  intraChannelCurvature = message;
  redrawIntraLayerEdges();
};

const toggleInterChannelCurvature = (message) => {
  interChannelCurvature = message;
  renderInterLayerEdgesFlag = true;
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

// Canvas Controls ======
const toggleInterLayerEdgesRendering = () => {
  let interLayerEdgesRenderPauseButton = document.getElementById('interLayerEdgesRenderPauseButton');

  interLayerEdgesRenderPauseFlag = !interLayerEdgesRenderPauseFlag;
  if (interLayerEdgesRenderPauseFlag) {
    interLayerEdgesRenderPauseButton.innerText = "Render Inter-Layer Edges";
  } else {
    interLayerEdgesRenderPauseButton.innerText = "Stop:Render Inter-Layer Edges";
    renderInterLayerEdgesFlag = true;
  }
};
