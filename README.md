# Arena3Dweb

Efficient integration and visualization of heterogeneous biomedical information in a single view is a key challenge. In this study, we present Arena3Dweb, the first, fully interactive and dependency-free, web application which allows the visualization of multilayered graphs in 3D space. With Arena3Dweb, users can integrate multiple networks in a single view along with their intra- and inter-layer connections. For clearer and more informative views, users can choose between a plethora of layout algorithms and apply them on a set of selected layers either individually or in combination. Users can align networks and highlight node topological features, whereas each layer as well as the whole scene can be translated, rotated and scaled in 3D space. User-selected edge colors can be used to highlight important paths, while node positioning, coloring and resizing can be adjusted on-the-fly. In its current version, Arena3Dweb supports weighted and unweighted undirected graphs, is written in R, Shiny and JavaScript and is available at http://bib.fleming.gr:3838/Arena3D.

For more information please visit our help pages.

The online version supports networks of up to 5000 edges. 
You can always download the app and run it locally. The edge limit can be bypassed when running the application locally, by adjusting the max_allowed_edges variable value in the global.R file
Example files can be found in the www folder.


# Installation

To run Arena3Dweb locally, R (https://www.r-project.org/) and RStudio (https://rstudio.com/) must be installed.

Make sure the following R libraries are also installed: shiny, shinyjs, shinythemes and igraph.

To start the program, double click on the Arena3Dweb.Rproj file. This opens the RStudio process. Then, open the server.R file in RStudio and in the Run App options choose "Run External" and then click Run App.
