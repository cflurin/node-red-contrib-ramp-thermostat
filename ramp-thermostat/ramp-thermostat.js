"use strict";
var fs = require('fs');
var path = require('path');

module.exports = function(RED) {

  function Profile(n) {
    RED.nodes.createNode(this,n);
    this.n = n;
    this.name = n.name;
  }
  RED.nodes.registerType("profile",Profile);
  
  function RampThermostat(config) {
    RED.nodes.createNode(this, config);
    
    //this.warn(node_name+" - "+JSON.stringify(this));
    
    var node_name;
    if (typeof this.name !== "undefined" ) {
      node_name = this.name.replace(/\s/g, "_");
    } else {
      node_name = this.id;
    }
    var globalContext = this.context().global;
    this.current_status = {};
    this.points_result = {};
    
    this.h_plus = Math.abs(parseFloat(config.hysteresisplus)) || 0;
    this.h_minus = Math.abs(parseFloat(config.hysteresisminus)) || 0;
    this.h_left = Math.abs(parseInt(config.hysteresisleft)) || 1440;
    
    // experimental
    //this.profile = globalContext.get(node_name);
    
    //if (typeof this.profile === "undefined") {
      this.profile = RED.nodes.getNode(config.profile);
      this.points_result = getPoints(this.profile.n);
      if (this.points_result.isValid) {
        this.profile.points = this.points_result.points;
      } else {
        this.warn("Profile temperature not numeric");
      }
      globalContext.set(node_name, this.profile);
    //}
    
    this.current_status = {fill:"green",shape:"dot",text:"profile set to "+this.profile.name};
    
    this.status(this.current_status);
    //this.warn(node_name+" - "+JSON.stringify(this.profile));

    this.on('input', function(msg) {
      
      var msg1 = {"topic":"state"};
      var msg2 = {"topic":"current"};
      var msg3 = {"topic":"target"};
      
      var result = {};
      
      //this.warn(JSON.stringify(msg));
      
      if (typeof msg.payload === "undefined") {
        this.warn("msg.payload undefined"); 
      } else { 
        switch (msg.topic) {
          case "setCurrent":
          case "setcurrent":
          case "":
          case undefined:
            if (typeof msg.payload === "string") {
              msg.payload = parseFloat(msg.payload);
            }
            if (isNaN(msg.payload)) {
              this.warn("Non numeric input");            
            } else {
              result = this.getState(msg.payload, this.profile);
              if (result.state !== null) {
                msg1.payload = result.state;
              } else {
                msg1 = null;
              }
              msg2.payload = msg.payload;
              msg3.payload = result.target;
              this.send([msg1, msg2, msg3]);
              this.current_status = result.status;
              this.status(this.current_status);
            }
            break;
            
          case "setTarget":
          case "settarget":
            result = setTarget(msg.payload);
            
            if (result.isValid) {
              this.profile = result.profile;
              globalContext.set(node_name, this.profile);
              this.current_status = result.status;
              this.status(this.current_status); 
            }
            break;
          
          case "setProfile":
          case "setprofile":
            //this.warn(JSON.stringify(msg.payload));
            result = setProfile(msg.payload);
            
            if (result.found) {
              this.profile = result.profile;
              if (this.profile.name === "default") {
                this.profile = RED.nodes.getNode(config.profile);
                this.points_result = getPoints(this.profile.n);
                if (this.points_result.isValid) {
                  this.profile.points = this.points_result.points;
                } else {
                  this.warn("Profile temperature not numeric.");
                }         
                //this.warn("default "+this.profile.name);
                this.current_status = {fill:"green",shape:"dot",text:"profile set to default ("+this.profile.name+")"};
              } else {
                this.current_status = result.status;
              }
              globalContext.set(node_name, this.profile);
            } else {
              this.current_status = result.status;
              this.warn(msg.payload+" not found");
            }
            this.status(this.current_status);
            break;
            
          case "checkUpdate":
          case "checkupdate":
            var version = readNodeVersion();
            var pck_name = "node-red-contrib-ramp-thermostat";
            
            read_npmVersion(pck_name, function(npm_version) {
              if (npm_version > version) {
                this.warn("A new "+pck_name+" version "+npm_version+" is avaiable.");
              } else {
                this.warn(pck_name+" "+version+" is up to date.");
              }
            }.bind(this));

            this.warn("ramp-thermostat version: "+version);
            this.status({fill:"green",shape:"dot",text:"version: "+version});
            var set_timeout = setTimeout(function() {
              this.status(this.current_status);
            }.bind(this), 4000);
            break;
            
          default:
            this.warn("invalid topic >"+msg.topic+"<");
        }
      }
    });
  }
  RED.nodes.registerType("ramp-thermostat",RampThermostat);


  /**
   *  ramp-thermostat specific functions
   **/

  RampThermostat.prototype.getState = function(current, profile) {
  
    var point_mins, pre_mins, pre_target, point_target, target, gradient;
    var state;
    var status = {};
    
    current = parseFloat((current).toFixed(1));
    
    var date = new Date();
    var current_mins = date.getHours()*60 + date.getMinutes();

    // Objects do no guarentee order, lets sort it
    var points_arr = Object.keys(profile.points).map(key=>{return profile.points[key]}).sort( (a,b)=> { return a.m - b.m });
      
    //console.log("name " + profile.name + " profile.points " + JSON.stringify(profile.points));
    for( var k=0; k<points_arr.length; k++ ) {
      point_mins = points_arr[k].m;
      //console.log("mins " + point_mins + " temp " + profile.points[k]);
      
      point_target = points_arr[k].t;
      
      if (current_mins < point_mins) {

        if( point_mins - current_mins > this.h_left ) {
          // Not yet in window to start ramping thermostat, stay constant
          target = pre_target;
          break;
        }

        if( point_mins - pre_mins > this.h_left && point_mins - current_mins <= this.h_left ) {
          // bring the previous point forward to match ramp max
          pre_mins = point_mins - this.h_left;
        }

        gradient = (point_target - pre_target) / (point_mins - pre_mins);
        target = pre_target + (gradient * (current_mins - pre_mins));
        //this.warn("k=" + k +" gradient " + gradient + " target " + target);          
        break;
      }
      pre_mins = point_mins;
      pre_target = point_target;
    }
    
    if(isNaN(target)) {
      this.warn("target undefined");
    }
    
    var target_plus = parseFloat((target + this.h_plus).toFixed(1));
    var target_minus = parseFloat((target - this.h_minus).toFixed(1));
    
    //this.warn(target_minus+" - "+target+" - "+target_plus);
        
    if (current > target_plus) {
      state = false;
      status = {fill:"grey",shape:"ring",text:current+" > "+target_plus+" ("+profile.name+")"};
    } else if (current < target_minus) {
      state = true;
      status = {fill:"yellow",shape:"dot",text:current+" < "+target_minus+" ("+profile.name+")"};    
    } else if (current == target_plus) {
      state = null;
      status = {fill:"grey",shape:"ring",text:current+" = "+target_plus+" ("+profile.name+")"}; 
    } else if (current == target_minus) {
      state = null;
      status = {fill:"grey",shape:"ring",text:current+" = "+target_minus+" ("+profile.name+")"};  
    } else {
      state = null;
      status = {fill:"grey",shape:"ring",text:target_minus+" < "+current+" < "+target_plus+" ("+profile.name+")"};    
    }
    
    return {"state":state, "target":parseFloat(target.toFixed(1)), "status":status};
  }
  
  function setTarget(target) {
    var valid;
    var status = {};
    var profile = {};

    if (typeof target === "string") {
      target = parseFloat(target);
    }
    
    if (typeof target === "number") {
      profile.name = "manual";
      profile.points = {"1":{"m":0,"t":target},"2":{"m":1440,"t":target}};
            
      valid = true;
      status = {fill:"green",shape:"dot",text:"set target to "+target+" ("+profile.name+")"};
    } else {
      valid = false;
      status = {fill:"red",shape:"dot",text:"invalid type of target"};
    }
        
    return {"profile":profile, "status":status, "isValid": valid};
  }
  
  function setProfile(input) {
    var found = false;
    var status = {};
    var profile = {};
    var result = {};
    //var count = 0;
    var type = typeof input;
       
    switch (type) {
      case "string":
        if (input === "default") {
          profile.name = "default";
          found = true;
        } else {
          RED.nodes.eachNode(function(n) {
            if (n.type === "profile" && n.name === input) {
              profile.n = n;
              profile.name = n.name;
              result = getPoints(profile.n);
              if (result.isValid) {
                profile.points = result.points;
              } else {
                this.warn("Profile temperature not numeric");
              } 
              found = true;
            }
            //count++;
          });
            
          //console.log("count " + count);
          
          if (found) {
            status = {fill:"green",shape:"dot",text:"profile set to "+profile.name};
          } else {
            status = {fill:"red",shape:"dot",text:input+" not found"};
          }
        }
        break;
        
      case "object":
        profile.name = input.name || "input profile";
        var points = {};
        var arr, minutes;
        var i = 1;
        
        for (var k in input.points) {
          arr = k.split(":");
          minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
          points[i] = JSON.parse('{"m":' + minutes + ',"t":' + input.points[k] + '}');
          //points[minutes] = input.points[k];
          i++;
        }
        profile.points = points;
        found = true;
        status = {fill:"green",shape:"dot",text:"profile set to "+profile.name};
        //console.log(points);
        break;
        
      default:
        status = {fill:"red",shape:"dot",text:"invalid type "+type};
    }

    return {"profile":profile, "status":status, "found":found};
  }
    
  function getPoints(n) {
    var timei, tempi, arr, minutes;
    var points = {};
    var valid = true;
    
    var points_str = '{';
    
    for (var i=1; i<=10; i++) {
      timei = "time"+i;
      tempi = "temp"+i;
      
      if (isNaN(n[tempi])) {
        valid = false;
      } else {
        if (typeof(n[timei]) !== "undefined" && n[timei] !== "") {
          arr = n[timei].split(":");
          minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
          points_str += '"' + i + '":{"m":' + minutes + ',"t":' + n[tempi] + '},';
        }
      }
    }
    
    if (valid) {
      points_str = points_str.slice(0,points_str.length-1);
      points_str += '}';
      //console.log(points_str);
      points = JSON.parse(points_str);
      //console.log(JSON.stringify(points));
    }
    
    return {"points":points, "isValid":valid};
  }
  
  function readNodeVersion () {
    var package_json = "../package.json";
    //console.log(__dirname+" - "+package_json);
    var packageJSONPath = path.join(__dirname, package_json);
    var packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
    return packageJSON.version;
  }
  
  function read_npmVersion(pck, callback) {
    var exec = require('child_process').exec;
    var cmd = 'npm view '+pck+' version';
    var npm_version;
    
    exec(cmd, function(error, stdout, stderr) {
      npm_version = stdout.trim();
      callback(npm_version);
      //console.log("npm_version "+npm_version);
    });
  }
}
