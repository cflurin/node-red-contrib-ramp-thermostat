module.exports = function(RED) {
  "use strict";
  
  function Profile(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    var timei, tempi, arr, minutes;
    this.points = {};
    
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
    
    this.points = JSON.parse(points_str);
  }
  RED.nodes.registerType("profile",Profile);
  
  function RampThermostat(config) {
    RED.nodes.createNode(this,config);
    var node = this;
       
    this.profile = RED.nodes.getNode(config.profile);
    //node.warn(JSON.stringify(this.profile.points));
    
    this.on('input', function(msg) {
    
      var msg1 = {"topic":"state"};
      var msg2 = {"topic":"actual"};
      var msg3 = {"topic":"target"};
      
      var point_mins, pre_mins, pre_target, point_target, target, gradient;
      
      var date = new Date();
      var actual_mins = date.getHours()*60 + date.getMinutes();

      for (var k in this.profile.points) {
          point_mins = parseInt(k);
          //node.warn("mins " + point_mins + " temp " + this.profile.points[k]);
          point_target = parseFloat(this.profile.points[k]);
          
          if (actual_mins < point_mins) {
              gradient = (point_target - pre_target) / (point_mins - pre_mins);
              target = pre_target + (gradient * (actual_mins - pre_mins));
              target = target.toFixed(1);
              //node.warn(gradient + " target " + target);
              break;
          }
          pre_mins = point_mins;
          pre_target = point_target;
      }

      //node.warn("actual "+msg.payload+" target "+target);
      
      if (msg.payload < target) {
          msg1.payload = true;
          this.status({fill:"yellow",shape:"dot",text:msg.payload+" < "+target+" ("+this.profile.name+")"});
      } else {
          msg1.payload = false;
          this.status({fill:"grey",shape:"ring",text:msg.payload+" > "+target+" ("+this.profile.name+")"});
      }
      
      msg2.payload = msg.payload;
      msg3.payload = target;
      
      node.send([msg1, msg2, msg3]);
    
    });
  }
  RED.nodes.registerType("ramp-thermostat",RampThermostat);
}
