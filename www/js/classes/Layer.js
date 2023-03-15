class Layer {
  constructor({id = 1, name = "Layer1",
    position_x = 0, position_y = 0, position_z = 0,
    last_layer_scale = 1, rotation_x = 0, rotation_y = 0, rotation_z = 0,
    floor_current_color = LAYER_DEFAULT_COLOR, geometry_parameters_width = 2 * yBoundMax}) {
      this.plane = "";
      this.sphere = "";

      this.id = id; // TODO counter ++
      this.name = name;
      this.last_layer_scale = last_layer_scale;
      this.floor_current_color = floor_current_color; // TODO rename to importedColor

      this.showNodeLabels = false;
      this.isSelected = false; // TODO check if this over js_selected_layers
      this.isVisible = true; // TODO check if use to not render hidden layers in loops
      this.coordSystem = ["", "", ""];
      this.color = floor_current_color;

      this.createPlane(geometry_parameters_width);
      this.appendCoordSystem();
      this.initTranslatePlane(position_x, position_y, position_z);
      this.initScale(last_layer_scale);
      this.setColor(floor_current_color);

      this.addSphere(geometry_parameters_width, last_layer_scale);
      this.initRotateSphere(rotation_x, rotation_y, rotation_z);
  }

  createPlane(width) {
    let planeGeometry = new THREE.PlaneGeometry(width, width, PLANE_WIDTHSEGMENTS, PLANE_HEIGHTSEGMENTS);
      planeGeometry.rotateY(THREE.Math.degToRad(90));
    let planeMaterial = new THREE.MeshBasicMaterial({
      color: floorCurrentColor,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
  }

  appendCoordSystem() {
    this.coordSystem[0] = this.appendLine(150, 0, 0, "#FB3D2A") // red
    this.coordSystem[1] = this.appendLine(0, 150, 0, "#46FB2A") // green
    this.coordSystem[2] = this.appendLine(0, 0, 150, "#2AC2FB") // blue
    this.toggleCoords(false);
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

  toggleCoords(layerCoordsSwitch) {
    this.coordSystem[0].visible = this.coordSystem[1].visible = 
      this.coordSystem[2].visible = layerCoordsSwitch;
  }

  initTranslatePlane(x, y, z) {
    this.setPosition("x", x);
    this.setPosition("y", y);
    this.setPosition("z", z);
  }

  initScale(value) {
    this.plane.geometry.scale(1, Number(value), Number(value));
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
  
  initRotateSphere(x, y, z) {
    this.setRotation("x", x);
    this.setRotation("y", y);
    this.setRotation("z", z);
  }

  toggleSelection() {
    this.isSelected = !this.isSelected;
  }

  toggleVisibility(flag) {
    this.plane.visible = flag;
  }

  toggleWireframe(flag) {
    this.plane.material.wireframe = flag;
  }

  // transformations
  translateX(x) {
    this.plane.translateX(x);
  }
  
  translateY(y) {
    this.plane.translateY(y);
  }

  translateZ(z) {
    this.plane.translateY(z);
  }

  rotateX(x) {
    this.plane.rotateX(x);
  }
  
  rotateY(y) {
    this.plane.rotateY(y);
  }
  
  rotateZ(z) {
    this.plane.rotateZ(z);
  }

  // setters and getters
  getName() {
    return(this.name);
  }

  setPosition(axis, value) {
    this.plane.position[axis] = value;
  }
  
  getPosition(axis) {
    return(this.plane.position[axis]);
  }
  
  setRotation(axis, value) {
    this.plane.rotation[axis] = value;
  }
  
  getRotation(axis) {
    return(this.plane.rotation[axis]);
  }
  
  getWidth() {
    return(this.plane.geometry.parameters.width);
  }

  setScale(value) {
    let newScaleValue = parseFloat(value) / this.getScale();
    this.plane.geometry.scale(1, newScaleValue, newScaleValue);
    this.last_layer_scale = parseFloat(value);
  }

  getScale() {
    return(this.last_layer_scale);
  }
  
  setColor(color) {
    this.color = color;
    this.plane.material.color = new THREE.Color(color);
  }

  getColor() {
    return(this.color);
  }

  setOpacity(value) {
    this.plane.material.opacity = value;
  }
}
