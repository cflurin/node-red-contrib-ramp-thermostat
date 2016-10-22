module.exports = function(RED) {
  "use strict";
  
  function Profile(n) {
    RED.nodes.createNode(this,n);
    this.n = n;
    this.name = n.name;
  }
  RED.nodes.registerType("profile",Profile);
  
  function RampThermostat(config) {
    RED.nodes.createNode(this, config);
        
    var node_name = this.name.replace(" ", "_");
    var globalContext = this.context().global;
    
    // experimental
    //this.profile = globalContext.get(node_name);
    
    //if (typeof this.profile === "undefined") {
      this.profile = RED.nodes.getNode(config.profile);
      this.profile.points = getPoints(this.profile.n);
      globalContext.set(node_name, this.profile);
    //}
    
    this.h_plus = Math.abs(parseFloat(config.hysteresisplus)) || 0;
    this.h_minus = Math.abs(parseFloat(config.hysteresisminus)) || 0;
        
    this.status({fill:"green",shape:"dot",text:"profile set to "+this.profile.name});
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
        if(typeof msg.topic === "undefined") {
          this.warn("msg.topic undefined");
        } else {
          switch (msg.topic) {
            case "setCurrent":
            case "":
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
                this.status(result.status);
              }
              break;
              
            case "setTarget":
              result = setTarget(msg.payload);
              if (result.isValid) {
                this.profile = result.profile;
                globalContext.set(node_name, this.profile);
                this.status(result.status); 
              }
              break;
            
            case "setProfile":
              //this.warn(JSON.stringify(msg.payload));
              result = setProfile(msg.payload);
              
              if (result.found) {
                this.profile = result.profile;
                if (this.profile.name === "default") {
                  this.profile = RED.nodes.getNode(config.profile);
                  this.profile.points = getPoints(this.profile.n);             
                  //this.warn("default "+this.profile.name);
                  result.status = {fill:"green",shape:"dot",text:"profile set to default ("+this.profile.name+")"};
                }
                globalContext.set(node_name, this.profile);
                this.status(result.status); 
              } else {
                this.warn(msg.payload+" not found");
              }
              break;
              
            default:
              this.warn("invalid topic >"+msg.topic+"<");
          }
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
    
    var date = new Date();
    var current_mins = date.getHours()*60 + date.getMinutes();
      
    //console.log("name " + profile.name + " profile.points " + JSON.stringify(profile.points));
    for (var k in profile.points) {
      point_mins = parseInt(k);
      //console.log("mins " + point_mins + " temp " + profile.points[k]);
      
      point_target = profile.points[k];
      
      if (current_mins < point_mins) {
        gradient = (point_target - pre_target) / (point_mins - pre_mins);
        target = pre_target + (gradient * (current_mins - pre_mins));
        //console.log("k=" + k +" gradient " + gradient + " target " + target);             
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
    
    return {"state":state, "target":target, "status":status};
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
      profile.points = {"0":target, "1440":target};
      
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
              profile.points = getPoints(profile.n);
              found = true;
            }
            //count++;
          });
            
          //console.log("count " + count);
          
          if (found) {
            status = {fill:"green",shape:"dot",text:"profile set to "+profile.name};
          } else {
            status = {fill:"red",shape:"dot",text:profile.name+" not found"};
          }
        }
        break;
        
      case "object":
        profile.name = input.name || "input profile";
        var points = {};
        var arr, minutes;
        
        for (var k in input.points) {
          arr = k.split(":");
          minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
          points[minutes] = input.points[k];
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
    
    var points_str = '{';
    
    for (var i=1; i<=10; i++) {
      timei = "time"+i;
      tempi = "temp"+i;
      if (typeof(n[timei]) !== "undefined" && n[timei] !== "") {
        arr = n[timei].split(":");
        minutes = parseInt(arr[0])*60 + parseInt(arr[1]);
        points_str += '"' + minutes + '":' + n[tempi] + ',';
      }
    }
    points_str = points_str.slice(0,points_str.length-1);
    points_str += '}';
    
    //console.log(points_str);
    
    points = JSON.parse(points_str);
    return points;
  }
}
