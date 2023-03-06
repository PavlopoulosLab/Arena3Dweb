class Scene {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.THREE_Object = new THREE.Scene();
    this.pan = ""; //scene_pan
    this.sphere = ""; //scene_sphere
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
  
  addToPan(threeObject) {
    this.add(threeObject);
    this.pan = threeObject;
  }
}
