class Edge {
    constructor({id = 0, source = "", target = "",
        color = "#FFFFFF", weight = "", channel = "", interLayer = false}) {
            this.THREE_Object = "";

            this.id = id;
            this.source = source;
            this.target = target;
            this.color = color;
            this.importedColor = color;
            this.weight = weight; // TODO opacity?
            this.channel = channel; // TODO check if [] works better
            this.interLayer = interLayer;

            this.isSelected = false;
        
            this.createLine(color);
        }

    createLine(edgeColor) {
        this.THREE_Object = "" // TODO
    }

    toggleArrow() {
        this.THREE_Object = "" // TODO
    }
}
