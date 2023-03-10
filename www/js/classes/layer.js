class Layer {
  constructor(id = 1, name = "Layer1",
    position_x = 0, position_y = 0, position_z = 0,
    last_layer_scale = 1, rotation_x = 0, rotation_y = 0, rotation_z = 0,
    floor_current_color = LAYER_DEFAULT_COLOR, geometry_parameters_width = 2 * yBoundMax) {
      this.plane = "";
      this.sphere = "";

      this.id = id; // TODO counter ++
      this.name = name;
      this.position_x = position_x; // TODO set three obj parameters
      this.position_y = position_y;
      this.position_z = position_z;
      this.last_layer_scale = last_layer_scale;
      this.rotation_x = rotation_x;
      this.rotation_y = rotation_y;
      this.rotation_z = rotation_z;
      this.floor_current_color = floor_current_color; // TODO rename to importedColor
      this.geometry_parameters_width = geometry_parameters_width;

      // TODO add three object
      this.showNodeLabels = false;
      this.isSelected = false;
      this.coordSystem = ["", "", ""];
      this.color = floor_current_color;

      this.createPlane(geometry_parameters_width);
      this.addSphere(geometry_parameters_width, last_layer_scale);
      this.appendCoordSystem();
  }

  createPlane(width) {
    let planeGeometry = new THREE.PlaneGeometry(width, width, PLANE_WIDTHSEGMENTS, PLANE_HEIGHTSEGMENTS);
      planeGeometry.rotateY(THREE.Math.degToRad(90));
    let planeMaterial = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: layerOpacity,
      side: THREE.DoubleSide,
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);;
  }
  
  addSphere(width, scale) { // label will be attched here
    let threeSphere = this.createSphere();
    this.plane.add(threeSphere);
    threeSphere.translateY(-width / 2);
    threeSphere.translateZ(width / 2);
    threeSphere.position.y = threeSphere.position.y * scale
    threeSphere.position.z = threeSphere.position.z * scale
    this.sphere = threeSphere;
  }

  createSphere() {
    let geometry = new THREE.SphereGeometry();
    let material = new THREE.MeshBasicMaterial(
      {color: "white", transparent: true, opacity: 0}
    );
    let sphere = new THREE.Mesh(geometry, material);
    return(sphere);
  }

  add(threeObject) {
    this.THREE_Object.add(threeObject);
  }
  
  remove(threeObject) {
    this.THREE_Object.remove(threeObject);
  }
  
  appendCoordSystem() {
    this.coordSystem[0] = this.appendLine(150, 0, 0, "#FB3D2A") // red
    this.coordSystem[1] = this.appendLine(0, 150, 0, "#46FB2A") // green
    this.coordSystem[2] = this.appendLine(0, 0, 150, "#2AC2FB") // blue
  }
  
  appendLine(x, y, z, color) {
    let points = [];
    points.push(this.plane.position, new THREE.Vector3(x, y, z) );
    points.push(this.plane.position, new THREE.Vector3(-x, -y, -z));
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({color: color});
    let line = new THREE.Line(geometry, material);
    this.plane.add(line);
    return(line)
  }
}