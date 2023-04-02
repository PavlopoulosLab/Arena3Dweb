class Edge {
    constructor({id = 0, source = "", target = "",
        colors = ["#FFFFFF"], weights = [], channels = [],
        interLayer = false}) {
            this.THREE_Object = "";

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

    createGeometry() {
        if (this.interLayer)
            this.THREE_Object = "" // TODO
        else
            this.createIntraLayerEdge()
    }

    createIntraLayerEdge() { // TODO multi-channel
        let index1, index2, layerId,
            points = [], geometry, material, line;
        index1 = nodeLayerNames.indexOf(this.source);
        index2 = nodeLayerNames.indexOf(this.target);
        layerId = layerGroups[nodeGroups[nodeLayerNames[index1]]];

        points.push(nodeObjects[index1].getPosition(), nodeObjects[index2].getPosition());
        geometry = new THREE.BufferGeometry().setFromPoints(points);
        material = new THREE.LineBasicMaterial({
            color: this.colors[0], alphaTest: 0.05, transparent: true, opacity: this.weights[0]
        });
        line = new THREE.Line(geometry, material);
        
        layers[layerId].addEdge(line);
    }

    toggleArrow() {
        this.THREE_Object = "" // TODO
    }
}
