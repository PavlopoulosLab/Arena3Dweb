FROM r-base
#Description of the image
LABEL description="Arena3Dweb docker image"
LABEL maintainer="Fotis Baltoumas<baltoumas@fleming.gr>"
LABEL version="2.0"
#set the timezone
ENV TZ Europe/Athens
#copy the Rprofile.site file and containing the shiny port and CRAN repo url
COPY Rprofile.site /usr/lib/R/etc/

# install required R packages
RUN R -e 'install.packages(c("shiny","shinyjs","shinythemes","igraph","RColorBrewer","jsonlite","tidyr"))'

# copy the Arena3Dweb directory to the VM 
COPY ../Arena3Dweb/ /root/Arena3DWeb/

RUN R -e 'install.packages(c("DT", "fst"))'

#expose the shiny port
EXPOSE 3838

#set the default command to run, ie "R"
CMD ["R", "-e", "shiny::runApp('/root/Arena3DWeb/')"]
