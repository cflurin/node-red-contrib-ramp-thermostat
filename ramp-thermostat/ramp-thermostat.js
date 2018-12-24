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

    this.current_status = {};
    this.points_result = {};
    
    this.h_plus = Math.abs(parseFloat(config.hysteresisplus)) || 0;
    this.h_minus = Math.abs(parseFloat(config.hysteresisminus)) || 0;
    
    this.profile = RED.nodes.getNode(config.profile);
    this.points_result = getPoints(this.profile.n);
    
    //this.warn(JSON.stringify(this.points_result.points, null, 2));
    
    if (this.points_result.isValid) {
      this.profile.points = this.points_result.points;
    } else {
      this.warn("Profile temperature not numeric");
    }
    
    this.current_status = {fill:"green",shape:"dot",text:"profile set to "+this.profile.name};
    
    this.status(this.current_status);
    //this.warn(node_name+" - "+JSON.stringify(this.profile));

    this.on('input', function(msg) {
      
      var msg1 = Object.assign(RED.util.cloneMessage(msg), {"topic":"state"});
      var msg2 = Object.assign(RED.util.cloneMessage(msg), {"topic":"current"});
      var msg3 = Object.assign(RED.util.cloneMessage(msg), {"topic":"target"});
      
      var result = {};
      
      //this.warn(JSON.stringify(msg));
      
      if (typeof msg.payload === "undefined") {
        this.warn("msg.payload undefined"); 
      } else { 
        switch (msg.topic.toLowerCase()) {
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
          case "settarget":
            result = setTarget(msg.payload);
            
            if (result.isValid) {
              this.profile = result.profile;
              this.current_status = result.status;
              this.status(this.current_status); 
            }
            break;
          case "getprofile":
            if (msg.payload === "actual") {
              msg3.payload = reformateProfile(this.profile);
            } else {
              result = getProfile(msg.payload);
              if (result.found) {
                msg3.payload = result.profile;        
              } else {
                this.warn(msg.payload+" not found");
              }
            }
            
            msg3.topic = "getProfile";
            
            this.send([null, null, msg3]);
            this.current_status = result.status;
            this.status(this.current_status);
            break;
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
            } else {
              this.current_status = result.status;
              this.warn(msg.payload+" not found");
            }
            this.status(this.current_status);
            break;
          case "sethysteresisplus":
            result = setHysteresisPlus(msg.payload);
            if (result.isValid) {
              this.h_plus = result.hysteresis_plus;
            }
            this.status(result.status);
            break;
          case "sethysteresisminus":
            result = setHysteresisMinus(msg.payload);
            if (result.isValid) {
              this.h_minus = Math.abs(result.hysteresis_minus);
            }
            this.status(result.status);
            break;
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
            this.warn("invalid topic >"+msg.topic+"< - set msg.topic to e.g. 'setCurrent'");
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
    var context = this.context();
    
    current = parseFloat((current).toFixed(2));
    
    var date = new Date();
    var current_mins = date.getHours()*60 + date.getMinutes();
      
    //console.log("name " + profile.name + " profile.points " + JSON.stringify(profile.points));
    for (var k in profile.points) {
      point_mins = parseInt(profile.points[k].m);
      //console.log("mins " + point_mins + " temp " + profile.points[k]);
      
      point_target = profile.points[k].t;
      
      if (current_mins < point_mins || point_mins === 1439) {
        gradient = (point_target - pre_target) / (point_mins - pre_mins);
        target = pre_target + (gradient * (current_mins - pre_mins));
        //this.warn("k=" + k +" gradient " + gradient + " target " + target);          
        break;
      }
      pre_mins = point_mins;
      pre_target = point_target;
    }

    if(isNaN(target)) {
      if (Object.values(profile.points)[Object.values(profile.points).length - 1].m < 1439) {
        this.warn("target undefined, the profile must end at 23:59");
      } else {
        this.warn("target undefined");
      }
      return {"state": null};
    }
    
    var target_plus = parseFloat((target + this.h_plus).toFixed(2));
    var target_minus = parseFloat((target - this.h_minus).toFixed(2));
    
    //this.warn(target_minus+" - "+target+" - "+target_plus);
        
    if (current > target_plus) {
      state = false;
      status = {fill:"grey",shape:"ring",text:current+" > "+target_plus+" ("+profile.name+")"};
    } else if (current == target_plus) {
      state = false;
      status = {fill:"grey",shape:"ring",text:current+" = "+target_plus+" ("+profile.name+")"}; 
    } else if (current == target_minus) {
      state = true;
      status = {fill:"yellow",shape:"dot",text:current+" = "+target_minus+" ("+profile.name+")"}; 
    } else if (current < target_minus) {
      state = true;
      status = {fill:"yellow",shape:"dot",text:current+" < "+target_minus+" ("+profile.name+")"};    
    } else { // deadband
      state = context.get('pre_state') || false;
      if (state) {
        status = {fill:"yellow",shape:"dot",text:target_minus+" < "+current+" < "+target_plus+" ("+profile.name+")"};
      } else {
        status = {fill:"grey",shape:"ring",text:target_minus+" < "+current+" < "+target_plus+" ("+profile.name+")"};
      }
    }
    
    context.set('pre_state', state);
    
    return {"state":state, "target":parseFloat(target.toFixed(2)), "status":status};
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
  
  function getProfile(input) {
    var found = false;
    var status = {};
    var profile = {};
    
    RED.nodes.eachNode(function(n) {
      if (n.type === "profile" && n.name === input) {
        profile.name = n.name;
        profile.points = [];
        var timei, tempi;
        for (var i=1; i<=10; i++) {
          timei = "time"+i;
          tempi = "temp"+i;
          var point = {};
          if (n[timei] !== "") {
            point[n[timei]] = parseFloat(n[tempi]);
            profile.points.push(point);
          }
        }
        found = true;
      }
    });
    
    if (found) {
      status = {fill:"green",shape:"dot",text:"get profile "+profile.name};
    } else {
      status = {fill:"red",shape:"dot",text:input+" not found"};
    }
    
    return {"profile":profile, "status":status, "found":found};
  }
  
  function reformateProfile(n) {
    var profile = {};
    var hhmm;
 
    //console.log(JSON.stringify(n, null, 2));      
    profile.name = n.name;
    profile.points = [];
    for (var k in n.points) {
      var point = {};
      hhmm = pad(parseInt(n.points[k].m / 60)) + ":" + pad(n.points[k].m % 60);
      point[hhmm] = parseFloat(n.points[k].t);
      profile.points.push(point);
    }
    //console.log(JSON.stringify(profile, null, 2));
    return profile;
  }
  
  function pad(number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
  }
    
  function setProfile(input) {
    var found = false;
    var status = {};
    var profile = {};
    var result = {};
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
          });

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
        
        // array of point objects {"hh:mm": temp}
        if (Array.isArray(input.points)) {
          input.points.forEach(function(point) {
            var k = Object.keys(point);
            //console.log(k);
            arr = k[0].split(":");
            minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
            points[i] = JSON.parse('{"m":' + minutes + ',"t":' + point[k] + '}');
            i++;
          });
        } else {
          // backwards compatibility
          for (var k in input.points) {
            arr = k.split(":");
            minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
            points[i] = JSON.parse('{"m":' + minutes + ',"t":' + input.points[k] + '}');
            //points[minutes] = input.points[k];
            i++;
          }
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
  
  function setHysteresisPlus(hp) {
    var valid;
    var status = {};

    if (typeof hp === "string") {
      hp = parseFloat(hp);
    }
    
    if (typeof hp === "number") {
      status = {fill:"green",shape:"dot",text:"hysteresis [+] set to "+hp};
      valid = true;
    } else {
      valid = false;
      status = {fill:"red",shape:"dot",text:"invalid type of hysteresis [+]"};
    }
        
    return {"hysteresis_plus":hp, "status":status, "isValid":valid};
  }
    
  function setHysteresisMinus(hm) {
    var valid;
    var status = {};

    if (typeof hm === "string") {
      hm = parseFloat(hm);
    }
    
    if (typeof hm === "number") {
      status = {fill:"green",shape:"dot",text:"hysteresis [-] set to "+hm};
      valid = true;
    } else {
      valid = false;
      status = {fill:"red",shape:"dot",text:"invalid type of hysteresis [-]"};
    }
        
    return {"hysteresis_minus":hm, "status":status, "isValid":valid};
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
