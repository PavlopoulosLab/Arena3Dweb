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

        
        // channel
        if (this.channels.length > 0)
            this.createChannels(points); // direction currently included
        else { // if no channel
            this.THREE_Object = new THREE.Line(geometry, material);
            if (isDirectionEnabled)
                this.toggleArrow(points, this.colors[0]);
        }
        
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

    // channel creation
    createChannels(points) {
        let THREE_curveGroup = new THREE.Group(),
            verticalPushConstant, verticalPush, pushForce = 0, pushForceFlag = false, direction = 1,
            curveFactor = this.interLayer ? interChannelCurvature : intraChannelCurvature;

        verticalPushConstant = points[0].distanceTo(points[1]) * curveFactor;
        if (this.channels.length % 2 == 0) // skip straight line
            pushForce = 1;

        for (let i = 0; i < this.channels.length; i++) {
            direction = -1 * direction; // flipping direction
        
            if (pushForceFlag)
                pushForce = pushForce + 1;
            pushForceFlag = !pushForceFlag; // flipping flag to increase pushForce next round
            verticalPush = direction * (verticalPushConstant * pushForce);
            
            THREE_curveGroup = this.createCurve(THREE_curveGroup, points[0], points[1],
                verticalPush, this.colors[i], this.channels[i], this.weights[i]);
        }
        
        this.THREE_Object = THREE_curveGroup;
    }
  
    getChannelColor(c) {
        let color, pos1arr, pos2arr;
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

    createCurve(curveGroup, p1, p2, verticalPush, color, tag, weight) {
        let p3 = p1.clone();
        let p4 = p2.clone();
        let curve, my_curve;
        let points = 50;

        p3.addScalar(verticalPush);
        p4.addScalar(verticalPush);

        if (!this.interLayer)
            curve = new THREE.CubicBezierCurve3(p1, this.transformMiddlePointOnLayer(p3),
            this.transformMiddlePointOnLayer(p4), p2)
        else
            curve = new THREE.CubicBezierCurve3(p1, p3, p4, p2)

        let curve_points = curve.getPoints(points);
        
        let curve_geometry = new THREE.BufferGeometry().setFromPoints(curve_points);
        let curve_material;
        
        if (edgeWidthByWeight)
            curve_material = new THREE.LineBasicMaterial( { color: color, alphaTest: 0.05, transparent: true, opacity: weight } );
        else {
            let curve_opacity = this.interLayer ? interLayerEdgeOpacity : intraLayerEdgeOpacity;
            curve_material = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05,  transparent: true, opacity: curve_opacity});
        }
        
        my_curve = new THREE.Line( curve_geometry, curve_material)
        my_curve.userData.tag = tag;
        my_curve.visible = channelVisibility[my_curve.userData.tag];
        curveGroup.add(my_curve)

        if (isDirectionEnabled)
            curveGroup = this.toggleCurvedArrow(curveGroup, curve_points, points, color, tag) // TODO fix arrow directions
            
        return curveGroup;
    }

    // This functions
    transformMiddlePointOnLayer(point) {
        point.x = 0;
        return(point)
    }

    toggleCurvedArrow(curveGroup, curve_points, points, color, tag) {
        let arrowHelper = this.createArrow([curve_points[points - 20], curve_points[points]],
            color);
        arrowHelper.userData.tag = tag;
        arrowHelper.visible = channelVisibility[tag];
        curveGroup.add(arrowHelper);
        return(curveGroup)
    }

    toggleArrow(points, edgeColor) { // TODO multi channel
        let THREE_arrowHelper, THREE_Group;
        THREE_arrowHelper = this.createArrow(points, edgeColor);
        THREE_Group = new THREE.Group();
        THREE_Group.add(this.THREE_Object);
        THREE_Group.add(THREE_arrowHelper);
        this.THREE_Object = THREE_Group;
    }

    // direction creation
    createArrow(points, edgeColor) { // TODO check and optimize 
        let direction, origin, headLength, headWidth;
            
        direction = points[1].clone().sub(points[0]);
        
        headLength = intraDirectionArrowSize;
        if (this.interLayer)
            headLength = interDirectionArrowSize;
        origin = this.calcPointOnLine(points[1], points[0], headLength);

        headLength = headLength * 500;
        headWidth = headLength / 4;
        
        return(new THREE.ArrowHelper(direction.normalize(), origin, 1, edgeColor, headLength, headWidth))
    }
      
    calcPointOnLine(point1, point2, length) { // TODO check and optimize 
        let x = (1 - length) * point1.x + length * point2.x;
        let y = (1 - length) * point1.y + length * point2.y;
        let z = (1 - length) * point1.z + length * point2.z;
        return(new THREE.Vector3(x, y, z))
    }

    // On animate ======
    redrawEdge() {
        if (this.interLayer)
            scene.remove(this.THREE_Object);
        else
            layers[this.sourceLayerIndex].removeEdge(this.THREE_Object);

        this.drawEdge();
    }

    // R UI controls ======
    setOpacity(value) {
        if (this.THREE_Object.children.length > 0)
            this.THREE_Object.children[0].material.opacity = value;
        else
            this.THREE_Object.material.opacity = value;
    }
}
