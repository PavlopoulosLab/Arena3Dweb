class Scene {
  constructor() {
    this.reset();
    // TODO add: sceneCoords
  }
  
  reset() {
    this.THREE_Object = new THREE.Scene();
    this.pan = "";
    this.sphere = "";
  }
  
  add(threeObject) {
    this.THREE_Object.add(threeObject);
  }
  
  remove(threeObject) {
    this.THREE_Object.remove(threeObject);
  }
  
  scale(n) {
    this.pan.scale.set(n, n, n);
  }
  
  addPan(threeObject) {
    this.add(threeObject);
    this.pan = threeObject;
  }
  
  addSphere(threeObject) {
    this.pan.add(threeObject);
    this.sphere = threeObject;
  }
  
  translateX(x) {
    this.pan.translateX(x);
  }
  
  translateY(y) {
    this.pan.translateY(y);
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
    this.pan.position.x = this.pan.position.y = this.pan.position.z = 0;
  }
}
