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
    applyTheme('#ffffff', '#8aa185', '#5c5c5c',
    CHANNEL_COLORS_DARK, '#000000')
  });
  darkThemeButton.addEventListener("click", () => {
    applyTheme('#000000', '#777777', '#ffffff',
    CHANNEL_COLORS_LIGHT, '#ffffff')
  });
  grayThemeButton.addEventListener("click", () => {
    applyTheme('#999999', '#1d4991', '#6e2a5a',
    CHANNEL_COLORS_LIGHT, '#ffffff')
  });

  themeDiv.appendChild(lightThemeButton);
  themeDiv.appendChild(darkThemeButton);
  themeDiv.appendChild(grayThemeButton);
};

const applyTheme = (bgColor, floorColor,
  edgeColor, channel_colors_theme, labelColor,
  fromInit = false) => {
    if (scene.exists()) {
      setRendererColor(bgColor);
      document.getElementById("floor_color").value = floorColor;
      EDGE_DEFAULT_COLOR = edgeColor; // global for inter-layer edges
      assignChannelColorsFromPalette(channel_colors_theme);
      globalLabelColor = labelColor;

      if (!fromInit) {
        repaintLayersFromPicker();
        attachChannelEditList(); // for new channel colors
        document.getElementById("edgeFileColorPriority").checked = false;
        edgeFileColorPriority = false;
        redrawIntraLayerEdges();
        setLabelColor();
    
        updateScenePanRShiny();
        updateLayersRShiny();
        updateNodesRShiny();
        updateVRNodesRShiny();
        updateEdgeColorsRShiny();
        updateLabelColorRShiny();
      }
    }
};
