class Edge {
    constructor({id = 0, source = "", target = "",
        colors = ["#FFFFFF"], weights = [], channels = [],
        interLayer = false}) {
            this.THREE_Object = "";
            this.sourceNodeIndex = "";
            this.targetNodeIndex = "";
            this.sourceLayerIndex = "";
            this.targetLayerIndex = "";

            this.id = id;
            this.source = source;
            this.target = target;
            this.colors = colors;
            this.importedColors = colors;
            this.weights = weights; // TODO opacity?
            this.channels = channels;
            this.interLayer = interLayer;

            this.isSelected = false; // TODO per channel?
        
            this.createGeometry();
        }

    createGeometry() { // TODO Group object for channels
        this.sourceNodeIndex = nodeLayerNames.indexOf(this.source);
        this.targetNodeIndex = nodeLayerNames.indexOf(this.target);
        this.sourceLayerIndex = layerGroups[nodeGroups[nodeLayerNames[this.sourceNodeIndex]]];
        this.targetLayerIndex = layerGroups[nodeGroups[nodeLayerNames[this.targetNodeIndex]]];
        
        this.drawEdge();        
    }

    drawEdge() {
        let points = [], geometry, opacity, material;

        points = this.decidePoints();
        geometry = new THREE.BufferGeometry().setFromPoints(points);

        opacity = this.decideOpacity();
        material = new THREE.LineBasicMaterial({
            color: this.colors[0], alphaTest: 0.05, transparent: true, opacity: opacity // TODO different colors for channels
        });

        this.THREE_Object = new THREE.Line(geometry, material);

        // channel
        if (this.channels.length > 0)
            this.createChannels(points[0], points[1]);

        if (isDirectionEnabled)
            this.toggleArrow(points, this.colors[0]); // TODO different colors for channels

        if (this.interLayer)
            scene.add(this.THREE_Object);
        else
            layers[this.sourceLayerIndex].addEdge(this.THREE_Object);
    }

    decidePoints() {
        let points = [];

        if (this.interLayer)
            points.push(nodeObjects[this.sourceNodeIndex].getWorldPosition(),
                nodeObjects[this.targetNodeIndex].getWorldPosition());
        else
            points.push(nodeObjects[this.sourceNodeIndex].getPosition(),
                nodeObjects[this.targetNodeIndex].getPosition());

        return(points)
    }

    decideOpacity() {
        let opacity;

        if (edgeWidthByWeight)
            opacity = this.weights[0]; // TODO per channel
        else {
            if (this.interLayer)
                opacity = interLayerEdgeOpacity;
            else
                opacity = intraLayerEdgeOpacity;
        }

        return(opacity)
    }

    redrawEdge() {
        if (this.interLayer)
            scene.remove(this.THREE_Object);
        else
            layers[this.sourceLayerIndex].removeEdge(this.THREE_Object);

        this.drawEdge();
    }

    // t is a random percentage that has been set after tries
    // t is a factor between 0-1
    createChannels(p1, p2) {
        console.log("createChannels")
        
        let arrowHelper,
            temp_channels = [],
            curve_group = new THREE.Group(),
            t = this.interLayer ? interChannelCurvature : intraChannelCurvature;
        
        let group_pos = this.id;
        // if (isLayerEdges)
        //     temp_channels = layer_edges_pairs_channels[group_pos];
        // else
        temp_channels = edgeChannels[group_pos];

        if (temp_channels.length === 1) {
            this.THREE_Object.userData.tag = temp_channels[0];
            this.THREE_Object.visible = channelVisibility[this.THREE_Object.userData.tag];
            let color = this.getChannelColor(group_pos, this.THREE_Object.userData.tag);
            !color && (color = channelColors[this.THREE_Object.userData.tag]);
            this.THREE_Object.material.color = new THREE.Color(color);
            curve_group.add(this.THREE_Object);
            if (isDirectionEnabled) {
                arrowHelper = this.createArrow([p1, p2], color);
                arrowHelper.userData.tag = temp_channels[0];
                arrowHelper.visible = channelVisibility[this.THREE_Object.userData.tag]
                curve_group.add(arrowHelper)
            }
        } else if (temp_channels.length > 1) {
            let ver_line_const = p1.distanceTo(p2) * t;
            let lgth = ver_line_const;
            let color;
            let loopTotal = Math.trunc((temp_channels.length) / 2);
            for (let i = 0; i < loopTotal; i++) {
                lgth = ver_line_const * (loopTotal - i) / loopTotal;

                color = this.getChannelColor(group_pos, temp_channels[i]);
                !color && (color = channelColors[temp_channels[i]]);
                curve_group = this.createCurve(p1, p2, lgth, color, curve_group, temp_channels[i]);
            }
            for (let i = 0; i < loopTotal; i++) {
                lgth = ver_line_const * (loopTotal - i) / loopTotal;
                color = this.getChannelColor(group_pos, temp_channels[loopTotal + i]);
                !color && (color = channelColors[temp_channels[loopTotal + i]]);
                curve_group = this.createCurve(p1, p2, -1 * lgth, color,curve_group, temp_channels[loopTotal + i]);
            }

            //if numofcurves is even then no verline
            if (temp_channels.length % 2 == 1) {
                this.THREE_Object.userData.tag = temp_channels[temp_channels.length - 1];
                this.THREE_Object.visible = channelVisibility[this.THREE_Object.userData.tag];
                color = this.getChannelColor(group_pos, this.THREE_Object.userData.tag);
                !color && (color = channelColors[this.THREE_Object.userData.tag]);
                this.THREE_Object.material.color = new THREE.Color(color);
                curve_group.add(this.THREE_Object);
                if (isDirectionEnabled) {
                    arrowHelper = this.createArrow([p1, p2], color);
                    arrowHelper.userData.tag = temp_channels[temp_channels.length - 1];
                    arrowHelper.visible = channelVisibility[this.THREE_Object.userData.tag]
                    curve_group.add(arrowHelper)
                }
            }
        }
        this.THREE_Object = curve_group;
    }
  
    getChannelColor(i, c) {
        let color, pos = -1, pos1arr, pos2arr;
        // if (isLayerEdges) {
        //     pos = edges.indexOf(layer_edges_pairs[i]);
        //     j = pos;
        // } else
        //     j = i;
        let j = this.id;
        
        if (exists(selected_edges, j) && selectedEdgeColorFlag) {
            return selectedDefaultColor;
        } else if (edge_attributes !== "" && edgeAttributesPriority) {
            pos1arr = findIndices(edge_attributes.SourceNode, edgePairs[j]);
            pos2arr = findIndices(edge_attributes.TargetNode, edgePairs[j]);
            pos1arr != -1 && pos1arr.forEach(pos1 => {
            if (checkIfAttributeColorExist(edge_attributes, pos1)) {//if node not currently selected and exists in node attributes file and color is assigned
                if (edge_attributes.Channel[pos1] === c)
                    color = edge_attributes.Color[pos1]; //edge is intra-layer
            }
            });
            pos2arr != -1 && pos2arr.forEach(pos2 => {
                if (checkIfAttributeColorExist(edge_attributes, pos2)) {
                    if (edge_attributes.Channel[pos2] === c)
                    color = edge_attributes.Color[pos2];
                }
            });
        }

        if (color && edge_attributes && edge_attributes.Channel)
            return color;
        
        return undefined;
    }

    createCurve(p1, p2, lgth, color, group, tag) {
        let curve_opacity = this.interLayer ? interLayerEdgeOpacity : intraLayerEdgeOpacity;
        let p3 = p1.clone();
        let p4 = p2.clone();
        let curve, my_curve, arrowHelper;
        const points = 50;

        p3.addScalar(lgth);
        p4.addScalar(lgth);

        if (!this.interLayer)
            curve = new THREE.CubicBezierCurve3(transformPoint(p1), transformPoint(p3), transformPoint(p4), transformPoint(p2))
        else
            curve = new THREE.CubicBezierCurve3(p1, p3, p4, p2)


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
            arrowHelper = this.createArrow([curve_points[points - 4], curve_points[points - 2]], color, curve_points[points / 2]);
            arrowHelper.userData.tag = tag;
            arrowHelper.visible = channelVisibility[my_curve.userData.tag]
            group.add(arrowHelper)
        }
        // Create the final object to add to the scene
        return group;
    }

    toggleArrow(points, edgeColor) { // TODO multi channel
        let THREE_arrowHelper, THREE_Group;
        THREE_arrowHelper = this.createArrow(points, edgeColor);
        THREE_Group = new THREE.Group();
        THREE_Group.add(this.THREE_Object);
        THREE_Group.add(THREE_arrowHelper);
        this.THREE_Object = THREE_Group;
    }

    createArrow(points, edgeColor, extra_point = null) {
        let origin, length, headLength,
            headLengthPerArrowLength = intraDirectionArrowSize,
            direction = points[1].clone().sub(points[0]);
         
        if (this.interLayer)
            headLengthPerArrowLength = interDirectionArrowSize;
        origin = this.calcPointOnLine(points[1], points[0], headLengthPerArrowLength);

        length  = direction.length();
        if (extra_point) // TODO check if works properly with curve channels
            length = points[1].clone().sub(extra_point).length();
        // we create the arrow in order to have the correct direction 
        // and then change its length size in order to be almost the size of the headLength
        headLength = headLengthPerArrowLength * length;
        length = 1.05 * headLength;
        // in order to keep line's opacity we create only the cone from the arrow
        return(new THREE.ArrowHelper(direction.normalize(), origin, length, edgeColor, headLength))
    }
      
    calcPointOnLine(point1, point2, length) {
        let x = (1 - length) * point1.x + length * point2.x;
        let y = (1 - length) * point1.y + length * point2.y;
        let z = (1 - length) * point1.z + length * point2.z;
        return(new THREE.Vector3(x, y, z))
    }

    setOpacity(value) {
        if (this.THREE_Object.children.length > 0)
            this.THREE_Object.children[0].material.opacity = value;
        else
            this.THREE_Object.material.opacity = value;
    }
}
