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
