/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var s2 = require("nodes2ts");
var _ = require('underscore');
var _lo = require("lodash");
var redis = require("../redis/redisProvider").provider;
var init = require("../config/init");
var constant = require('../constants');
var s2circle = require("../s2geometry/s2circlecoverer");
var logger = require("../config/logutil").logger;

var tripRequest = (function(){

    function tripRequest(){
    };

    tripRequest.logRiderLocation = function(lat,lon,rider_UUID,mobile_number){
        var s2Latlong = new s2.S2LatLng(lat,lon);
        var s2riderCellId = new s2.S2CellId(s2Latlong);

        var driver_data = {
            key: s2riderCellId.id.toString(),
            lat:lat,
            lon:lon,
            date_time: new Date(),
            driver_uuid: rider_UUID,
            driver_mobile: mobile_number
        };
    }

    /**
     * retrieve cells in customer rectangle that intersect with city-grid
     * @param rect
     */
    //getRiderGeoSquare
    tripRequest.getIntersectSquareCells = function(rect){
        redis.getCityGrid(function(data){
            var lo = new s2.S2LatLng.fromDegrees(-26.135891, 28.117186);
            var hi = new s2.S2LatLng.fromDegrees(-26.129719, 28.131236);
            var riderSquare = s2.S2LatLngRect.fromLatLng(lo, hi);

            logger.info("city lat_lon = " + init.city.lat+","+init.city.lon);
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();
            var riderSquare = s2circle.S2CircleCoverer.getSquareCovering(riderSquare, 12, 20, 100);
            var riderRegion2 = new s2.S2CellUnion();
            riderRegion2.initRawCellIds(riderSquare);
            riderRegion2.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion2); //Google S2 bug fixed
            logger.debug ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion2.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");

        });
    }
    /**
     * retrieve cells from city grid cells that intersect customer circle
     * @param cust_scap
     */

    tripRequest.getIntersectRadiusCells = function(lat,lon,radius,cb){
        redis.getCityGrid(function(data){
            var min = constant.S2_CELL_MIN_LEVEL;
            var max = constant.S2_CELL_MAX_LEVEL;
            var no_of_cells = constant.DEFAULT_RIDER_MAX_CELLS;

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,min,max,no_of_cells);
            //logger.log("city lat_lon = " + init.city.lat+","+init.city.lon);
            //do we actually need the city latlon to initialize S2CellUnion?
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();

            var riderRegion = new s2.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed

            logger.log ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");
            cb(intersect_union);
        });
    }

    /**
     * Retrieve vehicles that are within the radius of the rider requesting a trip.
     * (see RIDER_GEO_RADIUS in constants.js)
     * @param lat
     * @param lon
     * @param cb
     */

    var comp = function(x,cell){
        this.x = x;
    this.cell_id = cell;
};
    tripRequest.getVehiclesNearRider = function(lat,lon,cb){
        logger.log("rider location = " + lat+","+lon);
        tripRequest.getIntersectRadiusCells(lat,lon,
            constant.RIDER_GEO_RADIUS,function(cells){
                var cellArray = cells.getCellIds().map(function(item){
                    return item.pos().toString();
                });
                //retrieve from redis vehicles in rider cells within radius
                redis.getVehiclesInCellArray(cellArray).then(function(data){
                    var cellsWithVehicles = [];
                    data.forEach(function(item,index){
                        logger.log("cell_id = " + cellArray[index]);
                        if(item[1] !== null && item[1].length > 0){
                            //var vehicles_with_scores = item[1];
                            //vehicles_with_scores.forEach(function(x,index2){
                            item[1].forEach(function(x,index2){
                                if(index2%2 === 0){
                                    //how to get the cell whose vehicles are near rider.
                                    logger.log("push vehicle = "+ x + "->"+cellArray[index]);
                                      cellsWithVehicles.push(new comp(x,cellArray[index]));
                                    //cellsWithVehicles.push(x);
                                }
                            })
                        }
                    });
                    redis.getVehiclePosFromArray(cellsWithVehicles,function(results){
                        cb(results);
                    });
                }).catch(function(error){
                    logger.log("getVehiclesNearRider, "+error)
                    reject(error);
                });
            });
    }

    return tripRequest;
}).call(this)

exports.tripRequest = tripRequest;

/***
 * testing ......
 */
//triprequest.getIntersectRadiusCells(27.8778444,-25.86465,constant.RIDER_GEO_RADIUS);
//triprequest.getIntersectRadiusCells(-26.104628,28.053901,constant.RIDER_GEO_RADIUS);
//triprequest.getIntersectRadiusCells(27.8778444,-25.86465,constant.RIDER_GEO_RADIUS);
//-26.029433325,28.033954797
//-26.217146, 28.356669

//-26.023825, 28.036000 ( 3 vehicles)
//-26.023825, 28.036000  (2 vehicles)
//-26.114097,  28.156122 (0 vehicles)
//-26.059825,  28.021906 (8 vehicles)
//-26.104628,28.053901 (has 11 vehicles)
//-26.073008866,28.026688399 (has vehicles)

tripRequest.getVehiclesNearRider(-26.023825, 28.036000,function(vehicles){
    //logger.log("getVehiclesNear size = " + vehicles[0].length/2);
    var val = _.isArray(vehicles);
    logger.log("---------------------------------------")
    logger.log("getVehiclesNear = "+ vehicles.length);
    vehicles.forEach(function(each_vehicle){
        logger.log(each_vehicle.vehicle_id+"->"+each_vehicle.s2key +"=/"+each_vehicle.tstamp + "--/"+each_vehicle.cell);
    });
});
//-26.270155, 28.438425 (Spring - outside)
//-26.152353, 28.255995 (Boksburg - outside)
//27.8778444,-25.864647 (outside edge cells)
//-26.240749, 28.376074
//-26.217146, 28.356669 //near the edge

//-26.264848,  28.623590 (Delmas)