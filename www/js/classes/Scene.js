class Scene {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.THREE_Object = new THREE.Scene();
    this.pan = "";
    this.sphere = "";
    this.coordSystem = ["", "", ""];
    this.defaultColor = "#000000";
    this.intervalTimeout = "";
    this.autoRotate = false;
    this.dragging = false;
    this.leftClickPressed = false; // drag translating scene
    this.middleClickPressed = false; // drag rotating scene
    this.axisPressed = ""; // z, x, c
    
    this.addLights();
    this.addPan();
    this.addSphere();
    this.appendCoordSystem();
  }
  
  addLights() {
    this.add(this.createPointLight(1));
    this.add(this.createPointLight(-1));
    this.add(new THREE.AmbientLight(0xffffff));
  }

  createPointLight(orientation) {
    let sphereGeom = new THREE.SphereGeometry();
    let lightObject = new THREE.PointLight(0xffffff, 1, 2 * yBoundMax);
    lightObject.add(new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial({color: 0xffffff})));
    lightObject.position.set(0, orientation * yBoundMax, 0);
    lightObject.rotateX(THREE.Math.degToRad(90));
    return(lightObject)
  }

  addPan() { // scene translations are applied on pan
    let threePan = this.createSphere();
    this.add(threePan);
    this.pan = threePan;
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
  
  addSphere() { // scene rotations are applied on sphere
    let threeSphere = this.createSphere();
    this.pan.add(threeSphere);
    this.sphere = threeSphere;
  }
  
  appendCoordSystem() {
    this.coordSystem[0] = this.appendLine(800, 0, 0, "#FB3D2A") // red
    this.coordSystem[1] = this.appendLine(0, 800, 0, "#46FB2A") // green
    this.coordSystem[2] = this.appendLine(0, 0, 800, "#2AC2FB") // blue
  }
  
  appendLine(x, y, z, color) {
    let points = [];
    points.push(this.getPointPosition(), new THREE.Vector3(x, y, z) );
    points.push(this.getPointPosition(), new THREE.Vector3(-x, -y, -z));
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({color: color});
    let line = new THREE.Line(geometry, material);
    this.sphere.add(line);
    return(line)
  }
  
  toggleCoords(sceneCoordsSwitch) {
    this.coordSystem[0].visible = this.coordSystem[1].visible = 
      this.coordSystem[2].visible = sceneCoordsSwitch;
  }

  exists() {
    return(this.pan !== "");
  }
  
  tiltDefault() {
    this.setRotation("x", THREE.Math.degToRad(15));
    this.setRotation("y", THREE.Math.degToRad(15));
    this.setRotation("z", THREE.Math.degToRad(5));
  }

  addLayer(threePlane) {
    this.sphere.add(threePlane);
  }
  
  translateX(x) {
    this.pan.translateX(x);
  }
  
  translateY(y) {
    this.pan.translateY(y);
  }
  
  translatePanWithArrow(code) {
    if (code == 37) this.translateX(-25); //left
    if (code == 38) this.translateY(25); //up
    if (code == 39) this.translateX(25); //right
    if (code == 40) this.translateY(-25); // down
  }

  translatePanWithMouse(x, y) {
    this.translateX(x - mousePreviousX);
    this.translateY(mousePreviousY - y);
  }

  orbitSphereWithMouse(x, y) {
    let deltaMove = {
      x: x - mousePreviousX,
      y: y - mousePreviousY
    };
 
    let deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(toRadians(deltaMove.y), toRadians(deltaMove.x), 0, 'XYZ'));
        
    this.setQuaternion(deltaRotationQuaternion);
  }

  setQuaternion(deltaRotationQuaternion) {
    this.sphere.quaternion.multiplyQuaternions(deltaRotationQuaternion,
      this.getQuaternion());
  }

  getQuaternion() {
    return(this.sphere.quaternion);
  }

  // direction 1 or -1
  rotate(direction, axis) {
    clearInterval(this.intervalTimeout);
      this.intervalTimeout = setInterval(function() {
      let value = document.getElementsByClassName("canvasSlider")[0].value;
      value = direction * THREE.Math.degToRad(value);
      if (axis == "X")
        scene.rotateX(value);
      else if (axis == "Y")
        scene.rotateY(value);
      else if (axis == "Z")
        scene.rotateZ(value);
      updateSceneSphereRShiny();
      updateVRLayerLabelsRShiny();
      updateNodesRShiny();
    }, 70);
  }

  rotateX(x) {
    this.sphere.rotateX(x);
  }
  
  rotateY(y) {
    this.sphere.rotateY(y);
  }
  
  rotateZ(z) {
    this.sphere.rotateZ(z);
  }
  
  recenter() {
    this.pan.position.x = this.pan.position.y = 0;
  }
  
  zoom(deltaY) {
    let tempScale = this.getScale();
    if (deltaY < 0 && tempScale < 2)
      tempScale = tempScale * 1.1;
    else if (deltaY > 0 && tempScale > 0.2)
      tempScale = tempScale * 0.9;
    this.setScale(tempScale);
  }
  
  getPosition(axis) {
    return(this.pan.position[axis]);
  }
  
  setPosition(axis, value) {
    this.pan.position[axis] = value;
  }
  
  getPointPosition() {
    return(this.sphere.position);
  }
  
  getRotation(axis) {
    return(this.sphere.rotation[axis]);
  }
  
  setRotation(axis, value) {
    this.sphere.rotation[axis] = value;
  }
  
  getScale() {
    return(this.pan.scale.x);
  }
  
  setScale(value) {
    this.pan.scale.set(value, value, value);
  }
}
