# Script Libraries
library(shiny)
library(shinyjs)
library(shinythemes)
library(igraph)
library(RColorBrewer)
library(jsonlite)
library(tidyr)

# Initializing Script Static Variables
max_allowed_edges <- 5000
inData <- ""
max_allowed_channels <- 9
color_brewer_pallete <- 'Set3'
color_brewer_pallete_dark <- 'Set1'
channel_colors_light <- brewer.pal(max_allowed_channels, color_brewer_pallete)
channel_colors_dark <- brewer.pal(max_allowed_channels, color_brewer_pallete_dark)
VR_DOWNSCALE_FACTOR <- 300
POST_REQUEST_PATH <- 'tmp/'
API_URL <- 'https://bib.fleming.gr/bib/api/arena3dweb/vr/' # 'http://localhost:8080/api/arena3dweb/vr/' # 

js.opentab <- "
  shinyjs.BrowseURL = function(url) {
    window.open(url, '_blank');
  }
"
