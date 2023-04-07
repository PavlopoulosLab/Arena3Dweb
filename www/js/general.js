const exists = (array, element) => {
  return(array.some(l => l == element))
};

const getUniqueValues = (array) => {
  return([...new Set(array)])
};

const getCaseInsensitiveIndices = (array, element) => {
  let indexes = [];
  element = element.toLowerCase(); //case insensitive
  for (let i = 0; i < array.length; i++)
    if (array[i].toLowerCase() === element)
      indexes.push(i);

  return(indexes)
};

// @param array (object): object Array
// @param uuid (string): unique object id
// @return index (int): returned position of uuid in object array
const findIndexByUuid = (array, uuid) => {
  const index = array.findIndex(object => {
    return(object.uuid === uuid)
  });

  return(index)
};

// random float between two values
const getRandomArbitrary = (min, max) => {
  return(Math.random() * (max - min) + min)
};

const toRadians = (angle) => {
	return(angle * (Math.PI / 180))
};

// needed to correctly recenter network for VR
// and for zoom in/out inter edge rendering
const delay_ms = ms => new Promise(res => setTimeout(res, ms));
