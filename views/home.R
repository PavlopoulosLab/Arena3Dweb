generateHomeDiv <- function() {
  
    tags$div(
      id = "homeDiv",
      HTML('
        <style>
  div {
    font-family: Arial;
  }

  a {
    color: lightblue;
  }

  footer {
    font-family: Arial;
    position: fixed;
    bottom: 0;
    width: 100%;
    background-color: #2b4e99;
    text-align: center;
    font-size: 18px;
    margin-left: -8px;
    color: white;
  }

  p {
    display: inline-block;
    width: 90%;
    word-break: break-word;
    font-family: Arial;
    line-height: 1.6;
  }

  .last_p {
    margin-bottom: 350px;
  }

  .main_tabcontent {
    padding: 1%;
    width: 100%;
    height: 100%;
    float: left;
    word-break: break-word;
    background-color: black;
    color: white;
    margin-top: -4px;
    text-align: justify;
  }

  #logo1 {
    background-image: url(../images/logo.png);
    background-repeat: no-repeat;
    background-position: center;
    width: 200px;
    height: 48px;
    position: relative;
    z-index: 1;
    float: right;
    margin-top: 25px;
    margin-right: 10px;
  }
</style>

<div id="logo1"></div>

<div id="MainView_tab" class="main_tabcontent">
  <p class="last_p">
    <img src="../images/help/mainview2.png" alt="Main View"
      style="float:left;width:600px;height:522px;margin:5px;margin-right:20px;">
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
    &#8594; Follow this <a href="examples.html" target="_blank">link</a> or visit the <b>Help</b> page to download some
    Arena3D<sup>web</sup> example files.
  </p>
  <br /><br />
</div>
      '),
      generateFooter()
  )
}
