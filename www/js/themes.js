// Objects theme setter
// @return void
const applyTheme = (bgColor, floorColor, edgeColor, labelColor, theme_colors, channel_colors_theme) =>{
  if (scene.exists()) {
    colors = theme_colors.concat(default_colors);
    channel_colors = channel_colors_theme;
    createChannelColorMap();
    setSceneColor(bgColor);
    updateScenePanRShiny();
    setFloorColor(floorColor);
    attachChannelEditList();
    updateLayersRShiny();
    edgeDefaultColor = edgeColor; // global for inter-layer edges
    setEdgeColor();
    updateEdgesRShiny();
    globalLabelColor = labelColor;
    setLabelColor();
    updateLabelColorRShiny();
    updateNodesRShiny();
    redrawEdges();
  }
}

// Attach buttons to theme selector div
// @return void
const attachThemeButtons = () =>{
  let themeDiv = document.getElementById("themeDiv"),
    lightThemeButton = document.createElement("button"),
    darkThemeButton = document.createElement("button"),
    grayThemeButton = document.createElement("button");
  
  lightThemeButton.className = "themeButton";
  lightThemeButton.id = "lightThemeButton";
  lightThemeButton.innerHTML = "Light";
  
  darkThemeButton.className = "themeButton";
  darkThemeButton.id = "darkThemeButton";
  darkThemeButton.innerHTML = "Dark";
  
  grayThemeButton.className = "themeButton";
  grayThemeButton.id = "grayThemeButton";
  grayThemeButton.innerHTML = "Gray";

  lightThemeButton.addEventListener("click", () => {applyTheme('#ffffff', '#8aa185', '#5c5c5c', '#000000', lightColors, CHANNEL_COLORS_DARK)});
  darkThemeButton.addEventListener("click", () => {applyTheme('#000000', '#777777', '#ffffff', '#ffffff', darkColors, CHANNEL_COLORS_LIGHT)});
  grayThemeButton.addEventListener("click", () => {applyTheme('#999999', '#1d4991', '#6e2a5a', '#ffffff', grayColors, CHANNEL_COLORS_LIGHT)});

  themeDiv.appendChild(lightThemeButton);
  themeDiv.appendChild(darkThemeButton);
  themeDiv.appendChild(grayThemeButton);
}
