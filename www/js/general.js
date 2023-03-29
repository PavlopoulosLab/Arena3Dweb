const exists = (array, element) => {
  return(array.some(l => l == element));
}

const getUniqueValues = (array) => {
  return([...new Set(array)]);
}

const getCaseInsensitiveIndices = (array, element) => {
  let indexes = [];
  element = element.toLowerCase(); //case insensitive
  for (let i = 0; i < array.length; i++)
    if (array[i].toLowerCase() === element)
      indexes.push(i);
  return(indexes);
}

const findIndices = (array, element) => {
  let indices = [];
  let idx = array.indexOf(element);
  while (idx != -1) {
    indices.push(idx);
    idx = array.indexOf(element, idx + 1);
  }
  if (indices.length === 0)
    return(-1);
  else
    return(indices);
}

// @param array (object): object Array
// @param uuid (string): unique object id
// @return index (int): returned position of uuid in object array
const findIndexByUuid = (array, uuid) => {
  const index = array.findIndex(object => {
    return object.uuid === uuid;
  });
  return(index);
}

const mapper = (inArr, min, max) => {
  let outArr = [],
      inArr_min = Math.min.apply(Math, inArr),
      inArr_max = Math.max.apply(Math, inArr);
  for (let i = 0; i < inArr.length; i++){
    if (inArr_max - inArr_min !== 0)
      outArr.push((Number(inArr[i]) - inArr_min) * (max - min) / (inArr_max - inArr_min) + min);
    else outArr.push(0.3);
  }
  return(outArr);
}

//random float between two values
const getRandomArbitrary = (min, max) => {
  return Math.random() * (max - min) + min;
}

const checkIfAttributeColorExist = (attributes, pos) => { // TODO remove after edge_attributes removed
  return pos > -1 && attributes.Color !== undefined && attributes.Color[pos] !== "" && attributes.Color[pos] != " " && attributes.Color[pos] != null;
}

const toRadians = (angle) => {
	return angle * (Math.PI / 180);
}

const toDegrees = (radians) => {
  return radians * (180 / Math.PI);
}

const changeColor = (item, color) => { // TODO probably remove after nodes and edges are made into classes
  if (item.type) {
    if (item.type === 'Line' || item.type === 'Mesh') {
      item.material.color = color;
    } else if (item.type === 'Group') {
       item.children.forEach(child => {
          if (child.material) {
            child.material.color = color;
          }
        });
    }
  }
}

const assign2Children = (parent, color, getColorsFromMap) => {
  if (parent.children && parent.children.length > 0) {
    parent.children.forEach(child => {
      if (getColorsFromMap) {
         child.material.color.set(channelColors[child.userData.tag]);
      } else {
        child.material && child.material.color && (child.material.color.set(color));
      }
      
    });
  } else {
    parent.material.color = new THREE.Color(color);
  }
}
