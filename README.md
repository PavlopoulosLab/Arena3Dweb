
# Arena3D<sup>web</sup>

Arena3D<sup>web</sup> is a fully interactive and dependency-free web application which allows the visualization of multilayered graphs in 3D space. With Arena3D<sup>web</sup> users can integrate multiple networks in a single view along with their intra- and inter-layer connections. For clearer and more informative views, users can choose between a plethora of layout and clustering algorithms and apply them on a set of selected layers either individually or in combination. Users can align networks and highlight node topological features, whereas each layer as well as the whole scene can be translated, rotated and scaled in 3D space, as well as opened in VR mode. User-selected edge colors can be applied to highlight important paths, while node positioning, coloring and resizing can be adjusted on-the-fly. In its current version, Arena3D<sup>web</sup> offers three premade themes, allows JSON format import/export, supports weighted/unweighted, directed/undirected graphs and multi-channel graphs, as well as offers an API endpoint to open networks from external applications. Arena3D<sup>web</sup> is mainly written in R, Shiny and JavaScript and is available at https://arena3d.org.

The online version supports networks of up to 10000 edges. Here, you can download the app and run it locally. The edge limit can be bypassed when running the application locally, by adjusting the **max_allowed_edges** variable value in the **global.R** file. Example files can be found in the **www/html/data folder**.

# Installation

* Download and install the Arena3D<sup>web</sup> image from Docker Hub: https://hub.docker.com/r/pavlopouloslab/arena3dweb

* Otherwise, download this GitHub repo and run Arena3D<sup>web</sup> via RStudio. R (https://www.r-project.org/) and RStudio (https://rstudio.com/) must be installed. Make sure the following R libraries are also installed: **shiny**, **shinyjs**, **shinythemes**, **igraph**, **RColorBrewer**, **jsonlite** and **tidyr**. To start the program, double click on the **Arena3Dweb.Rproj** file. This opens the RStudio process. Then, open the **server.R** file in RStudio and in the Run App options choose "Run External" and then click Run App.

# Cite

1. Latest publication (bioRxiv): "**Arena3D<sup>web</sup>: Interactive 3D visualization of multilayered networks supporting multiple directional information channels, clustering analysis and application integration**" https://www.biorxiv.org/content/10.1101/2022.10.01.510435v2.abstract
Kokoli, M., Karatzas, E., Baltoumas, F.A., Schneider, R., Pafilis, E., Paragkamian, S., Doncheva, N.T., Jensen, L.J. and Pavlopoulos, G., 2022. Arena3Dweb: Interactive 3D _visualization_ of multilayered networks supporting multiple directional information channels, clustering analysis and application integration. _bioRxiv_.
https://doi.org/10.1101/2022.10.01.510435

2. Nucleic Acids Research article "**Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks**" https://academic.oup.com/nar/article/49/W1/W36/6246395
Karatzas, E., Baltoumas, F.A., Panayiotou, N.A., Schneider, R. and Pavlopoulos, G.A., 2021. Arena3Dweb: Interactive 3D visualization of multilayered networks. _Nucleic Acids Research_, _49_(W1), pp.W36-W45. https://doi.org/10.1093/nar/gkab278
