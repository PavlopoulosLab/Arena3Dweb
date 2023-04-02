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
    }

    toggleArrow() {
        this.THREE_Object = "" // TODO
    }
}
