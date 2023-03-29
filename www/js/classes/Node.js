class Node {
    constructor({id = 0, name = "", layer = "", nodeLayerName = "",
      position_x = 0, position_y = 0, position_z = 0,
      scale = 1, color = "#FFFFFF", url = "", descr = ""}) {
        this.sphere = "";

        this.id = id;
        this.name = name;
        this.layer = layer;
        this.nodeLayerName = nodeLayerName;
        this.color = color;
        this.importedColor = color;
        this.clusterColor = color;
        this.url = url;
        this.descr = descr;
        this.isSelected = false;
        this.cluster = "";

        this.createSphere(color);
        this.initTranslate(position_x, position_y, position_z)
        this.setScale(scale);
    }
  
    createSphere(nodeColor) {
        let geometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_WIDTHSEGMENTS, SPHERE_HEIGHTSEGMENTS);
        let material = new THREE.MeshStandardMaterial({
            color: nodeColor,
            transparent: true
        });
        this.sphere = new THREE.Mesh(geometry, material);
    }

    initTranslate(x, y, z) {
        this.setPosition("x", x);
        this.setPosition("y", y);
        this.setPosition("z", z);
    }

    // transformations
    translateX(x) {
        this.sphere.translateX(x);
    }
    
    translateY(y) {
        this.sphere.translateY(y);
    }

    translateZ(z) {
        this.sphere.translateZ(z);
    }

    // setters and getters
    getName() {
        return(this.name);
    }

    getLayer() {
        return(this.layer);
    }

    getNodeLayerName() {
        return(this.nodeLayerName);
    }

    getPosition(axis = "") {
        if (axis == "")
            return(this.sphere.position);
        else 
            return(this.sphere.position[axis]);
    }

    getWorldPosition(axis = "") {
        if (axis == "")
            return(this.sphere.getWorldPosition(new THREE.Vector3()));
        else
            return(this.sphere.getWorldPosition(new THREE.Vector3())[axis]);
    }

    getOpacity() {
        return(this.sphere.material.opacity);
    }

    getColor() {
        let color = this.color;
        if (nodeColorPrioritySource == "default")
            color = this.importedColor;
        else if (nodeColorPrioritySource == "cluster")
            color = this.clusterColor;
        return(color);
    }

    getScale() {
        return(this.sphere.scale.x);
    }

    getCluster() {
        return(this.cluster);
    }

    setPosition(axis, value) {
        this.sphere.position[axis] = value;
    }

    setOpacity(value) {
        this.sphere.material.opacity = value;
    }

    setColor(hexColor, clusterMode = false) {
        this.sphere.material.color = new THREE.Color(hexColor);
        this.color = hexColor;
        if (clusterMode)
            this.clusterColor = hexColor;
    }

    setScale(value) {
        this.sphere.scale.x = this.sphere.scale.y = 
            this.sphere.scale.z = value;
    }

    setCluster(clusterName) {
        this.cluster = clusterName;
    }
  }
  