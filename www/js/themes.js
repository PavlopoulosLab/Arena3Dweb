// Objects theme setter
// @return void
const applyTheme = (bgColor, floorColor, edgeColor, labelColor, theme_colors, channel_colors_theme) =>{
  if (scene_sphere != "") {
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

  lightThemeButton.addEventListener("click", () => {applyTheme('#ffffff', '#8aa185', '#5c5c5c', '#000000', lightColors, channel_colors_dark)});
  darkThemeButton.addEventListener("click", () => {applyTheme('#000000', '#777777', '#ffffff', '#ffffff', darkColors, channel_colors_light)});
  grayThemeButton.addEventListener("click", () => {applyTheme('#999999', '#1d4991', '#6e2a5a', '#ffffff', grayColors, channel_colors_light)});

  themeDiv.appendChild(lightThemeButton);
  themeDiv.appendChild(darkThemeButton);
  themeDiv.appendChild(grayThemeButton);
}
