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

    var globalContext = this.context().global;
    var profile = globalContext.get("profile");
    
    if (typeof profile === "undefined") {
      profile = RED.nodes.getNode(config.profile);
      globalContext.set("profile", profile);
    }
    
    
    this.on('input', function(msg) {
      
      var msg1 = {"topic":"state"};
      var msg2 = {"topic":"actual"};
      var msg3 = {"topic":"target"};
      
      var result = {};
      
      //this.warn(JSON.stringify(msg));
      
      if (typeof msg.payload !== "undefined") {      
        switch (msg.topic) {
          case "setActual":
          case "":
            result = getState(msg.payload, profile);
            
            if(isNaN(result.target)) {
              this.warn("target undefined, check your profile.");
            }
            
            msg1.payload = result.state;
            msg2.payload = msg.payload;
            msg3.payload = result.target;
            
            this.send([msg1, msg2, msg3]);
            break;
            
          case "setTarget":
            result = setTarget(msg.payload);
            profile = result.profile;
            globalContext.set("profile", profile);
            break;
          
          case "setProfile":
            result = setProfile(msg.payload);
            profile = result.profile;
            globalContext.set("profile", profile);
            
            if (!result.found) {
              this.warn(msg.payload+" not found!");
            }
            break;
            
          default:
            this.warn("invalid topic!");
        }
      } else {
        this.warn("msg.payload undefined.");
      }
      
      this.status(result.status);
    });
  }
  RED.nodes.registerType("ramp-thermostat",RampThermostat);


/*
*  ramp-thermostat specific functions
*/

  function getState(actual, profile) {
  
    var point_mins, pre_mins, pre_target, point_target, target, gradient;
    var state;
    var status = {};
    
    var date = new Date();
    var actual_mins = date.getHours()*60 + date.getMinutes();
    
    var points = getPoints(profile.n);
      
    //console.log("name " + profile.name + " points " + JSON.stringify(points));
    for (var k in points) {
      point_mins = parseInt(k);
      //console.log("mins " + point_mins + " temp " + points[k]);
      
      point_target = parseFloat(points[k]);
      
      if (actual_mins < point_mins) {
        gradient = (point_target - pre_target) / (point_mins - pre_mins);
        target = pre_target + (gradient * (actual_mins - pre_mins));
        target = target.toFixed(1);
        //console.log("k=" + k +" gradient " + gradient + " target " + target);               
        break;
      }
      pre_mins = point_mins;
      pre_target = point_target;
    }
    
    //console.log("actual "+msg.payload+" target "+target);
    
    if (actual < target) {
      state = true;
      status = {fill:"yellow",shape:"dot",text:actual+" < "+target+" ("+profile.name+")"};
    } else {
      state = false;
      status = {fill:"grey",shape:"ring",text:actual+" > "+target+" ("+profile.name+")"};
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
      profile.n = {
          "type": "profile",
          "name": "manual",
          "time1": "00:00",
          "temp1": target,
          "time2": "24:00",
          "temp2": target
        };
      valid = true;
      status = {fill:"green",shape:"dot",text:"set target to "+target+" ("+profile.name+")"};
    } else {
      valid = false;
      status = {fill:"red",shape:"dot",text:"invalid type of target."};
    }
        
    return {"profile":profile, "status":status, "isValid": valid};
  }
  
  function setProfile(name) {
    var found = false;
    var status = {};
    var profile = {};
    //var count = 0;
    
    RED.nodes.eachNode(function(n) {
      if (n.type === "profile" && n.name === name) {
        profile.n = n;
        profile.name = n.name;
        found = true;
      }
      //count++;
    });
  
    //console.log("count " + count);
    
    if (found) {
      status = {fill:"green",shape:"dot",text:"profile set to "+name};
    } else {
      status = {fill:"red",shape:"dot",text:name+" not found!"};
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
        points_str += '"' + minutes + '":"' + n[tempi] + '",'; 
      }
    }
    points_str = points_str.slice(0,points_str.length-1);
    points_str += '}';
    
    //console.log(points_str);
    
    points = JSON.parse(points_str);
    return points;
  }
}
