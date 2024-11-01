generateHomeDiv <- function() {
  
  tags$div(
    id = "homeDiv",
    HTML('
      <div id="logo1"></div>
      
      <div id="MainView_tab row" class="main_tabcontent">
      <div class="col-md-4">
      <img src="./images/help/mainview2.png" alt="Main View"
            style="float:left;width:600px;height:522px;margin:5px;margin-right:20px;">
      </div>
      <div class="col-md-8">
        <p class="last_p">
          
          
          Arena3D<sup>web</sup> is the first, fully interactive and dependency-free, web application which allows the
          visualization of multi-layered graphs in 3D space. With Arena3D<sup>web</sup>, users can integrate multiple networks
          in a single view along with their intra- and inter-layer connections. For clearer and more informative views, users
          can choose between a plethora of layout algorithms and apply them on a set of selected layers either individually or
          in combination. Users can align networks and highlight node topological features, whereas each layer as well as the
          whole scene can be translated, rotated and scaled in 3D space. User-selected edge colors can be used to highlight
          important paths, while node positioning, coloring and resizing can be adjusted on-the-fly. In its current version,
          Arena3D<sup>web</sup> supports weighted and unweighted undirected graphs, is written in R, Shiny and Javascript.
          
          <br /><br />
          &#8594; To start using Arena3D<sup>web</sup> click on the <b>File</b> menu tab and upload a network.
          <br /><br />
          
          &#8594; Visit the'),
          actionLink("link_to_examples", "Help/Examples page"),
          HTML(' to download some Arena3D<sup>web</sup> example files.
          <br /><br />
          
          &#8594; Get started by uploading your networks'),
          actionLink("link_to_fileInput", "here."),
          HTML('
          </p>
          <p class="last_p">
    Please ackwnoledge the use of Arena3D<sup>web</sup> by citing the following publications:<br><br>
    - Kokoli, M., Karatzas, E., Baltoumas, F.A., Schneider, R., Pafilis, E., Paragkamian, S., Doncheva, N.T., Jensen, L.J.
    and Pavlopoulos, G., 2022. <br />
      Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks
      supporting multiple directional information channels, clustering analysis and application integration,<br>
    NAR Genomics and Bioinformatics, 5(2), p.lqad053. <br />
   <b>doi:</b> <a href="https://doi.org/10.1093/nargab/lqad053" target="_blank">https://doi.org/10.1093/nargab/lqad053</a>; <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/37260509/" target="_blank">37260509</a>
   <br><br>
   - Karatzas, E., Baltoumas, F.A., Panayiotou, N.A., Schneider, R. and Pavlopoulos, G.A., 2021. <br />
   Arena3D<sup>web</sup>: Interactive 3D visualization of multilayered networks,<br>
   Nucleic Acids
    Research, 49(W1), pp.W36-W45. <br />
    <b>doi:</b> <a href="https://doi.org/10.1093/nar/gkab278" target="_blank">https://doi.org/10.1093/nar/gkab278</a>; <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/33885790/" target="_blank">33885790</a>
        </p>
        </div>
      </div>
      '),
    generateFooter()
  )
}
