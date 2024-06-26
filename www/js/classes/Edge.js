class Edge {
    constructor({id = 0, source = "", target = "",
        colors = [EDGE_DEFAULT_COLOR], weights = [], channels = [],
        interLayer = false}) {
            this.THREE_Object = "";
            this.sourceNodeIndex = "";
            this.targetNodeIndex = "";
            this.sourceLayerIndex = "";
            this.targetLayerIndex = "";

            this.id = id;
            this.source = source;
            this.target = target;
            this.name = this.source.concat("---").concat(this.target);
            this.colors = colors;
            this.importedColors = colors;
            this.weights = weights;
            this.channels = channels;
            this.interLayer = interLayer;

            this.isSelected = false;
        
            this.initIndexVariables();
            this.drawEdge();
        }

    initIndexVariables() {
        this.sourceNodeIndex = nodeLayerNames.indexOf(this.source);
        this.targetNodeIndex = nodeLayerNames.indexOf(this.target);
        this.sourceLayerIndex = layerGroups[nodeGroups[nodeLayerNames[this.sourceNodeIndex]]];
        this.targetLayerIndex = layerGroups[nodeGroups[nodeLayerNames[this.targetNodeIndex]]];
    }

    drawEdge() {
        let points = this.decidePoints();
        
        if (this.channels.length === 0)
            this.createEdge(points);
        else
            this.createChannels(points);
        
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

    createEdge(points) {
        let geometry, color, opacity, material;

        geometry = new THREE.BufferGeometry().setFromPoints(points);
        color = this.decideColor();
        opacity = this.decideOpacity();
        material = new THREE.LineBasicMaterial({
            color: color, alphaTest: 0.05, transparent: true, opacity: opacity
        });

        this.THREE_Object = new THREE.Line(geometry, material);

        if (isDirectionEnabled && (opacity !== 0))
            this.createArrow(points, color);
    }

    decideColor(i = 0, forExport = false) {
        let color = EDGE_DEFAULT_COLOR;

        if (!forExport && this.isSelected && selectedEdgeColorFlag)
            color = SELECTED_DEFAULT_COLOR;
        else if (this.channels.length > 0 && !edgeFileColorPriority)
            color = channelColors[this.channels[i]];
        else if (edgeFileColorPriority)
            color = this.importedColors[i];

        return(color)
    }

    decideOpacity(i = 0) {
        let opacity;

        if (edgeWidthByWeight)
            opacity = this.weights[i];
        else 
            opacity = this.interLayer ? interLayerEdgeOpacity : intraLayerEdgeOpacity;

        return(opacity)
    }

    createArrow(points, arrowColor) {
        let THREE_arrowHelper, THREE_Group;
        THREE_arrowHelper = this.createArrowHelper(points, arrowColor);
        THREE_Group = new THREE.Group();
        THREE_Group.add(this.THREE_Object);
        THREE_Group.add(THREE_arrowHelper);
        this.THREE_Object = THREE_Group;
    }

    createArrowHelper(points, edgeColor) {
        let direction = points[1].clone().sub(points[0]),
            origin = points[1],
            length = 1, headLength, headWidth;
            
        headLength = this.interLayer ? interDirectionArrowSize : intraDirectionArrowSize;
        headLength = headLength * 6;
        headWidth = headLength / 4;
        
        return(new THREE.ArrowHelper(direction.normalize(), origin, length, edgeColor, headLength, headWidth))
    }
    
    // Channels ======
    createChannels(points) {
        let THREE_curveGroup = new THREE.Group(),
            verticalPushConstant, verticalPush, pushForce = 0, pushForceFlag = false, direction = 1,
            curveFactor = this.interLayer ? interChannelCurvature : intraChannelCurvature,
            color, opacity;

        verticalPushConstant = points[0].distanceTo(points[1]) * curveFactor / 400;
        if (this.channels.length % 2 == 0) // skip straight line
            pushForce = 1;

        for (let i = 0; i < this.channels.length; i++) {
            direction = -1 * direction; // flipping direction
        
            if (pushForceFlag)
                pushForce = pushForce + 1;
            pushForceFlag = !pushForceFlag; // flipping flag to increase pushForce next round
            
            verticalPush = direction * (verticalPushConstant * pushForce);
            color = this.decideColor(i);
            opacity = this.decideOpacity(i);

            THREE_curveGroup = this.createCurve(THREE_curveGroup, points[0], points[1],
                verticalPush, color, this.channels[i], opacity);
        }
        
        this.THREE_Object = THREE_curveGroup;
    }

    createCurve(curveGroup, p1, p2, verticalPush, color, channelName, opacity) {
        let p3 = p1.clone(), p4 = p2.clone(),
            curve, curvePoints, points = 50,
            curveLine, curveGeometry, curveMaterial;

        p3.addScalar(verticalPush);
        p4.addScalar(verticalPush);

        if (!this.interLayer)
            curve = new THREE.CubicBezierCurve3(p1, this.transformMiddlePointOnLayer(p3),
            this.transformMiddlePointOnLayer(p4), p2)
        else
            curve = new THREE.CubicBezierCurve3(p1, p3, p4, p2)

        curvePoints = curve.getPoints(points);
        curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        curveMaterial = new THREE.LineBasicMaterial({ color: color, alphaTest: 0.05, transparent: true, opacity: opacity });
        curveLine = new THREE.Line(curveGeometry, curveMaterial)
        curveLine.userData.tag = channelName;
        curveLine.visible = channelVisibility[channelName];
        curveGroup.add(curveLine);

        if (isDirectionEnabled && (opacity !== 0))
            curveGroup = this.createCurvedArrow(curveGroup, curvePoints, points, color, channelName)
            
        return curveGroup;
    }

    // This function helps place arrow lines onto the layer instead of through it
    transformMiddlePointOnLayer(point) {
        point.x = 0;
        return(point)
    }

    createCurvedArrow(curveGroup, curvePoints, points, color, channelName) {
        let arrowHelper = this.createArrowHelper(
            [curvePoints[points - 4], curvePoints[points - 1]],
            color
        );
        arrowHelper.userData.tag = channelName;
        arrowHelper.visible = channelVisibility[channelName];
        curveGroup.add(arrowHelper);
        return(curveGroup)
    }

    // On animate ======
    redrawEdge() {
        if (this.interLayer)
            scene.remove(this.THREE_Object);
        else
            layers[this.sourceLayerIndex].removeEdge(this.THREE_Object);

        if ((!this.interLayer) ||
            (this.interLayer && this.areLayersNotHidden()))
                this.drawEdge();
    }

    areLayersNotHidden() {
        return(layers[this.sourceLayerIndex].isVisible &&
            layers[this.targetLayerIndex].isVisible)
    }

    select() {
        this.isSelected = true;
    }
    
    deselect() {
        this.isSelected = false;
    }
}
