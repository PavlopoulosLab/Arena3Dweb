// Initialization ======
const createEdgeObjects = () => {
  let edgeColors, channels = [], interLayer;
    // points, geometry, material,
    // arrowHelper, ver_line, curve_group;

  for (let i = 0; i < edgePairs.length; i++) {
    edgeColors = decideEdgeColors(i);
    if (edgeChannels[i])
      channels = edgeChannels[i];
    interLayer = decideEdgeLayerType(i);
    
    edgeObjects.push(new Edge({id: i, source: edgePairs_source[i], target: edgePairs_target[i],
      colors: edgeColors, weights: edgeValues[i], channels: channels, interLayer: interLayer}));
    
  //   index1 = nodeLayerNames.indexOf(edgePairs_source[i]);
  //   index2 = nodeLayerNames.indexOf(edgePairs_target[i]);
  //   if (nodeGroups[nodeLayerNames[index1]] == nodeGroups[nodeLayerNames[index2]]) { //check if edge inside same Layer
  //     points = [];
  //     points.push( nodeObjects[index1].getPosition(), nodeObjects[index2].getPosition() );
  // 		geometry = new THREE.BufferGeometry().setFromPoints( points );
  // 		material = "";
  		
  // 		if (edgeWidthByWeight)
  //       material = new THREE.LineBasicMaterial( { color: edgeColor, alphaTest: 0.05, transparent: true, opacity: edgeValues[i] } );
  //     else
  //       material = new THREE.LineBasicMaterial({ color: edgeColor, alphaTest: 0.05, transparent: true, opacity: intraLayerEdgeOpacity });
  //     ver_line = new THREE.Line(geometry, material);

  //     if (edgeChannels[i]) {
  //       curve_group = new THREE.Group();
  //       curve_group = createChannels(points[0], points[1], intraChannelCurvature, ver_line, i, false);
  //       layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(curve_group);
  //       edges.push(curve_group);
  //     } else {
  //       layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(ver_line);
  //       edges.push(ver_line);
  //       //directed
  //       if (isDirectionEnabled) {
  //         arrowHelper = createArrow(points, edgeColor, null, false);
  //         const group = new THREE.Group();
  //         group.add( ver_line);
  //         group.add( arrowHelper );
  //         layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(group);
  //         edges[i] = group;
  //       }
  //     }
  //   } else { // identify between-layer edges
  //     edgeObjects.push(new Edge({id: i, source: edgePairs_source[i], target: edgePairs_target[i],
  //       color: edgeColor, weight: edgeValues[i], interLayer: true}));

  //     edges.push(i); //pushing this to keep count of edges for redraw // TODO remove
  //     layer_edges_pairs.push(i);
  //     edgeChannels &&  layer_edges_pairs_channels.push(edgeChannels[i]); 
  //   }
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

// t is a random percentage that has been set after tries
// t is a factor between 0-1
const createChannels = (p1, p2, t, ver_line, group_pos, isLayerEdges) => {
  let arrowHelper;
  temp_channels = [];
  if (isLayerEdges)
    temp_channels = layer_edges_pairs_channels[group_pos];
  else
    temp_channels = edgeChannels[group_pos];
  
  
  let curve_group = new THREE.Group();
  if (temp_channels.length === 1) {
    ver_line.userData.tag = temp_channels[0];
    ver_line.visible = channelVisibility[ver_line.userData.tag];
    color = getChannelColor(group_pos, ver_line.userData.tag, isLayerEdges);
    !color && (color = channelColors[ver_line.userData.tag]);
    ver_line.material.color = new THREE.Color(color);
    curve_group.add(ver_line);
    if (isDirectionEnabled) {
      arrowHelper = createArrow([p1, p2], color,null, isLayerEdges);
      arrowHelper.userData.tag = temp_channels[0];
      arrowHelper.visible = channelVisibility[ver_line.userData.tag]
      curve_group.add(arrowHelper)
    }
  } else if (temp_channels.length > 1) {
    let ver_line_const = p1.distanceTo(p2) * t;
    let lgth = ver_line_const;
    let curve;
    let color;
    let loopTotal = Math.trunc((temp_channels.length) / 2);
    for (let i = 0; i < loopTotal; i++) {
      lgth = ver_line_const * (loopTotal - i) / loopTotal;

      color = getChannelColor(group_pos, temp_channels[i], isLayerEdges);
      !color && (color = channelColors[temp_channels[i]]);
      curve_group = createCurve(p1, p2, lgth, color, isLayerEdges, curve_group, temp_channels[i]);
    }
    for (let i = 0; i < loopTotal; i++) {
      lgth = ver_line_const * (loopTotal - i) / loopTotal;
      color = getChannelColor(group_pos, temp_channels[loopTotal + i], isLayerEdges);
      !color && (color = channelColors[temp_channels[loopTotal + i]]);
      curve_group = createCurve(p1, p2, -1 * lgth, color, isLayerEdges,curve_group, temp_channels[loopTotal + i]);
    }

    //if numofcurves is even then no verline
    if (temp_channels.length % 2 == 1) {
      ver_line.userData.tag = temp_channels[temp_channels.length - 1];
      ver_line.visible = channelVisibility[ver_line.userData.tag];
      color = getChannelColor(group_pos, ver_line.userData.tag, isLayerEdges);
      !color && (color = channelColors[ver_line.userData.tag]);
      ver_line.material.color = new THREE.Color(color);
      curve_group.add(ver_line);
      if (isDirectionEnabled) {
        arrowHelper = createArrow([p1, p2], color,null, isLayerEdges);
        arrowHelper.userData.tag = temp_channels[temp_channels.length - 1];
        arrowHelper.visible = channelVisibility[ver_line.userData.tag]
        curve_group.add(arrowHelper)
    }
    }
  }
  return curve_group;
}

const createCurve = (p1, p2, lgth, color, isLayerEdges, group, tag) => {
  curve_opacity = isLayerEdges ? interLayerEdgeOpacity : intraLayerEdgeOpacity;
  let p3 = p1.clone();
  let p4 = p2.clone();
  let curve;
  const points = 50;

  p3.addScalar(lgth);
  p4.addScalar(lgth);
  
  if (!isLayerEdges) curve = new THREE.CubicBezierCurve3(transformPoint(p1), transformPoint(p3), transformPoint(p4), transformPoint(p2))
  else curve = new THREE.CubicBezierCurve3(p1,p3,p4,p2)
 

  let curve_points = curve.getPoints(points);
  let curve_geometry = new THREE.BufferGeometry().setFromPoints(curve_points);
  let curve_material;
  // TODO check what i corresponds to
  //if (edgeWidthByWeight) curve_material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edgeValues[i] } );
  //else 
  curve_material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05,  transparent: true, opacity: curve_opacity});
  
  my_curve = new THREE.Line( curve_geometry, curve_material)
  my_curve.userData.tag = tag;
  my_curve.visible = channelVisibility[my_curve.userData.tag];
  group.add(my_curve)

  if (isDirectionEnabled) {
    arrowHelper = createArrow([curve_points[points - 4], curve_points[points - 2]], color, curve_points[points / 2], isLayerEdges);
    arrowHelper.userData.tag = tag;
    arrowHelper.visible = channelVisibility[my_curve.userData.tag]
    group.add(arrowHelper)
  }
  // Create the final object to add to the scene
  return group;
}



// runs constantly on animate
const redrawInterLayerEdges = (showFlag = false) => { // TODO global flag to not even enter
  let i;

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
      redrawInterLayerEdges_new();
      if (waitEdgeRenderFlag) { // locked flags
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

const redrawInterLayerEdges_new = () => {
  console.log("redrawInterLayerEdges_new");
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

  

  // let index1 = 0, index2 = 0, color = "", pos1 = -1, pos2 = -1,
  //   points, geometry, material, arrowHelper, ver_line, curve_group, group;

  // for (let i = 0; i < edgePairs.length; i++) {
  //   if (edgeChannels && edgeChannels[i] && edgeChannels[i].length === 1)
  //     color = channelColors[edgeChannels[i][0]];
  //   else
  //     color = EDGE_DEFAULT_COLOR;

  //   index1 = nodeLayerNames.indexOf(edgePairs_source[i]);
  //   index2 = nodeLayerNames.indexOf(edgePairs_target[i]);
  //   if (nodeGroups[nodeLayerNames[index1]] == nodeGroups[nodeLayerNames[index2]]){ 
  //     points = [];
  //     layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.remove(edges[i]);
  // 		points.push(nodeObjects[index1].getPosition(), nodeObjects[index2].getPosition());
  // 		geometry = new THREE.BufferGeometry().setFromPoints( points );
  //     material = "";
  //     if (exists(selected_edges, i) && selectedEdgeColorFlag)
  //       color = selectedDefaultColor;
  //     else if (edge_attributes !== "" && edgeAttributesPriority) {
  // 	    pos1 = edge_attributes.SourceNode.indexOf(edgePairs_source[i]);
  //       pos2 = edge_attributes.TargetNode.indexOf(edgePairs_target[i]);

  //       if (checkIfAttributeColorExist(edge_attributes, pos1)) //if node not currently selected and exists in node attributes file and color is assigned
  //         color = edge_attributes.Color[pos1]; //edge is intra-layer
  //       else if (checkIfAttributeColorExist(edge_attributes, pos2)) 
  //         color = edge_attributes.Color[pos2];
  //     }
      
  // 		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edgeValues[i]}  );
  // 		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: intraLayerEdgeOpacity}  );
      
  //     ver_line = new THREE.Line(geometry, material);
  //     if (edgeChannels[i]) {
  //       curve_group = new THREE.Group();
  //       curve_group = createChannels(points[0], points[1], intraChannelCurvature, ver_line, i, false);
  //       layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(curve_group);
  //       edges[i] = curve_group;
  //     } else {
  //       layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(ver_line);
  //       edges[i] = ver_line;

  //       if (isDirectionEnabled) { // TODO test if works outside else block above
  //         arrowHelper = createArrow(points, color, null, false);
  //         group = new THREE.Group();
  //         group.add( ver_line);
  //         group.add( arrowHelper );
  //         layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(group);
  //         edges[i] = group;
  //       }
  //     }
  //   }
  // }
}

const transformPoint = (point) => {
  temp = point.x
  point.x = 0
  point.z = temp
  return point
}

const setEdgeColor = () =>{
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
  channel_name = el.id.substring(5);
  channelColors[channel_name] = el.value;
  redrawIntraLayerEdges();
  updateEdgesRShiny();
  return true;
}

const toggleChannelVisibility = (el) => {
  channel_name = el.id.substring(8);
  total_edges = edges.concat(layerEdges);
  toggleChildrenWithTag(channel_name, total_edges, el.checked);
  redrawIntraLayerEdges();
  return true;
}

const toggleChildrenWithTag = (tag, array, new_value) => {
  array.forEach(item => {
    if (item.children && item.children.length > 0) {
      for (let i = 0, l = item.children.length; i < l; i++) {
        if (item.children[i].userData && item.children[i].userData.tag && item.children[i].userData.tag === tag) {
          item.children[i].visible = !new_value;
          channelVisibility[tag] = !new_value;
        }
      }
    }
  });
}

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

const getChannelColor = (i, c, isLayerEdges) => {
  let color, pos = -1;
  if (isLayerEdges) {
    pos = edges.indexOf(layer_edges_pairs[i]);
    j = pos;
  } else j = i;
  if (exists(selected_edges, j) && selectedEdgeColorFlag) {
    return selectedDefaultColor;
  }
  else if (edge_attributes !== "" && edgeAttributesPriority) {
    pos1arr = findIndices(edge_attributes.SourceNode, edgePairs[j]);
    pos2arr = findIndices(edge_attributes.TargetNode, edgePairs[j]);
    pos1arr != -1 && pos1arr.forEach(pos1 => {
      if (checkIfAttributeColorExist(edge_attributes, pos1)){//if node not currently selected and exists in node attributes file and color is assigned
        if (edge_attributes.Channel[pos1] === c) {
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        }
      }
    });
    pos2arr != -1 && pos2arr.forEach(pos2 => {
      if (checkIfAttributeColorExist(edge_attributes, pos2)) {
        if (edge_attributes.Channel[pos2] === c) {
          color = edge_attributes.Color[pos2];
        }
      }
    });
  }

  if (color && edge_attributes && edge_attributes.Channel) {
    return color;
  }
  return undefined;
}

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
const toggleChannelCurvature = (message) => {
  intraChannelCurvature = message;
  redrawIntraLayerEdges();
  return true;
}

const interToggleChannelCurvature = (message) => {
  interChannelCurvature = message;
  redrawIntraLayerEdges();
  return true;
}

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
