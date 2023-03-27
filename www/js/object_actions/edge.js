const createEdgeObjects = () => {
  let index1 = 0, index2 = 0, color = "";
  for (let i = 0; i < edgePairs.length; i++){ //random x,y,z
    color = edgeDefaultColor;
    if (edge_channels && edge_channels[i] && edge_channels[i].length === 1) {
      color = channelColors[edge_channels[i][0]];
    } else {
      color = edgeDefaultColor;
    }
    let points = [];
    let edge_split = edgePairs[i].split("---");
    index1 = nodeLayerNames.indexOf(edge_split[0]);
    index2 = nodeLayerNames.indexOf(edge_split[1]);
    if (nodeGroups[nodeLayerNames[index1]] == nodeGroups[nodeLayerNames[index2]]){ //check if edge inside same Layer
      points.push( nodes[index1].position, nodes[index2].position );
  		let geometry = new THREE.BufferGeometry().setFromPoints( points );
  		let material = "";
  		if (edge_attributes !== "" && edgeAttributesPriority){
  		  pos1 = edge_attributes.SourceNode.indexOf(edge_split[0]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_split[1]);
        if (checkIfAttributeColorExist(edge_attributes, pos1)){ //if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (checkIfAttributeColorExist(edge_attributes, pos2)){ 
          color = edge_attributes.Color[pos2];
        }
      }

  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edgeValues[i] } );
      else material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity });
      let arrowHelper = createArrow(points, color,null, false);
      let ver_line = new THREE.Line(geometry, material);
      if (edge_channels[i]) {
        let curve_group = new THREE.Group();
        curve_group = createChannels(points[0], points[1], channelCurvature, ver_line, i, false);
        layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(curve_group);
        edges.push(curve_group);
      } else {
        layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(ver_line);
        edges.push(ver_line);
        //directed
        if (isDirectionEnabled) {
          const group = new THREE.Group();
          group.add( ver_line);
          group.add( arrowHelper );
          layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(group);
          edges[i] = group;
        }
      }
    } else { //identify between-layer edges
      edges.push(i); //pushing this to keep count of edges for redraw
      layer_edges_pairs.push(i);
      edge_channels &&  layer_edges_pairs_channels.push(edge_channels[i]); 
    }
  }
}

const redrawEdges = () => {
  let index1 = 0, index2 = 0, color = "", pos = -1, pos1 = -1, pos2 = -1,
    edge_split, points, geometry, material, arrowHelper, ver_line, curve_group, group;


  for (let i = 0; i < edgePairs.length; i++) {
    if (edge_channels && edge_channels[i] && edge_channels[i].length === 1) {
      color = channelColors[edge_channels[i][0]];
    } else {
      color = edgeDefaultColor;
    }

    edge_split = edgePairs[i].split("---");
    index1 = nodeLayerNames.indexOf(edge_split[0]);
    index2 = nodeLayerNames.indexOf(edge_split[1]);
    if (nodeGroups[nodeLayerNames[index1]] == nodeGroups[nodeLayerNames[index2]]){ 
      points = [];
      layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.remove(edges[i]);
  		points.push( nodes[index1].position, nodes[index2].position );
  		geometry = new THREE.BufferGeometry().setFromPoints( points );
      material = "";
      if (exists(selected_edges, i) && selectedEdgeColorFlag)
        color = selectedDefaultColor;
      else if (edge_attributes !== "" && edgeAttributesPriority) {
  	    pos1 = edge_attributes.SourceNode.indexOf(edge_split[0]);
        pos2 = edge_attributes.TargetNode.indexOf(edge_split[1]);

        if (checkIfAttributeColorExist(edge_attributes, pos1)) {//if node not currently selected and exists in node attributes file and color is assigned
          color = edge_attributes.Color[pos1]; //edge is intra-layer
        } else if (checkIfAttributeColorExist(edge_attributes, pos2)){ 
          color = edge_attributes.Color[pos2];
        }
      }
      console.log(color);
  		if (edgeWidthByWeight) material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: edgeValues[i]}  );
  		else material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: layerEdgeOpacity}  );
      
      ver_line = new THREE.Line(geometry, material);
      if (edge_channels[i]) {
        curve_group = new THREE.Group();
        curve_group = createChannels(points[0], points[1], channelCurvature, ver_line, i, false);
        layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(curve_group);
        edges[i] = curve_group;
      } else {
        layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(ver_line);
        edges[i] = ver_line;

        if (isDirectionEnabled) { // TODO test if works outside else block above
          arrowHelper = createArrow(points, color, null, false);
          group = new THREE.Group();
          group.add( ver_line);
          group.add( arrowHelper );
          layers[layerGroups[nodeGroups[nodeLayerNames[index1]]]].plane.add(group);
          edges[i] = group;
        }
      }
    }
  }
}

const createArrow = (points, color, extra_point, isInterLayer) => {
  let headLengthPerArrowLength;
  if (color === edgeDefaultColor) {
    color = edgeDefaultColor;
  }
  let direction = points[1].clone().sub(points[0]);
  let length = direction.length();

  if (extra_point) {
    temp_dir = points[1].clone().sub(extra_point);
    length = temp_dir.length();
  }
  if (isInterLayer) headLengthPerArrowLength = directionArrowSize;
  else  headLengthPerArrowLength = intraDirectionArrowSize;

  //in order to keep line's opacity we create only the cone from the arrow
  //we create the arrow in order to have the correct direction and then change its length size in order to be almost the size of the headLength 
  let headLenth = headLengthPerArrowLength * length;
  length = 1.05 * headLenth;
  let origin = calcPointOnLine(points[1], points[0], headLengthPerArrowLength);
  return new THREE.ArrowHelper(direction.normalize(), origin, length, color, headLenth);
}

const calcPointOnLine = (point1, point2, length) => {
  let x = (1 - length) * point1.x + length * point2.x;
  let y = (1 - length) * point1.y + length * point2.y;
  let z = (1 - length) * point1.z + length * point2.z;
  return new THREE.Vector3( x, y, z );
}

const transformPoint = (point) => {
  temp = point.x
  point.x = 0
  point.z = temp
  return point
}

const createCurve = (p1, p2, lgth, color, isLayerEdges, group, tag) => {
  curve_opacity = isLayerEdges ? interLayerEdgeOpacity : layerEdgeOpacity;
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
    arrowHelper = createArrow([curve_points[points - 4], curve_points[points - 2]], color, curve_points[points / 2],isLayerEdges);
    arrowHelper.userData.tag = tag;
    arrowHelper.visible = channelVisibility[my_curve.userData.tag]
    group.add(arrowHelper)
  }
  // Create the final object to add to the scene
  return group;
}

const setEdgeColor = () =>{
  let i;
  // inter-layer edges automatically change from edgeDefaultColor
  for (i=0; i<edges.length; i++) {
    // intra-layer edges
    if (typeof (edges[i]) === 'object') {
      if (edges[i].children && edges[i].children.length > 0) {
        edges[i].children.forEach(child => {
          if (child.material && child.material.color) {
              if (exists(selected_edges, i) && selectedEdgeColorFlag) child.material.color = new THREE.Color(selectedDefaultColor);
              else if (child.userData && child.userData.tag) child.material.color = new THREE.Color(channelColors[child.userData.tag]);
              else child.material.color = new THREE.Color(edgeDefaultColor);
            } else {
              if (child.userData && child.userData.tag) child.setColor(channelColors[child.userData.tag])
              else child.setColor(edgeDefaultColor)
            }
        });
      } else {
        if (exists(selected_edges, i) && selectedEdgeColorFlag) edges[i].material.color = new THREE.Color(selectedDefaultColor);
        else edges[i].material.color = new THREE.Color(edgeDefaultColor);
      } 
    } 
  }
}

// Channels ====================
const changeChannelColor = (el) => {
  channel_name = el.id.substring(5);
  channelColors[channel_name] = el.value;
  redrawEdges();
  updateEdgesRShiny();
  return true;
}

const toggleChannelVisibility = (el) => {
  channel_name = el.id.substring(8);
  total_edges = edges.concat(layerEdges);
  toggleChildrenWithTag(channel_name, total_edges, el.checked);
  redrawEdges();
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

// t is a random percentage that has been set after tries
// t is a factor between 0-1
const createChannels = (p1, p2, t, ver_line, group_pos, isLayerEdges) => {
  let arrowHelper;
  temp_channels = [];
  if (isLayerEdges) {
    temp_channels = layer_edges_pairs_channels[group_pos];
  } else {
    temp_channels = edge_channels[group_pos];
  }
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

const edgeAttributes = (message) => {
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
            assignColor(edge_channels, i, edges[i].children, edge_attributes.Channel[pos1], edge_attributes.Color[pos1], edges[i]);
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
  return true;
}

const setLayerEdgeOpacity = (message) => {
  layerEdgeOpacity = message;
  redrawEdges(); //because not on animate
  return true;
}

const setDirectionArrowSize = (message) => {
  directionArrowSize = message;
  redrawEdges(); //because not on animate
  return true;
}

const setIntraDirectionArrowSize = (message) => {
  intraDirectionArrowSize = message;
  redrawEdges(); //because not on animate
  return true;
}

const setInterLayerEdgeOpacity = (message) => {
  interLayerEdgeOpacity = message;
  return true;
}

const redrawEdgeWidthByWeight = (message) => {
  edgeWidthByWeight = message; //message = true or false
  redrawEdges();
  return true;
}

const edgeFileColorPriority = (message) => {
  edgeAttributesPriority = message; //message = true or false
  if (edgeAttributesPriority) document.getElementById('channelColorPicker').style.display = 'none';
  else document.getElementById('channelColorPicker').style.display = 'block';
  redrawEdges();
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
          assign2Children(layerEdges[pos3], edgeDefaultColor, true);
        } else {
          assign2Children( edges[selected_edges[i]], edgeDefaultColor,  true);
        }   
      }
    } else{
      if (typeof (edges[selected_edges[i]]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        assign2Children(layerEdges[pos3], edgeDefaultColor, true);
      } else {
        assign2Children( edges[selected_edges[i]], edgeDefaultColor, true);

      }
    } 
  }
  return true;
}

const toggleDirection = (message) => {
  isDirectionEnabled = message;
  redrawEdges();
};

// Channels ====================
const toggleChannelCurvature = (message) => {
  channelCurvature = message;
  redrawEdges();
  return true;
}

const interToggleChannelCurvature = (message) => {
  interChannelCurvature = message;
  redrawEdges();
  return true;
}

const toggleInterLayerEdgesRendering = () => {
  let interLayerEdgesRenderPauseButton = document.getElementById('interLayerEdgesRenderPauseButton');
  if (interLayerEdgesRenderPauseFlag) {
    interLayerEdgesRenderPauseFlag = false;
    interLayerEdgesRenderPauseButton.innerText = "Stop:Render Inter-Layer Edges";
  } else {
    interLayerEdgesRenderPauseFlag = true;
    interLayerEdgesRenderPauseButton.innerText = "Render Inter-Layer Edges";
  }
}

const unselectAllEdges = () => {
  let pos1 = pos2 = pos3 = -1;
  for (i = 0; i < edges.length; i++) {
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
          changeColor(layerEdges[pos3], edgeDefaultColor);
        } else changeColor(edges[i], edgeDefaultColor);
      }
    } else {
      if (typeof (edges[i]) == "number") {
        pos3 = layer_edges_pairs.indexOf(i);
        changeColor(layerEdges[pos3], edgeDefaultColor);
      } else
        changeColor(edges[i], edgeDefaultColor);
    } 
  }
};
