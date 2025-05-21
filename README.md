<!-- Badges -->

[![Docker Pulls](https://img.shields.io/docker/pulls/pavlopouloslab/arena3dweb.svg)](https://hub.docker.com/r/pavlopouloslab/arena3dweb)
[![Shiny App](https://img.shields.io/badge/Shiny-online-brightgreen)](https://www.arena3d.org)
[![GitHub Repo](https://img.shields.io/badge/GitHub-PavlopoulosLab%2FArena3Dweb-blue)](https://github.com/PavlopoulosLab/Arena3Dweb)

# Arena3D<sup>web</sup>

> Fully interactive, dependency-free 3D visualization of multilayered networks.

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Getting Started](#getting-started)

   * [Online Demo](#online-demo)
   * [Local Installation](#local-installation)
4. [Example Data](#example-data)
5. [Usage](#usage)
6. [Citing Arena3D<sup>web</sup>](#citing-arena3dweb)
7. [License](#license)

---

## 📝 Overview

Arena3D<sup>web</sup> is a web application built with R/Shiny and JavaScript for visualizing multilayered graphs in 3D space, without external dependencies. Integrate multiple networks into a single scene, explore intra- and inter-layer connections, and manipulate the view in real time, including VR mode.

---

## 🚀 Key Features

* **Multi-layer integration**: Load and combine multiple network layers with cross-layer edges.
* **3D Interactivity**: Translate, rotate, and scale the scene or individual layers; VR mode supported.
* **Rich layouts & clustering**: Apply and customize layouts (force-directed, circular, grid) and clustering algorithms on selected layers.
* **Dynamic styling**: Adjust node size, color, and edge colors on-the-fly to highlight important paths or topological features.
* **Themes & export**: Choose from three premade themes; export/import sessions in JSON; download high-resolution snapshots.
* **Graph support**: Handle weighted/unweighted, directed/undirected, and multi-channel graphs up to 10,000 edges (online); unlimited locally.
* **API access**: Open networks directly from external applications via REST endpoint.

---

## 🛠 Getting Started

### Online Demo

Access the live app at: [https://www.arena3d.org](https://www.arena3d.org)

### Local Installation

#### Docker (Recommended)

```bash
# Pull the Docker image
docker pull pavlopouloslab/arena3dweb
# Run the container (port 3838)
docker run -p 3838:3838 pavlopouloslab/arena3dweb
```

#### From Source

1. Clone the repo:

   ```bash
   ```

git clone [https://github.com/PavlopoulosLab/Arena3Dweb.git](https://github.com/PavlopoulosLab/Arena3Dweb.git)
cd Arena3Dweb

````
2. Install R (>=4.0) and RStudio.
3. Install required R packages:
   ```r
install.packages(c(
  "shiny", "shinyjs", "shinythemes",
  "igraph", "RColorBrewer",
  "jsonlite", "tidyr"
))
````

4. Open **Arena3Dweb.Rproj** in RStudio.
5. Open **server.R**, select **Run External**, then click **Run App**.

---

## 📂 Example Data

Find downloadable example files in the `www/data/` folder:

* **TSV** files for "Upload Network" format
* **JSON** files for "Load Session" format

---

## 💻 Usage

1. **Upload** network files or load a saved session.
2. **Select** layers to apply layouts or clustering.
3. **Interact** with the 3D scene: pan, zoom, rotate, enter VR.
4. **Customize** node/edge styling and themes.
5. **Export** snapshots or session JSON for later reuse.

---

## 📚 Citing Arena3D<sup>web</sup>

* **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks**
  Karatzas E., Baltoumas F.A., Panayiotou N.A., Schneider R., Pavlopoulos G.A.
  *Nucleic Acids Research*, 2021;49(W1)\:W36–W45.
  doi: [10.1093/nar/gkab278](https://doi.org/10.1093/nar/gkab278)

* **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks supporting multiple directional information channels, clustering analysis and application integration**
  Kokoli M., Karatzas E., Baltoumas F.A., Schneider R., Pafilis E., Paragkamian S., Doncheva N.T., Jensen L.J., Pavlopoulos G.A.
  *NAR Genomics and Bioinformatics*, 2022;5(2)\:lqad053.
  doi: [10.1093/nargab/lqad053](https://doi.org/10.1093/nargab/lqad053)

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.
