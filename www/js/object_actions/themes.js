const attachThemeButtons = () => {
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

  lightThemeButton.addEventListener("click", () => {
    applyTheme('#ffffff', '#8aa185', COLOR_VECTOR_LIGHT,
    '#5c5c5c', CHANNEL_COLORS_DARK, '#000000')
  });
  darkThemeButton.addEventListener("click", () => {
    applyTheme('#000000', '#777777', COLOR_VECTOR_DARK,
    '#ffffff', CHANNEL_COLORS_LIGHT, '#ffffff')
  });
  grayThemeButton.addEventListener("click", () => {
    applyTheme('#999999', '#1d4991', COLOR_VECTOR_GRAY,
    '#6e2a5a', CHANNEL_COLORS_LIGHT, '#ffffff')
  });

  themeDiv.appendChild(lightThemeButton);
  themeDiv.appendChild(darkThemeButton);
  themeDiv.appendChild(grayThemeButton);
};

const applyTheme = (bgColor, floorColor, theme_colors,
  edgeColor, channel_colors_theme, labelColor,
  fromInit = false) => {
    if (scene.exists()) {
      setRendererColor(bgColor);
      document.getElementById("floor_color").value = floorColor;
      nodeColorVector = theme_colors.concat(COLOR_VECTOR_271); // TODO probably remove concat and keep only COLOR_VECTOR_271
      edgeDefaultColor = edgeColor; // global for inter-layer edges
      getChannelColorsFromPalette(channel_colors_theme);
      globalLabelColor = labelColor;

      if (!fromInit) {
        repaintLayersFromPicker();
        attachChannelEditList();
        setEdgeColor();
        redrawEdges();
        setLabelColor();
    
        updateScenePanRShiny();
        updateLayersRShiny();
        updateNodesRShiny();
        updateVRNodesRShiny();
        updateEdgesRShiny();
        updateLabelColorRShiny();
      }
    }
};
