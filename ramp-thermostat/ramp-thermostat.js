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
           
    this.profile = RED.nodes.getNode(config.profile);
    this.points = getPoints(this.profile.n);
    
    
    this.on('input', function(msg) {
      
      var msg1 = {"topic":"state"};
      var msg2 = {"topic":"actual"};
      var msg3 = {"topic":"target"};
      
      var point_mins, pre_mins, pre_target, point_target, target, gradient;
      
      var date = new Date();
      var actual_mins = date.getHours()*60 + date.getMinutes();
 
      if (typeof msg.profile !== "undefined") {
      
        var found = false;
        //var count = 0;
        
        RED.nodes.eachNode(function(n) {
          if (n.type === "profile" && n.name === msg.profile) {
            this.profile = n;
            this.points = getPoints(n);
            found = true;
          }
          //count++;
        }.bind(this));
      
        //this.warn("count " + count);
        
        if (found) {
          this.status({fill:"green",shape:"dot",text:"profile set to "+this.profile.name});
        } else {
          this.warn(msg.profile+" not found!");
          this.status({fill:"red",shape:"dot",text:msg.profile+" not found!"});
        }
      }

      if (typeof msg.payload !== "undefined") {
        
        //this.warn("name " + this.profile.name + " points " + JSON.stringify(this.points));
        for (var k in this.points) {
          point_mins = parseInt(k);
          //this.warn("mins " + point_mins + " temp " + this.points[k]);
          
          point_target = parseFloat(this.points[k]);
          
          if (actual_mins < point_mins) {
            gradient = (point_target - pre_target) / (point_mins - pre_mins);
            target = pre_target + (gradient * (actual_mins - pre_mins));
            target = target.toFixed(1);
            //this.warn("k=" + k +" gradient " + gradient + " target " + target);               
            break;
          }
          pre_mins = point_mins;
          pre_target = point_target;
        }
        
        if(isNaN(target)) {
          this.warn("target undefined, check your profile.");
        } 

        //this.warn("actual "+msg.payload+" target "+target);
        
        if (msg.payload < target) {
          msg1.payload = true;
          this.status({fill:"yellow",shape:"dot",text:msg.payload+" < "+target+" ("+this.profile.name+")"});
        } else {
          msg1.payload = false;
          this.status({fill:"grey",shape:"ring",text:msg.payload+" > "+target+" ("+this.profile.name+")"});
        }
        
        msg2.payload = msg.payload;
        msg3.payload = target;
        
        this.send([msg1, msg2, msg3]);
      }
    });
  }
  RED.nodes.registerType("ramp-thermostat",RampThermostat);

  
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
