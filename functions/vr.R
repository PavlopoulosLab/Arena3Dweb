# void function that creates the user-specific VR ply file
# and moves it to the api folder
producePLY <- function(id){
  filename <- paste0('tmp/', id, '.ply')
  con <- file(filename)
  open(con, "w")
  cat(sprintf("ply
format ascii 1.0
element vertex "), file = con)
  # number of nodes
  js_nodes <- as.data.frame(fromJSON(input$js_nodes_world))
  cat(sprintf("%d", nrow(js_nodes)), file = con)
  cat(sprintf("\nproperty float x
property float y
property float z
property uint8 red
property uint8 green
property uint8 blue
element edge "), file = con)
  # number of edges
  js_edge_pairs <- as.data.frame(fromJSON(input$js_edge_pairs))
  cat(sprintf("%d", nrow(js_edge_pairs)), file = con)
  cat(sprintf("\nproperty int vertex1
property int vertex2
property uint8 red
property uint8 green
property uint8 blue
end_header\n"), file = con)
  
  # node parsing
  js_nodes$V3 <- as.numeric(js_nodes$V3)/VR_DOWNSCALE_FACTOR
  js_nodes$V4 <- as.numeric(js_nodes$V4)/VR_DOWNSCALE_FACTOR
  js_nodes$V5 <- as.numeric(js_nodes$V5)/VR_DOWNSCALE_FACTOR - 5
  # js_nodes$V6 <- as.numeric(js_nodes$V6) # scale
  
  for (i in 1:nrow(js_nodes)){
    rgbColor <- col2rgb(js_nodes[i, 7]) # 7th col is node color
    cat(sprintf("%f %f %f %s %s %s\n",
                js_nodes[i, 3], js_nodes[i, 4], js_nodes[i, 5],
                rgbColor[1], rgbColor[2], rgbColor[3]), file = con) # r,g,b
  }
  node_names <- paste0(js_nodes[,1], "_", js_nodes[,2])
  # edge parsing
  for (i in 1:nrow(js_edge_pairs)){
    rgbColor <- col2rgb(js_edge_pairs[i, 3]) # 3rd col is edge color
    edge <- strsplit(js_edge_pairs[i, 1], "---")[[1]]
    nodeIndex1 <- match(edge[1], node_names) - 1 # starting from index 0
    nodeIndex2 <- match(edge[2], node_names) - 1
    cat(sprintf("%s %s %s %s %s\n",
                nodeIndex1, nodeIndex2, # from,to
                rgbColor[1], rgbColor[2], rgbColor[3]), file = con) # r,g,b
  }
  close(con)
}

# void function that creates the user-specific VR html file
# and moves it to the api folder
produceHTML <- function(id){
  js_layers <- as.data.frame(fromJSON(input$js_layers_world))
  js_layers$V2 <- as.numeric(js_layers$V2)/VR_DOWNSCALE_FACTOR # pos x
  js_layers$V3 <- as.numeric(js_layers$V3)/VR_DOWNSCALE_FACTOR + 1.5 # pos y
  js_layers$V4 <- as.numeric(js_layers$V4)/VR_DOWNSCALE_FACTOR - 5 # pos z

  layers_string <- ""
  for (i in 1: nrow(js_layers)){
    temp_str <- sprintf('<a-entity text-sprite="text:%s" scale="0.2 0.2 0.2" position="%f %f %f"></a-entity>',
                        js_layers[i, 1], js_layers[i, 2], js_layers[i, 3], js_layers[i, 4])
    layers_string <- paste0(layers_string, temp_str, "\n")
  }

  html_string <- paste0('<!DOCTYPE html>
<html>
  <head>
    <script src="https://aframe.io/releases/1.2.0/aframe.min.js"></script>
    <script src="https://unpkg.com/aframe-text-sprite"></script>
    <script src="../aframe-network-component.js"></script>
  </head>
  <body>
    <a-scene background="color: #000000;">
      <a-assets>
        <img id="logo" src="../Arena_logo.png">
      </a-assets>
      <a-entity camera look-controls wasd-controls="acceleration: 5;" position="0 1.6 0.0"></a-entity>
      <a-entity light="type: ambient;"></a-entity>
      <a-plane position="0.0 0.0 -1.0" rotation="-90 0 0" color="#000F1A" height="8" width="8"></a-plane>
      ', layers_string, '
      <a-icosahedron position="0.0 2.0 -1.0" color="#002640" radius="5" wireframe="true" wireframe-linewidth="5"></a-icosahedron>
      <a-image position="0.0 6.2 -1.3" rotation="70 0 0" src="#logo" width="1.0" height="0.5"></a-image>
      <a-image position="0.0 6.2 -0.7" rotation="70 180 0" src="#logo" width="1.0" height="0.5"></a-image>
      <a-network position="0.0 2.0 -0.5" node_size="0.05" edge_opacity="0.2" src="url(../plyfile/', id, ')"></a-network>
    </a-scene>
  </body>
</html>')
  filename <- paste0('tmp/', id, '.html')
  write(html_string, filename) # writing html file to tmp folder
}