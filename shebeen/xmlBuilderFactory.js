/**
 * Created by tinyiko on 2017/06/04.
 */
var redis = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;
var builder = require("xmlbuilder");
var fs = require("fs");
var path = require("path");
var xmlBuilderFactory = (function(){

    /**
     * factory function to build an XMl DOM model with cellArray and
     * GPS track points
     */
    function xmlBuilderFactory(){};

    xmlBuilderFactory.createFile = function(filename,kml_buffer){
        var file = path.join(__dirname,"../../output",filename);
        logger.log("writing to file.....->"+file);
        fs.writeFile(file,kml_buffer,function(err){
            logger.log("error at writefile - > "+ err);
            if(err)
                throw Error("error writing to file");
                logger.log("successfully created file: "+kml_buffer);
        })
    }

    /**
     * builds XML DOM for cell polygons representing s2cells
     * @param document_name
     * @param cellArray
     */
    xmlBuilderFactory.buildCells = function(document_name,cellGPSArray,vehicleArray,color_code,width){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up()
            .ele("Style").att("id","default")
            .ele("LineStyle")
            .ele("color",color_code).up()
            .ele("width",width)
            .up().up().up()
            .ele("StyleMap").att("id","default0")
            .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#default")
            .up().up().up();

        if(cellGPSArray !== null) {
            cellGPSArray.forEach(function (item) {

                var stringBuild = "";
                for (var i = 0; i < item.cell_vertex.length; i++) {
                    stringBuild = stringBuild + item.cell_vertex[i] + ",0 ";
                    if (i === 4) {
                        buildersList
                            .ele("Placemark")
                            .ele("name",item.s2_id).up()
                            .ele("styleUrl", "#default0").up()
                            .ele("LineString")
                            .ele("coordinates", stringBuild)
                    }
                }
                //logger.log(stringBuild);
            });
        }

        if(vehicleArray !== null) {
            vehicleArray.forEach(function (item) {
                buildersList
                    .ele("Placemark")
                    .ele("name","key").up()
                    .ele("Point")
                    .ele("coordinates", item)
            });
        }
        var xml = buildersList.end({pretty: true});

        console.log(xml);
        xmlBuilderFactory.createFile(document_name,xml);
    }

    /**
     * builds XML DOM for location GPS points of vehicles
     * @param document_name
     * @param cellArray
     */
     xmlBuilderFactory.buildVehicleLocations = function(document_name, cellArray, s2cell_Array){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up()

            //style xml for waypoints
            .ele("Style").att("id","s_ylw-pushpin_hl")
             .ele("IconStyle")
             .ele("color",'ff4038fc').up()
             .ele("scale","0.590909")
             .ele("Icon")
            .ele("hotSpot").att("x","32").att("y","1").att("xunits","pixels").att("yunits","xunits").up()
             .ele("href","http://maps.google.com/mapfiles/kml/paddle/wht-stars.png").up()
             .up().up().up().up()

            .ele("StyleMap").att("id","m_ylw-pushpin")
             .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#s_ylw-pushpin").up()
            .up().up()

            //var item = xml.ele("name");

            cellArray.forEach(function(item,index){
                if(s2cell_Array[index] !== undefined) {
                    logger.log("results index = " + index + "-" + JSON.stringify(item));
                    buildersList
                        .ele("Placemark")
                        .ele("styleUrl", "#m_ylw-pushpin").up()
                        .ele("name", s2cell_Array[index].vehicle_id).up()
                        .ele("ExtendedData")
                        .ele("SchemaData").att("schemaUrl", "#GO_SWIFT_Phase_1")
                        .ele("SimpleData", item).att("name", "GPS").up()
                        .ele("SimpleData", s2cell_Array[index].s2key).att("name", "S2Cell")
                        .up().up().up()
                        .ele("Point")
                        .ele("coordinates", item)
                }
            });
            cellArray.forEach(function(item){
                //buildersList.
        })
        var xml = buildersList.end({pretty: true});
        console.log(xml);
         xmlBuilderFactory.createFile(document_name,xml);
    }

    return xmlBuilderFactory;
}).call(this);

exports.xmlBuilderFactory = xmlBuilderFactory;



var cells = ["2203795067297071104","2203801664366837760","2203792455956955136","2203681267843596288","2203794242663350272"];
var waypoints = ["28.033954797,-26.029433325", "28.023715353,-26.060654974", "28.033840468,-26.100056928"];

//xmlBuilderFactory.buildVehicleLocations("waypoints.kml",waypoints,cells);

//--- get all cells and build the joburg city grid kml file
var cells = redis.getCityGrid(function(cells){
    var s2cells = s2common.getVertexArrayfromCells(cells);
    //xmlBuilderFactory.buildCells("S2_JHB_grid_cells.kml",s2cells,null,"#ff4038fc","2.1");

});


/*
 .ele("Style").att("id","s_ylw-pushpin_hl")
 .ele("IconStyle")
 .ele("color",'ff4038fc').up()
 .ele("scale","0.590909")
 .ele("Icon")
 .ele("href","http://maps.google.com/mapfiles/kml/paddle/wht-stars.png").up()
 .up().up().up()
 .ele("width",width)
 .up().up().up()
 .ele("StyleMap").att("id","default0")
 .ele("Pair")

 <StyleMap id="m_ylw-pushpin">
 <Pair>
 <key>normal</key>
 <styleUrl>#s_ylw-pushpin</styleUrl>
 </Pair>
 </StyleMap>

 .ele("StyleMap").att("id","m_ylw-pushpin")
 .ele("Pair")
 .ele("key","normal")
 .ele("styleUrl","#s_ylw-pushpin").up()
 .up().up()

 <Style id="s_ylw-pushpin_hl">
 <IconStyle>
 <color>ff4038fc</color>
 <scale>0.590909</scale>
 <Icon>
 <href>http://maps.google.com/mapfiles/kml/paddle/wht-stars.png</href>
 </Icon>
 <hotSpot x="32" y="1" xunits="pixels" yunits="pixels"/>
 </IconStyle>
 <LabelStyle>
 <color>003eff3e</color>
 <scale>0.9</scale>
 </LabelStyle>
 </Style>
 */