generateHelpDiv <- function() {
  tags$div(
    id = "helpDiv",
    HTML('
      <style>
  h2,
  h3,
  a,
  div {
    font-family: Arial;
  }

  a {
    color: lightblue;
  }

  pre {
    font-family: Courier;
    border: 1px solid white;
    width: fit-content;
    max-width: 100%;
    overflow-x: scroll;
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
    font-size: medium;
  }

  .last_p {
    margin-bottom: 350px;
  }

  /* Style the tab */
  .tab {
    overflow: hidden;
    background-color: #f1f1f1;
    position: relative;
    width: 100%;
    display: inline-block;
  }

  /* Style the buttons inside the tab */
  .tab button {
    background-color: inherit;
    float: left;
    border: none;
    outline: none;
    cursor: pointer;
    padding: 14px 16px;
    transition: 0.3s;
    font-size: 17px;
  }

  /* Change background color of buttons on hover */
  .tab button:hover {
    background-color: #ddd;
  }

  /* Create an active/current tablink class */
  .tab button.active {
    background-color: #ccc;
  }

  /* Style the tab content */
  .tabcontent {
    display: none;
    padding: 1%;
    width: 100%;
    height: 100%;
    float: left;
    word-break: break-word;
    background-color: black;
    color: white;
    margin-top: -4px;
    text-align: justify;
    overflow:scroll;
  }

  .numbering {
    color: red;
    font-weight: bold;
    font-size: 18px;
  }

  .indent {
    margin-left: 20px;
  }

  @media only screen and (max-width: 1000px) {
    p {
      width: 100%;
    }

    li {
      width: 100%;
    }

    .tabcontent {
      height: 500px;
    }
  }
</style>

<div class="tab">
  <button class="tablinks" onclick="openTab(event, \'Examples_tab\')" id="defaultOpen">Examples</button>
  <button class="tablinks" onclick="openTab(event, \'API_tab\')">API</button>
  <button class="tablinks" onclick="openTab(event, \'Cytoscape_tab\')">Cytoscape App</button>
  <button class="tablinks" onclick="openTab(event, \'File_tab\')">Input & Output Files</button>
  <button class="tablinks" onclick="openTab(event, \'Navigation_tab\')">Navigation Controls</button>
  <button class="tablinks" onclick="openTab(event, \'Layouts_tab\')">Layer Selection & Layouts</button>
  <button class="tablinks" onclick="openTab(event, \'Scene_tab\')">Scene Actions</button>
  <button class="tablinks" onclick="openTab(event, \'Layer_tab\')">Layer Actions</button>
  <button class="tablinks" onclick="openTab(event, \'Node_tab\')">Node Actions</button>
  <button class="tablinks" onclick="openTab(event, \'Edge_tab\')">Edge Actions</button>
  <button class="tablinks" onclick="openTab(event, \'FPS_tab\')">FPS</button>
  <button class="tablinks" onclick="openTab(event, \'About_tab\')">About</button>
</div>

<div id="File_tab" class="tabcontent">

  <h2>Input & Output Files</h2>
  <p>This is the action panel that allows the user to upload network data as well as export the network in its current
    state.</p> <br />
  <p>
    <img src="./images/help/file.png" alt="File Actions"
      style="float:left;width:282px;height:425px;margin:5px;margin-right:20px;">
    <span class="numbering"> 1.</span> The <i> Upload Network </i> option allows the user to upload network data in the
    Arena3D<sup>web</sup> format. This file consists of 4 mandatory columns with headers <b><i>SourceNode, TargetNode,
        SourceLayer and TargetLayer</i></b> and 2 optional columns with the headers <b><i> Weight and Channel</i></b>.
    After the file is uploaded, the weight
    values are
    mapped in a [0-1] range and relative opacities are assigned to the respective edges. Edge transparency represents
    the weight. The heavier the weight, the higher the opacity. In the case of unweighted graphs, one can skip the
    weight column. The channel column is only used in the case of a multi-edge graphs. The column order in the input
    file is
    irrelevant. <br />In its online version,
    Arena3D<sup>web</sup> supports networks of up to 5000 edges and 9 channels. For larger networks, one can
    download and run
    Arena3D<sup>web</sup> locally from <a href="https://github.com/PavlopoulosLab/Arena3Dweb"
      target="_blank">GitHub</a>, and manually adjust the <b><i>MAX_EDGES</i></b>, the
    <b><i>MAX_LAYERS</i></b> or
    <b><i>MAX_CHANNELS</i></b> variable in the global.R file. <br />
    <span class="numbering"> 2.</span> The <i> Load Session </i> option allows the user to load
    network data from an exported JSON object (see <span class="numbering">5.</span>). <br />
    <span class="numbering"> 3.</span> The <i> Upload NODE attributes </i> option allows the user to upload annotation
    data regarding the nodes of the current network view. Node and Layer name columns are necessary, while Color, Size,
    Url and Description columns are optional. Color values must be annotated in hex codes. Once the node attributes have
    been uploaded, links and descriptions can be accessed by right-mouse clicking on the corresponding nodes.<br />
    <span class="numbering"> 4.</span> The <i> Upload EDGE attributes </i> option allows the user to upload annotation
    data regarding the edges. Necessary columns: SourceNode, SourceLayer, TargetNode, TargetLayer and Color (in hex
    code).<br />
    <span class="numbering"> 5.</span> The <i> Save Session </i> button allows the user to save the current view
    in JSON format (The format is described at the <i>API</i> tab). The network can be restored by importing the
    relative saved object (see
    <span class="numbering">2.</span>).<br />
  </p>

  <p>Example of the Arena3D<sup>web</sup> <i>Upload Network</i> file format.</p>
  <pre>SourceNode	SourceLayer	TargetNode	TargetLayer	Weight  Channel
An	        Group1	        Cn	        Group1          2       1
An	        Group1	        Bn	        Group1	        10      1
Bn	        Group1	        Cn	        Group1	        1       1
Cn	        Group1	        Dn	        Group1	        3       1
En	        Group2	        Fn	        Group2	        4       1
En	        Group2	        Hn	        Group2	        5       1
Fn	        Group2	        Gn	        Group2	        6       1
Gn	        Group2	        Hn	        Group2	        7       1
In	        Group3	        Jn	        Group3	        8       1
Bn	        Group1	        Fn	        Group2	        9       1
Dn	        Group1	        Hn	        Group2	        11      1
Dn	        Group1	        In	        Group3	        1       1
Cn	        Group1	        Jn	        Group3	        1       1
Hn	        Group2	        In	        Group3	        1       1
Hn	        Group2	        Kn	        Group4	        1       1
Kn	        Group4	        Ln	        Group4	        0.1     1
Kn	        Group4	        Mn	        Group5	        1       1
An	        Group1	        Nn	        Group5	        1       1
Kn	        Group4	        On	        Group5	        1       1
Kn	        Group4	        Pn	        Group5	        12      1
Kn	        Group4	        Qn	        Group6	        1       1
Kn	        Group4	        Rn	        Group6	        1       1
Kn	        Group4	        Sn	        Group7	        1       1
Kn	        Group4	        Tn	        Group7	        10      1
  </pre><br />

  <p>Example of the Arena3D<sup>web</sup> <i>Upload NODE attributes</i> file format. All columns are ommitable except
    from Node and Layer ones. Users do not need to mention every node, just the ones of interest.</p>
  <pre>Node	Layer	Color	Size	Url	Description
An	Group1	#6b6a4c	1		This is a node\'s description.
         Bn	Group1	#ccccff	2		
         Cn	Group1	#254284	3		
         En	Group2		4	https://www.frontiersin.org/articles/10.3389/fbioe.2020.00034/full	Click the Link of this node to read our review on biological networks.
         Fn	Group2	#7fe5f0	5	http://norma.pavlopouloslab.info/	Click the Link of this node to access our network annotation tool, NORMA.
         Gn	Group2		1		
         In	Group3		2		
         Dn	Group1	#ffb3b3		http://nap.pavlopouloslab.info/	
         Hn	Group2		3		
         Kn	Group4	#e0f2f2			
         Qn	Group6	#ff0067			
         Rn	Group6				
         Sn	Group7	#ffd8e8			
         Tn	Group7		4		
         </pre><br />
           
           <p>Example of the Arena3D<sup>web</sup> <i>Upload EDGE attributes</i> file format.</p>
           <pre>SourceNode	SourceLayer	TargetNode	TargetLayer	Color
         An	        Group1	        Cn	        Group1	        #4EFBE9
         Bn	        Group1	        Fn	        Group2	        #D64EFB
         In	        Group3	        Jn	        Group3	
         Kn	        Group4	        Tn	        Group7	        #4EFB7D
         </pre><br />
           
           <p>
           Example of the JSON file format. Before importing, users can alter the Scene,
         Layer, Node and/or Edge attributes manually. <br />
           <b>Scene object</b>: Position x, Position Y, Scale, Background Color, Rotation X, Rotation Y, Rotation Z<br />
           <b>Layer object</b>: Layer name, Position X, Position Y, Position Z, Scale, Rotation X, Rotation Y, Rotation Z,
         , Floor Color, Floor Width<br />
           <b>Node</b>: Node Name, Node Layer, Position X, Position Y, Position Z, Scale, Color, Url,
         Description<br />
           <b>Edge attributes</b>: Edge, Weight, Opacity, Color, Channel<br />
           <b>Univers Label Color</b>: hex code for the labels<br />
           <b>Enable Direction</b>: boolean
         </p>
           <pre class="last_p">
           {
             "scene_pan": {
               "position_x": "-320",
               "position_y": "10",
               "scale": "0.456302989349695",
               "color": "#000000",
               "rotation_x": "0.279252680319093",
               "rotation_y": "0.279252680319093",
               "rotation_z": "-1.58824961931484"
             },
             "layers": [
               {
                 "name": "Complex",
                 "position_x": "-819.2",
                 "position_y": "300",
                 "position_z": "0",
                 "last_layer_scale": "0.6",
                 "rotation_x": "0",
                 "rotation_y": "0",
                 "rotation_z": "0",
                 "floor_current_color": "#5e5a5a",
                 "geometry_parameters_width": "1244.7619047619"
               },
               {
                 "name": "Proteins",
                 "position_x": "-159.6",
                 "position_y": "850",
                 "position_z": "0",
                 "last_layer_scale": "1",
                 "rotation_x": "0",
                 "rotation_y": "0",
                 "rotation_z": "0",
                 "floor_current_color": "#5e5a5a",
                 "geometry_parameters_width": "1244.7619047619"
               },
             ],
             "nodes": [
               {
                 "name": "Pericentrin-GCP Complex",
                 "layer": "Complex",
                 "position_x": "0",
                 "position_y": "-187.632917471854",
                 "position_z": "212.593778709733",
                 "scale": "0.53921568627451",
                 "color": "#63b598",
                 "url": "",
                 "descr": ""
               },
               {
                 "name": "TUBGCP2",
                 "layer": "Proteins",
                 "position_x": "0",
                 "position_y": "-354.817961725556",
                 "position_z": "347.86115539628",
                 "scale": "0.57843137254902",
                 "color": "#ce7d78",
                 "url": "",
                 "descr": ""
               },
               {
                 "name": "TUBGCP3",
                 "layer": "Proteins",
                 "position_x": "0",
                 "position_y": "-346.070269403277",
                 "position_z": "332.464903691254",
                 "scale": "0.57843137254902",
                 "color": "#ce7d78",
                 "url": "",
                 "descr": ""
               },
               {
                 "name": "DNA Polymerase Alpha",
                 "layer": "Complex",
                 "position_x": "0",
                 "position_y": "40.5705071933332",
                 "position_z": "-308.931155161144",
                 "scale": "0.617647058823529",
                 "color": "#63b598",
                 "url": "",
                 "descr": ""
               }
             ],
             "edges": [
               {
                 "src": "Pericentrin-GCP Complex_Complex",
                 "trg": "TUBGCP2_Proteins",
                 "opacity": "0.1",
                 "color": "#CFCFCF",
                 "channel": ""
               },
               {
                 "src": "Pericentrin-GCP Complex_Complex",
                 "trg": "TUBGCP3_Proteins",
                 "opacity": "0.1",
                 "color": "#CFCFCF",
                 "channel": ""
               },
               {
                 "src": "DNA Polymerase Alpha_Complex",
                 "trg": "TUBGCP2_Proteins",
                 "opacity": "0.1",
                 "color": "#CFCFCF",
                 "channel": ""
               },
               {
                 "src": "DNA Polymerase Alpha_Complex",
                 "trg": "TUBGCP3_Proteins",
                 "opacity": "0.1",
                 "color": "#CFCFCF",
                 "channel": ""
               },
               {
                 "src": "TUBGCP2_Proteins",
                 "trg": "TUBGCP3_Proteins",
                 "opacity": "0.1",
                 "color": "#CFCFCF",
                 "channel": ""
               }
             ],
             "universalLabelColor": "#ffffff",
             "direction": true
             </pre><br />
               
               </div>
               
               <div id="API_tab" class="tabcontent">
                 <p>
                 To open Arena3D<sup>web</sup> from an external application, we offer an API that allows a <b>POST</b> request along
               with an Arena3D<sup>web</sup> JSON object.
               The API link is <b><u><i>https://bib.fleming.gr/bib/api/arena3dweb</i></u></b>. Don\'t forget to set the <b>Header
      Content-Type</b> to <b>application/json</b>. The JSON object must follow the Arena3D<sup>web</sup> export format
    as follows:
  </p>
  <h3>Simple 3-node, 2-edge, 2-layer network example</h3>
  <pre>
{
    "scene": {
        "position_x": "0",
        "position_y": "0",
        "scale": "0.6561",
        "color": "#000000",
        "rotation_x": "0.261799387799149",
        "rotation_y": "0.261799387799149",
        "rotation_z": "0.0872664625997165"
    },
    "layers": [
        {
            "name": "1",
            "position_x": "-480",
            "position_y": "0",
            "position_z": "0",
            "last_layer_scale": "1",
            "rotation_x": "0",
            "rotation_y": "0",
            "rotation_z": "0",
            "floor_current_color": "#777777",
            "geometry_parameters_width": "947"
        },
        {
            "name": "2",
            "position_x": "480",
            "position_y": "0",
            "position_z": "0",
            "last_layer_scale": "1",
            "rotation_x": "0",
            "rotation_y": "0",
            "rotation_z": "0",
            "floor_current_color": "#777777",
            "geometry_parameters_width": "947"
        }
    ],
    "nodes": [
        {
            "name": "A",
            "layer": "1",
            "position_x": "0",
            "position_y": "-410.179206860405",
            "position_z": "87.2109740224067",
            "scale": "1",
            "color": "#e41a1c",
            "url": "",
            "descr": ""
        },
        {
            "name": "B",
            "layer": "1",
            "position_x": "0",
            "position_y": "244.693623604753",
            "position_z": "-203.550830988035",
            "scale": "1",
            "color": "#e41a1c",
            "url": "",
            "descr": ""
        },
        {
            "name": "C",
            "layer": "2",
            "position_x": "0",
            "position_y": "-10.2895227857923",
            "position_z": "361.274295019168",
            "scale": "1",
            "color": "#377eb8",
            "url": "",
            "descr": ""
        }
    ],
    "edges": [
        {
            "src": "A_1",
            "trg": "B_1",
            "opacity": "1",
            "color": "#CFCFCF",
            "channel": ""
        },
        {
            "src": "A_1",
            "trg": "C_2",
            "opacity": "1",
            "color": "#CFCFCF",
            "channel": ""
        }
    ],
    "universalLabelColor": "#FFFFFF",
    "direction": false,
    "edgeOpacityByWeight": true
}
  </pre>
  <p>
    The server then returns a JSON response with the url that links to the Arena3D<sup>web</sup> application, having the
    requested network loaded:
  </p>
  <pre>
{
    "url": "https://bib.fleming.gr:8084/app/arena3d?f=081436639JURotmRGQeFJ.json"
}
  </pre>
  <br />
</div>

<div id="Cytoscape_tab" class="tabcontent">
  <h3><a href="https://apps.cytoscape.org/apps/arena3DwebApp" target="_blank">
      Arena3D<sup>web</sup>App</a> is now available in the <a href="https://apps.cytoscape.org/" target="_blank">
      Cytoscape App Store</a>.</h3>
  <p>
    Users can now load their 2D <a href="https://cytoscape.org/download.html" target="_blank"> Cytoscape </a> network
    instantly
    in Arena3D<sup>web</sup>.
    Take this aspirin network example, designed in Cytoscape via the StringApp.
  </p>
  <img src="./images/help/cytoscape_aspirin.png" alt="Cytoscape example" style="float:left;width:1200px;">
  <img src="./images/help/arena3dwebapp.png" alt="ArenaApp prompt window" style="float:left;width:500px;">
  <p>
    The Arena3D<sup>web</sup>App prompt window asks for layer and description information in its dedicated panel.
    The most important setting is choosing which node attribute contains the layer information.
    It could be any numeric or string value that defines up to 18 different non-overlapping groups, which will be
    translated into layers.
    Furthermore, Arena3DwebApp extracts the currently displayed color, size and coordinates of the nodes
    as well as the directionality, color, thickness, and transparency of the edges.
    The node label font and the network background are also transferred.
    The user can choose which column to use for the node description and URL
    that can be seen in Arena3D<sup>web</sup> as additional node information (on node right-click).
    If there are nodes that do not participate in any named layer,
    they are added to a layer named “unassigned” by default, but the user can choose to not import them in
    Arena3D<sup>web</sup>.
    The app generates a JSON file that is automatically sent to Arena3D<sup>web</sup> and gets displayed in the user’s
    default web browser.
    If users want to share the layered network or open it later, they can export the JSON file from Cytoscape and import
    it in Arena3D<sup>web</sup>.
    The generated Arena3D<sup>web</sup> should look something like this:
  </p>
  <img src="./images/help/arena_cytoscape_aspirin.png" alt="Arena Cytoscape Integration"
    style="float:left;width:1200px;">

</div>

<div id="Examples_tab" class="tabcontent">

  <h2>Example Data</h2>

  <p>
    <b>Random networks with different topologies mapped in 6 layers respectively: </b> <br />
    The <a href="./data/figure1_data.tsv" download>
      example network</a> in the Arena3D<sup>web</sup> format. <br />
    An <a href="./data/figure1_export.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b>Network example with 4 layers: </b> <br />
    The <a href="./data/figure2A_data.tsv" download>
      network file</a> in Arena3D<sup>web</sup> input format. <br />
    An <a href="./data/figure2A_export.json" download>
      exported state file</a> of this example forming a cube in 3D space. <br />
  </p>

  <hr>

  <p>
    <b>Another network example with 4 layers, accompanied by node and edge attribute files: </b> <br />
    The <a href="./data/figure2B_data.tsv" download>
      network file</a> in Arena3D<sup>web</sup> input format. <br />
    <a href="./data/figure2B_data_node_attributes.tsv" download>
      Node attributes file</a> for this example.<br />
    <a href="./data/figure2B_data_edge_attributes.tsv" download>
      Edge attributes file</a> for this example. <br />
    An <a href="./data/figure2B_export.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b>SARS-CoV-2 example: </b> <br />
    A <a href="./data/covid19_data.tsv" download>
      Covid-19 network</a> based on the work of <a href="https://www.nature.com/articles/s41586-020-2286-9"
      target="_blank">Gordon et al.</a>, in the Arena3D<sup>web</sup> format. <br />
    <a href="./data/covid19_data_node_attributes.tsv" download>
      Node attributes file</a> for this example.<br />
    <a href="./data/covid19_data_edge_attributes.tsv" download>
      Edge attributes file</a> for this example.<br />
    An <a href="./data/covid19_export.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b>GPCR example: </b> <br />
    The <a href="./data/GPCRs_data.tsv" download>
      network file</a> in the Arena3D<sup>web</sup> format. <br />
    <a href="./data/GPCRs_data_node_attributes.tsv" download>
      Node attributes file</a> for this example.<br />
    <a href="./data/GPCRs_data_edge_attributes.tsv" download>
      Edge attributes file</a> for this example.<br />
    An <a href="./data/GPCRs_export.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b>Aspirin network example with 3 data channels: </b> <br />
    The <a href="./data/aspirin_3channels.tsv" download>
      network file</a> in the Arena3D<sup>web</sup> format. <br />
    An <a href="./data/aspirin_3channels_directed.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b><a href="https://imbbc.hcmr.gr/project/prego/" target="_blank"> PREGO </a> 3-channel example
      for \'anaerobic ammonium oxidation\' process associations:</b> <br />
    The <a href="./data/prego.tsv" download>
      network file</a> in the Arena3D<sup>web</sup> format. <br />
    An <a href="./data/prego.json" download>
      exported state file</a> of this example. <br />
  </p>

  <hr>

  <p>
    <b>Cytoscape-Arena3D<sup>web</sup>App aspirin multi-channel interoperability example: </b> <br />
    The <a href="./data/StringApp_aspirin.cys" download>
      network file</a> in Cytoscape format. <br />
    An <a href="./data/Arena3DwebApp_aspirin.json" download>
      exported state file</a> of this example in the Arena3D<sup>web</sup> exported format. <br />
  </p>

  <hr>

  <p>
    <b>Scripts: </b> <br />
    A <a href="./data/transpose.py" download> Python script</a> for parsing edgelist data into Arena3D<sup>web</sup>
    format.<br />
    As an example, this input file:
  </p>
  <pre>
  Group1	A,B,C,D  
  Group2	X,Y,Z  
  </pre>
  <p> will be converted to this output file: </p>
  <pre>
  Group1	A  
  Group1	B  
  Group1	C  
  Group1	D  
  Group2	X  
  Group2	Y  
  Group2	Z  
  </pre>
  <p class="last_p">Run as: python filename.txt<br />
    The coverted file will be stored in a file named reformatted_filename.txt. </p><br /><br />

</div>

<div id="Navigation_tab" class="tabcontent">

  <h2>Navigation Controls</h2>
  <p> This is the main panel for network transformations in 3D space. The actions are divided into 3 subsections,
    namely, Scene, Layers and Nodes.</p><br />
  <p class="last_p">
    <img src="./images/help/navigation_panel.png" alt="Navigation Panel"
      style="float:left;width:280px;height:1152px;margin:5px;margin-right:20px;">
    <b>General</b> <br />
    <span class="numbering"> 1.</span> The <i> Navigation Controls </i> button is used to hide/show the navigation
    panel, while the <i> Stop:Render Inter-Layer Edges </i> button
    hides inter-layer edges to greatly improve rendering performance. <br />
    <span class="numbering"> 2.</span> General instructions on network hotkeys. <br /> <span class="indent">1. The user
      can zoom-in/out by mouse scrolling.</span> <br /> <span class="indent">2. The network can be translated by
      dragging with the mouse or by pressing the keyboard\'s arrow keys. </span><br /> <span class="indent">3. The
               network view is also orbitable by dragging while holding the middle-mouse button.
               </span><br /> <span class="indent">4. The user can move a layer by click and dragging it.</span><br /> <span
               class="indent">
                 5. The user can rotate selected layers at X(red), Y(green) and Z(blue) axis by holding the respective hotkeys and
               click-dragging.</span><br /> <span class="indent">6. The user can move selected nodes on a layer by holding the
               hotkeys (Y, Z) and click-dragging. Priority is given on selected nodes over layers. </span><br /> <span
               class="indent">7. The user can select/deselect individual nodes or layers by double clicking on objects. The node
               or layer
               flashes when the user hovers over it and changes color when selected. </span><br /><span class="indent">8.
               For a batch node selecion, the user may hold the Shift button and click-drag to apply a lasso
               selection. </span><br /> <span class="indent">9. Finally, by double clicking anywhere on the scene, all selected
               nodes and edges are deselected. </span><br />
                 <br /><b>Scene</b> <br />
                 <span class="numbering"> 3.</span> Controls to rotate the network as one object in 3D space in X (red), Y (green)
               and Z (blue) axes. The user can set the angle step (between 1&#176; and 15&#176;) on a slider and then hold the
                                                                     dedicated colored buttons to rotate the network. In case the auto-rotate checkbox (<b>Scene Actions</b> tab) is
                                                                   enabled, then the
                                                                   scene starts to automatically rotate, relative to the designated angles.<br />
                                                                     <span class="numbering"> 4.</span> The <i> Recenter Network </i> button readjusts the network at the starting (0, 0,
                                                                                                                                                                                    0) coordinates. <br />
                                                                     <br /><b>Layers</b> <br />
                                                                     <span class="numbering"> 5.</span> Dedicated layer rotation controls, with actions similar to the scene rotation
                                                                   controls. These controls are applied to any selected layers. Layers can be selected via the <i> Layer Selection &
                                                                     Layouts </i> tab or by double-clicking. <br />
                                                                     <span class="numbering"> 6.</span> These 2 buttons can be used to <b> expand </b> or <b> collapse </b> all layers in
                                                                   the X (red) axis, respectively. <br />
                                                                     <span class="numbering"> 7.</span> These controls enable the translation (moving) of any selected layers in 3D
                                                                   space. The
                                                                   user can define a step (1-50) through a slider and then translate the selected layers on their respective X (red), Y
                                                                   (green) or Z (blue) axis, by holding the respective buttons. <br />
                                                                     <span class="numbering"> 8.</span> Scaling transformation in a range of 0.2x - 5x for any selected layer. <br />
                                                                     <br /><b>Nodes</b> <br />
                                                                     <span class="numbering"> 9.</span> These 2 buttons allow the user to <b> expand </b> or <b> collapse </b> a group of
                                                                   <b>selected
                                                                   nodes</b> in their corresponding layers, respectively. <br />
                                                                     <span class="numbering"> 10.</span> Node translation controls similar to the layer translation ones. The
                                                                   transformations are applied on selected nodes only. <br />
                                                                     <span class="numbering"> 11.</span> Scaling transformation in a range of 0.2x - 5x for selected nodes. <br />
                                                                     </p><br /><br />
                                                                     
                                                                     </div>
                                                                     
                                                                     <div id="Layouts_tab" class="tabcontent">
                                                                     
                                                                     <h2>Layer Selection & Layouts</h2>
                                                                     <p>This control panel allows the user to select, deselect and hide layers, show layer-specific node labels, as well as
                                                                   apply layout and clustering algorithms and node scaling based on network metrics, on subgraphs of the network.</p>
                                                                     <br />
                                                                     <p>
                                                                     <img src="./images/help/layouts.png" alt="Layouts"
                                                                   style="float:left;width:360px;height:518px;margin:5px;margin-right:20px;">
                                                                     <span class="numbering"> 1. </span> This consists of a group of 3 exclusive options for subgraph calculations, upon
                                                                   which, layout algorithms (<span class="numbering">3, 5</span>), clustering algorithms (<span
                                                                                                                                                          class="numbering">4</span>) and node scaling (<span class="numbering">6</span>) is
                                                                   applied. <br /> The <i>Per Layer</i> choice treats each selected layer (<span class="numbering">2</span>) as an
                                                                   individual network. <br /> The <i>All Selected Layers</i> choice treats all selected Layers (<span
                                                                                                                                                                class="numbering">2</span>) as one, combined network. After the execution of a layout or scaling algorithm, nodes
                                                                   are mapped back to their respective Layer. With this option, the application of force-directed layout algorithms
                                                                   allows network alignment among the different layers. <br /> The <i>Local Layout option for the Selected Nodes Per
                                                                   Layer</i> choice allows layout and scaling algorithms to be applied on a selected sub-group of nodes, per each
                                                                   selected layer respectively.<br />
                                                                     <span class="numbering"> 2. </span> The <i>Select/Deselect All Layers</i> checkbox allows the user to quickly select
                                                                   or deselect all available network layers. After the user uploads or imports a network, a grid of <i>n x 3</i>
                                                                     checkboxes is created, where <i>n</i> is the number of network layers and <i>3</i> are the available actions for
                                                                   each layer; <br /> the 1<sup>st</sup> column allows the individual selection/deselection of layers, <br /> the
                                                                   2<sup>nd</sup> column allows the user to hide individual layers and their inter-layer connections <br /> and the
                                                                   3<sup>rd</sup> column allows the user to show node labels per layer.<br />
                                                                     <span class="numbering"> 3. </span> A list of available layout algorithms of the igraph package, to apply on
                                                                   selected layers (<span class="numbering">2</span>) based on the execution mode of (<span
                                                                                                                                                      class="numbering">1</span>). <br />
                                                                     <span class="numbering"> 4. </span> A list of available clustering algorithms of the igraph package, to apply on
                                                                   selected layers (<span class="numbering">2</span>) based on the execution mode of (<span
                                                                                                                                                      class="numbering">1</span>).
                                                                   <br />
                                                                     <span class="numbering"> 5. </span> A list of available layout algorithms of the igraph package, to apply as
                                                                   local layouts on clusters (<span class="numbering">4</span>) based on the execution mode of (<span
                                                                                                                                                                class="numbering">1</span>). Visible when a clustering algorithm has been selected.
                                                                   <br />
                                                                     <span class="numbering"> 6. </span> A list of available network metrics of the igraph package, used for
                                                                   node-scaling, to apply on selected layers (<span class="numbering">2</span>) based on the execution mode of option
                                                                   (<span class="numbering">1</span>).<br />
                                                                     </p>
                                                                     
                                                                     <p>Below, we briefly describe the available layout algorithms (<span class="numbering">3, 5</span>).</p><br />
                                                                     <ul>
                                                                     <li>Reingold-Tilford: This is a tree-like layout and is suitable for trees, hierarchies and graphs without many
                                                                   cycles.</li>
                                                                     <li>Sugiyama: Like with Reingold-Tilford, this layout algorithm is more suitable for layered directed acyclic
                                                                   graphs.</li>
                                                                     <li>Fruchterman-Reingold: It places nodes on the plane using the force-directed layout algorithm developed by
                                                                   Fruchterman and Reingold.</li>
                                                                     <li>Circle: It places vertices on a circle, ordered by their vertex ids.</li>
                                                                     <li>Grid: This layout places vertices on a rectangular 2D grid.</li>
                                                                     <li>Davidson-Harel: It is a force-directed algorithm which uses simulated annealing and a sophisticated energy
                                                                   function to place nodes on a plane. </li>
                                                                     <li>Distributed Recursive (Graph) Layout: DrL is a force-directed graph layout toolbox focused on real-world
                                                                   large-scale graphs.</li>
                                                                     <li>Multidimensional scaling: It aims to place points from a higher dimensional space in 2D plane, so that the
                                                                   distance between the points are kept as much as possible.</li>
                                                                     <li>Random: This function places the vertices of the graph on a 2D plane uniformly using random coordinates.</li>
                                                                     <li>Kamada-Kawai: This layout places the vertices on a 2D plane by simulating a physical model of springs.</li>
                                                                     <li>Large Graph Layout (LGL): A force directed layout suitable for larger graphs.</li>
                                                                     <li>Graphopt: A force-directed layout algorithm, which scales relatively well to large graphs.</li>
                                                                     <li>Gem: It places vertices on the plane using the GEM force-directed layout algorithm.</li>
                                                                     <li>Star: It places vertices of a graph on the plane, according to the simulated annealing algorithm by Davidson and
                                                                   Harel.</li>
                                                                     </ul>
                                                                     
                                                                     <img src="./images/help/layouts_figure.png" alt="Layouts Figure" style="float:left;height:75%;">
                                                                     
                                                                     <p>Below, we briefly desribe the available clustering algorithms (<span class="numbering">4</span>).</p><br />
                                                                     <ul>
                                                                     <li>Louvain: This algorithm is a greedy optimization method that appears to run in time O(nlogn) where n is the
                                                                   number of nodes in the network.</li>
                                                                     <li>Walktrap: This algorithm in graph theory, used to identify communities in large networks via random walks.</li>
                                                                     <li>Edge Betweenness: performs this algorithm by calculating the edge betweenness of the graph, removing the edge
                                                                   with the highest edge
                                                                   betweenness score, then recalculating edge betweenness of the edges and again removing the one with the highest
                                                                   score,
                                                                   etc.</li>
                                                                     <li>Fast Greedy: This algorithm hierarchical approach, but it is bottom-up instead of top-down. It tries to optimize
                                                                   a quality function
                                                                   called modularity in a greedy manner.</li>
                                                                     <li>Label Propagation: This algoritm a semi-supervised machine learning algorithm that assigns labels to previously
                                                                   unlabeled data points. At the start of
                                                                   the algorithm, a subset of the data points have labels (or classifications). These labels are
                                                                   propagated to the unlabeled points throughout the course of the algorithm. </li>
                                                                     </ul>
                                                                     
                                                                     <img src="./images/help/clustering.png" alt="Clustering" style="float:left;">
                                                                     
                                                                     <p>Below, we briefly desribe the available network metrics for node scaling (<span class="numbering">6</span>).</p>
                                                                     <br />
                                                                     <ul class="last_p">
                                                                     <li> The <i>Degree</i> metric describes the total number of connections adjacent to a node.</li>
                                                                     <li>The <i>Clustering Coefficient</i> of a node shows whether this node has the tendency to form clusters and is
                                                                   defined as the number of Edges between a node\'s neighbors divided by the number of all possible connections
      between these neighbors.</li>
    <li>The <i>Betweenness Centrality</i> highlights nodes which can act as mediators in order for two communities to
      communicate with each other.</li>
  </ul>
  <br />

</div>

<div id="Scene_tab" class="tabcontent">

  <h2>Scene Actions</h2>
  <p> In this tab, the user has 2 scene-related options.</p><br />
  <div class="last_p">
    <img src="./images/help/scene1_1.PNG" alt="Scene"
      style="float:left;width:335px;height:333px;margin:5px;margin-right:20px;">
    <span class="numbering"> 1. </span> A checkbox that toggles the visibility of the scene coordinates system. <br />
    <span class="numbering"> 2. </span> A checkbox that enables scene auto rotate. (The user must enable it and then
    from the Navigation Controls click the arrows to rotate). <br />
    <span class="numbering"> 3. </span> A radio button with the following predefined layouts: Parallel Coordinates
    (default option from new files),
    Zig Zag, Star and Cube. (Bottom Figures) <br />
    <span class="numbering"> 4. </span> A ColorPicker for the background of the network. For bright background colors,
    be sure to set higher opacity values for layer floors (Layer Actions tab) and edges (Edge Actions tab). <br />
    <span class="numbering"> 5. </span> A button to see the network in VR. Works only in the online version of the
    tool.<br />
    <div class="scene-actions">
      <img src="./images/help/predefined_layouts.png" alt="Predefined Layouts" style="float:left;height:35%;">
    </div>

    <img src="./images/help/vr.png" alt="VR" style="height: 50%;">

    <p>
      A dedicated theme bar is also offered on the top-right corner of the UI, allowing the user to choose among a
      Light, a Dark and a Gray mode.
    </p>
    <img src="./images/help/themes.png" alt="Themes" style="margin-bottom:50px;height:45%;">

  </div>

</div>

<div id="Layer_tab" class="tabcontent">

  <h2>Layers</h2>
  <p>This control panel incorporates layer-related actions.</p> <br />
  <p class="last_p">
    <img src="./images/help/layers.png" alt="Layers"
      style="float:left;width:317px;height:434px;margin:5px;margin-right:20px;">
    <span class="numbering"> 1. </span> This checkbox allows the user to show or hide all layer labels.<br />
    <span class="numbering"> 2. </span> This checkbox gives the option of showing the labels of selected layers only.
    Option (<span class="numbering">1</span>) has priority over this option.<br />
    <span class="numbering"> 3. </span> This option toggles the coordinate systems -X (red), Y (green), Z (blue)- for
    all layers. <br />
    <span class="numbering"> 4. </span> This option allows an alternative visualization for layer floors, in wireframe
    mode. <br />
    <span class="numbering"> 5. </span> This option gives priority to uploaded layer colors from a JSON object. <br />
    <span class="numbering"> 6. </span> This slider resizes layer labels. <br />
    <span class="numbering"> 7. </span> This slider changes layer opacities in [0-1]. <br />
    <span class="numbering"> 8. </span> This is a ColorPicker button for painting layer floors. <br /><br /><br />
  </p>

</div>

<div id="Node_tab" class="tabcontent">

  <h2>Nodes</h2>
  <p>This control panel incorporates node-related actions.</p> <br />
  <p>
    <img src="./images/help/nodes.png" alt="Nodes"
      style="float:left;width:580px;height:358px;margin:5px;margin-right:20px;">
    <span class="numbering"> 1. </span> This options allows the user to select/deselect all nodes. Selected nodes can
    then be translated in 3D space via the <i>Navigation Controls</i>, and via the <i>Layer Selection & Layouts</i>
    action tab can be either rearranged in a local layout or rescaled based on network metrics.<br />
    <span class="numbering"> 2. </span> This option allows the user to view every node label. This is an option that
    demands heavy processing power due to the constant redrawing of labels. Ensure that this is enabled only in small
    networks and in combination with the 15FPS option of the <i>FPS</i> action tab.<br />
    <span class="numbering"> 3. </span> This option allows viewing only the labels of selected nodes. Priority is given
    in option (<span class="numbering">2</span>) over this option.<br />
    <span class="numbering"> 4. </span> Selected nodes are highlighted in a chartreuse color. Deselecting this option
    allows nodes to retain their original color (either from any uploaded node attributes or from their default layer
    color). Deactivating this option
    works in combination with activating option (<span class="numbering">3</span>), so as to select certain nodes of a
    pre-colored path, view their labels without changing their color and extracting the respective image (either with
    the PrintScreen key, or by snipping or by right-clicking and then selecting the <i>Save as Image</i> option).<br />
    <span class="numbering"> 5. </span> This option allows resizing of node labels. <br />
    <span class="numbering"> 6. </span> This is the node search bar. The user can select multiple nodes by entering
    their names, without the need to specify layers, separated by commas. Any trailing and leading spaces are
    trimmed.<br />
  </p>
  <br />
  <br />
  <img src="./images/help/mainview.png" alt="Main View"
    style="float:left;width:726px;height:555px;margin:5px;margin-right:20px;">
  <ul class="last_p">
    <li>
      Hovering over nodes shows their corresponding labels, while right-clicking on them opens a menu, allowing the user
      to (i) select their direct neighbors (in every layer), (ii) select a multilayer path starting from the current
      node and expanding on the other layers via their connections or (iii) select a downstream path starting from the
      current node and expanding only on forward layers, as shown in the image. In case there are accompanying node
      attributes such as a link or a description, the corresponding options are also shown in the box. <br /><br />
    </li>
    <li>
      Right-click anywhere else on the canvas to save the current view as image.<br />
    </li>
  </ul>
  <br /><br />

</div>

<div id="Edge_tab" class="tabcontent">

  <h2>Edges</h2>
  <p>This control panel incorporates edge-related actions.</p> <br />
  <div class="last_p">
    <img src="./images/help/edges.png" alt="Edges"
      style="float:left;width:320px;height:auto;margin:5px;margin-right:20px;">
    <span class="numbering"> 1. </span> This option highlights the selected edges.<br />
    <span class="numbering"> 2. </span> This option toggles gives priority to the edge color that it is set on file. If
    it is not checked and the network has multiple edges then the channel menu <span class="numbering">11</span> is
    visible.<br />
    <span class="numbering"> 3. </span> This option toggles the graph direction from the source node to target
    node (first figure). <br />
    <span class="numbering"> 4. </span> This slider changes the intra-layer arrow sizes. This is visible only if option
    (<span class="numbering">3</span>) is enabled.<br />
    <span class="numbering"> 5. </span> This slider change the inter-layer arrow sizes. This is visible only if option
    (<span class="numbering">3</span>) is enabled. <br />
    <span class="numbering"> 6. </span> This option gives priority on any uploaded/imported values of edge
    <i>Weights</i>, which are being mapped in the [0-1] range and are assigned on edge opacities. If this option is
    unchecked, the edge opacity is decided through options (<span class="numbering">7</span>) for intra-layer and (<span
      class="numbering">8</span>) for inter-layer edges, respectively. <br />
    <span class="numbering"> 7. </span> If option (<span class="numbering">6</span>) is unchecked, the intra-layer edge
    opacity is decided through this slider.<br />
    <span class="numbering"> 8. </span> If option (<span class="numbering">6</span>) is unchecked, the inter-layer edge
    opacity is decided through this slider.<br />
    <span class="numbering"> 9. </span> If the graph is multi-edge then this slider is visible and control the
    curvature of the intra-layer edges.<br />
    <span class="numbering"> 10. </span> If the graph is multi-edge then this slider is visible and control the
    curvature of the inter-layer edges.<br />
    <span class="numbering"> 11. </span> If the graph that is uploaded is multi-edge then then the channel menu (a
    grid
    of <i>n x 3</i>)
    is created, where <i>n</i> is the number of channels and <i>3</i> are the available columns for
    each layer; <br /> the 1<sup>st</sup> column is the name of the channel,<br /> the
    2<sup>nd</sup> column allows the user to change the color of each channel,<br /> the
    3<sup>rd</sup> column allows the user to hide individual channels. (second figure)<br />
    This is visible only if option
    (<span class="numbering">2</span>) is not enabled.<br />
    <br />
    <img src="./images/help/directed_graph.png" alt="Directed Graph"
      style="float:left;height:45%;margin:5px;margin-right:20px;">
    <img src="./images/help/channels.png" alt="Channels" style="float:left;height:50%;margin:5px;margin-right:20px;">
    <br />
  </div>

</div>

<div id="FPS_tab" class="tabcontent">

  <h2>FPS</h2>
  <p class="last_p"> The option for frames per second. The user is allowed to choose between 3 options: <br /><br />
    <img src="./images/help/fps2.PNG" alt="FPS"
      style="float:left;width:284px;height:158px;margin:5px;margin-right:20px;">
    &bull; 15FPS, for larger, more processing-heavy networks. <br />
    &bull; 30FPS, the default option. <br />
    &bull; 60FPS, for smaller networks that allow smoother rendering. <br />
  </p>

</div>

<div id="About_tab" class="tabcontent">

  <h2> Developers </h2>
  <p>
    &#8226; Evangelos Karatzas, email: karatzas@fleming.gr<br />
    &#8226; Maria Kokoli, email: mariakokoli94@gmail.com <br />
    &#8226; Fotis Baltoumas, email: baltoumas@fleming.gr <br />
    &#8226; Georgios A. Pavlopoulos, email: pavlopoulos@fleming.gr <br />
  </p>

  <h2> Install Arena3D<sup>web</sup> </h2>
  <p>
    <a href="https://github.com/pavlopouloslab/arena3dweb" target="_blank">Github </a>
    <br />
    <a href="https://hub.docker.com/r/pavlopouloslab/arena3dweb" target="_blank">DockerHub </a>
  </p>
  <br />

  <h2> Related Software </h2>
  &#8226; <a href="http://norma.pavlopouloslab.info/" target="_blank">NORMA: The NetwORk Makeup Artist</a><br />
  &#8226; <a href="http://nap.pavlopouloslab.info/" target="_blank">NAP(v2.0): The Network Analysis Profiler</a><br />

  <h2> Related Literature </h2>
  &#8226; <a href="https://www.frontiersin.org/articles/10.3389/fbioe.2020.00034/full" target="_blank">A Guide to
    Conquer the Biological Network Era Using Graph Theory</a><br />

  <br />
  <h2> Cite Arena3D<sup>web</sup> </h2>
  <p class="last_p">
    Kokoli, M., Karatzas, E., Baltoumas, F.A., Schneider, R., Pafilis, E., Paragkamian, S., Doncheva, N.T., Jensen, L.J.
    and Pavlopoulos, G., 2022.
    <a href="https://www.biorxiv.org/content/10.1101/2022.10.01.510435v2.abstract" target="_blank">
      Arena3D<sup>web</sup>: Interactive 3D visualization of multilayered networks
      supporting multiple directional information channels, clustering analysis and application integration</a>,
    bioRxiv.
    <a href="https://doi.org/10.1101/2022.10.01.510435" target="_blank">https://doi.org/10.1101/2022.10.01.510435</a>
    <br /><br />

    Karatzas, E., Baltoumas, F.A., Panayiotou, N.A., Schneider, R. and Pavlopoulos, G.A., 2021.
    <a href="https://academic.oup.com/nar/advance-article/doi/10.1093/nar/gkab278/6246395?fbclid=IwAR0BBBUZ1FWFkkGZA-mz8nGeTS6ewcosuW9IGl-s6o3lKItse70fL9ecGqM"
      target="_blank"> Arena3D<sup>web</sup>: Interactive 3D visualization of multilayered networks</a>, Nucleic Acids
    Research, 49(W1), pp.W36-W45.
    <a href="https://doi.org/10.1093/nar/gkab278" target="_blank">https://doi.org/10.1093/nar/gkab278</a>

    <br /><br /><br /><br />
  </p>

</div>

<script>
  function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "inline-block";
    evt.currentTarget.className += " active";
  }

  // Get the element with id="defaultOpen" and click on it
  document.getElementById("defaultOpen").click();
</script>

    '),
    generateFooter()
  )
}
