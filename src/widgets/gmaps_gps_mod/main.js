var WidgetGoogleMapsGpsViewerMod = function (widgetInstanceId) {
  // Mandatory properties
  var self = this;
  this.widgetInstanceId = widgetInstanceId;
  this.selector = ".jsWidgetContainer[data-widget-instance-id=" + self.widgetInstanceId + "]";
  


  // Mandatory callback methods
  this.clbkCreated = function () {
    self.param1 = new ROSLIB.Param({
      ros: ros,
      name: "/rosapi/gps_waypoints"
    });
    self.generateGpsVisualizer();
    $(document).delegate(self.selector + " .jsSetRegion", "click", self.setRegion);
    $(document).delegate(self.selector + " .jsEndRegion", "click", self.endRegion);
    $(document).delegate(self.selector + " .jsCenterMap", "click", self.centerMap);
    $(document).delegate(self.selector + " .jsSendRobot", "click", self.sendRobot);
    $(document).delegate(self.selector + " #myRange", "change", self.changeDensity);
  };

  this.clbkConfirm = function() { };
  this.clbkResized = function () {
    google.maps.event.trigger(self.gpsVars.map, "resize");
    self.gpsVars.map.setCenter(self.latLng);
  };
  this.clbkMoved = function () { };
  this.clbkTab = function (isMyTab) {
    self.generateGpsVisualizer();
    google.maps.event.trigger(self.gpsVars.map, "resize");
    self.gpsVars.marker.setPosition(self.latLng);
    self.gpsVars.map.setCenter(self.latLng);
  };

  // Subscriptions Callbacks
  this.topic1 = new ROSLIB.Topic({
    ros: ros,
    name: "",
    messageType: ""
  });
 

  this.onchange = function (selectedTopic) {
    self.topic1.unsubscribe();
    self.topic1.name = selectedTopic;

    if (selectedTopic == "") return;
    ros.getTopicType(selectedTopic, function (type) {
      self.topic1.messageType = type;
      console.log(type);
      self.topic1.subscribe(self.callback);
    }, function (e) {
      throw new Error(e);
    });
  };

  // Subscriptions Callbacks
  this.callback = function (message) {
    self.latLng = {
      lat: parseFloat(message.latitude),
      lng: parseFloat(message.longitude)
    };
    self.gpsVars.marker.setPosition(self.latLng);
  }

  // helper properties and methods
  this.latLng = {
    lat: 0,
    lng: 0
  };
  this.sendRobot = function () {
    var value = [];
    //var elevationService = new google.maps.ElevationService();
    for (let i = 0; i < self.map_region.getWaypoints().length; i++) {

      value.push({"lat":self.map_region.getWaypoints()[i].getPosition().lat(),
                  "lon":self.map_region.getWaypoints()[i].getPosition().lng()});
    }
    for (let r = 0; r < self.regions.length; r++) {
      for (let i = 0; i < self.regions[r].getWaypoints().length; i++) {
        /*var requestElevation = {
          'locations': [self.waypoints[i].getPosition()]
        };
      
        var altitude = elevationService.getElevationForLocations(requestElevation, function(results, status = elevationService.ElevationStatus) {
          console.log(status);
          if (status == google.maps.ElevationStatus.OK) {
            // Retrieve the first result
            if (results[0]) {
              var alt =  parseFloat(results[0].elevation.toFixed(1));
              alert(alt);
            }
          }
        });*/

        value.push({"lat":self.regions[r].getWaypoints()[i].getPosition().lat(),
                    "lon":self.regions[r].getWaypoints()[i].getPosition().lng()});
                    //"alt": altitude});
      }
    }
    $(self.selector).find("a.jsSendRobot").attr("disabled");
    self.param1.set(value, function (a) {
      $(self.selector).find("a.jsSendRobot").removeAttr("disabled");
    });
  };
  this.centerMap = function () {
    google.maps.event.trigger(self.gpsVars.map, "resize");
    self.gpsVars.map.setCenter(self.latLng);
  };

  this.changeDensity = function() {
    var slider = document.getElementById("myRange");
    var density = parseFloat(slider.value);
    for (let r = 0; r < self.regions.length; r ++) {
      var poly = self.regions[r];
      poly.changeDensity(density);
    }
  };

  this.setRegion = function () {
    google.maps.event.clearListeners(self.gpsVars.map, 'click');
    for (let i = 0; i < self.regions.length; i++) {
      google.maps.event.clearListeners(self.regions[i].getPoly(), 'click');
      google.maps.event.addListener(self.regions[i].getPoly(), 'click', function(clickEvent) {
        self.regions[i].delete();
      });
      
    }
    var slider = document.getElementById("myRange");
    var density = parseFloat(slider.value);
    var region = new Region(density,self.gpsVars.map);
    self.regions.push(region);

    $(".jsSetRegion").text("Finish Editing");
    google.maps.event.addListener(self.gpsVars.map, 'click', function(clickEvent) {
      if (self.regions[self.regions.length-1].getIsClosed()) {
        var region = new Region(density,self.gpsVars.map);
        self.regions.push(region);
      }
      self.regions[self.regions.length-1].addBoundary(clickEvent.latLng);        

    });
    $(".jsSetRegion").addClass("jsEndRegion").removeClass("jsSetRegion");
  };
  this.endRegion = function () {
    $(".jsEndRegion").text("Edit");
    google.maps.event.clearListeners(self.gpsVars.map, 'click');
    for (let i = 0; i < self.regions.length; i++) {
      google.maps.event.clearListeners(self.regions[i].getPoly(), 'click');
      if (self.regions[i].getIsClosed()) {
        google.maps.event.addListener(self.regions[i].getPoly(), 'click', function(clickEvent) {
          self.regions[i].addWayPoint(clickEvent.latLng);
        });
      } else {
        self.regions[i].delete();
        self.regions.pop();
      }
    }
    $(".jsEndRegion").addClass("jsSetRegion").removeClass("jsEndRegion");

    google.maps.event.addListener(self.gpsVars.map, 'click', function(clickEvent) {
      self.map_region.addWayPoint(clickEvent.latLng);
    });

  };

  this.gpsVars = {
    map: null,
    marker: null
  };
  this.generateGpsVisualizer = function () {
    self.onchange("/agbot_gps/fix");
    var divMap = $(self.selector).find("div.map");
    var map;
    var latLng = {
      lat: 0,
      lng: 0
    };
    self.gpsVars.map = new google.maps.Map($(divMap)[0], {
      center: latLng,
      zoom: 18
    });
    self.map_region = new Region(0,self.gpsVars.map);
    self.regions = [];
    self.gpsVars.marker = new google.maps.Marker({
      position: latLng,
      map: self.gpsVars.map,
      title: 'I\'m here',
    });
    google.maps.event.addListener(self.gpsVars.map, 'click', function(clickEvent) {
      self.map_region.addWayPoint(clickEvent.latLng);
    });
    
    setTimeout(function () {
      self.centerMap();
    }, 1000);
  };
};

$(document).ready(function () {
  // If you need an onload callback
});

class Region {
  constructor(density, map) {
    this.isClosed = false;
    this.poly =  new google.maps.Polyline({ map: map, path: [], strokeColor: "#FF0000", strokeOpacity: 1.0, strokeWeight: 2 });
    this.waypoints = [];
    this.boundaries = [];
    this.density = density;
    this.map = map
  }
  addBoundary(pos) {
    if (this.isClosed)
          return;
    var point = new google.maps.Marker({ map: this.map, position: pos, draggable: true });
    if (!this.isClosed) {
      var markerIndex = this.poly.getPath().length;
      var isFirstMarker = markerIndex === 0;
    }
    this.boundaries.push(point);
    if (this.isClosed) {
      this.changeDensity();
    }
    var selfnew = this;
    if (isFirstMarker) {      
      google.maps.event.addListenerOnce(point, 'click', function () {
        if (selfnew.isClosed)
          return;
        var path = selfnew.poly.getPath();
        selfnew.poly.setMap(null);
        selfnew.poly = new google.maps.Polygon({ map: selfnew.map, path: path, strokeColor: "#FF0000", strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#FF0000", fillOpacity: 0.35 });
        google.maps.event.addListener(selfnew.poly, 'click', function (dragEvent) {
          selfnew.delete();
        });

        selfnew.changeDensity(selfnew.density);
        selfnew.isClosed = true;
      });
    }
    google.maps.event.addListener(point, 'drag', function (dragEvent) {
      selfnew.poly.getPath().setAt(markerIndex, dragEvent.latLng);
      if (selfnew.isClosed)
        selfnew.changeDensity(selfnew.density);
    });
    this.poly.getPath().push(point.getPosition());
  }
  changeDensity(density) {
    this.density = density;
    for(let i=0; i<this.waypoints.length; i++){
      this.waypoints[i].setMap(null);
    }
    this.waypoints = [];
    var path = this.poly.getPath();
    var minLat = Infinity, minLon = Infinity;
    var maxLat = -Infinity, maxLon = -Infinity;
    var coords = path.getArray();
    for (let i = 0; i < coords.length; i ++) {
      minLat = (coords[i].lat() < minLat) ? coords[i].lat() : minLat;
      maxLat = (coords[i].lat() > maxLat) ? coords[i].lat() : maxLat;
      minLon = (coords[i].lng() < minLon) ? coords[i].lng() : minLon;
      maxLon = (coords[i].lng() > maxLon) ? coords[i].lng() : maxLon;
    }

    for (let lat = minLat; lat <= maxLat; lat += density) {
      for (let lon = minLon; lon <= maxLon; lon += density) {
        var point = new google.maps.LatLng({lat: lat, lng: lon});
        if (google.maps.geometry.poly.containsLocation(point, this.poly)) {
          this.addWayPoint(point);
        }
      }
    }
  }
  addWayPoint(pos) {
    console.log("waypoint ", pos);
    var marker = new google.maps.Marker({ map: this.map, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 1}, position: pos, draggable: true });
    this.waypoints.push(marker);
    console.log("end of func", this.map);
    var selfadd = this;
    google.maps.event.addListenerOnce(marker,'click', function(clickEvent) {
      marker.setMap(null);
      const index = selfadd.waypoints.indexOf(marker);
      if (index > -1) {
        selfadd.waypoints.splice(index, 1);
      }
    });
  }

  delete() {
    for (let i = 0; i < this.waypoints.length; i++) {
      this.waypoints[i].setMap(null);
    }
    this.waypoints = [];
    for (let i = 0; i < this.boundaries.length; i++) {
      this.boundaries[i].setMap(null);
    }
    this.boundaries = [];
    this.poly.setMap(null);
    this.poly =  new google.maps.Polyline({ map: this.map, path: [], strokeColor: "#FF0000", strokeOpacity: 1.0, strokeWeight: 2 });
    this.isClosed = false;
  }

  getPoly() { return this.poly; }
  getWaypoints() {return this.waypoints;}
  getIsClosed() {return this.isClosed;}
}