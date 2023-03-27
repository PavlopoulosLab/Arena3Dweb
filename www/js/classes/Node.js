class Node {
    constructor({id = 0, name = "", layer = "",
      position_x = 0, position_y = 0, position_z = 0,
      scale = 1, color = "#FFFFFF", url = "", descr = ""}) {
        this.sphere = "";

        this.id = id;
        this.name = name;
        this.layer = layer;
        this.nodeLayerName = name.concat(layer);
        this.scale = scale;
        this.color = color;
        this.clusterColor = color;
        this.url = url;
        this.descr = descr;
        this.isSelected = false;

        this.createSphere(color);
        this.initTranslate(position_x, position_y, position_z)
        this.initScale(scale);
    }
  
    createSphere() {
        let geometry = new THREE.SphereGeometry();
        let material = new THREE.MeshBasicMaterial({
            color: "white", transparent: true, opacity: 0
        });
        this.sphere = new THREE.Mesh(geometry, material);
    }

    initTranslate(x, y, z) {
        this.setPosition("x", x);
        this.setPosition("y", y);
        this.setPosition("z", z);
    }

    initScale(value) {
        this.sphere.scale.x = this.sphere.scale.y = 
            this.sphere.scale.z = Number(value);
    }

    // setters and getters
    getName() {
        return(this.name);
    }

    setPosition(axis, value) {
        this.sphere.position[axis] = value;
    }
  }
  