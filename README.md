
### ramp-thermostat
A Node-RED contrib-node that emulates a thermostat.

The ramp-thermostat controls a heating-device such a valve depending on the actual input temperature and the target temperature.

The target temperature is defined by a profile that provides the value depending on the current time `00:00-24:00`. The profile consists of several points whose connections build a sequence of lines. The switching moment can be optimized by defining a gradient line like a `ramp`.

The node provides 3 outputs:

* state (boolean)
* actual temperature
* target temperature

### Installation

Change directory to your node red installation:

    $ npm install node-red-contrib-ramp-thermostat

### Configuration

Define a profile which consists of up to 10 Points.
A Profile has at least 2 Points and should beginn at 00:00 and end at 24:00.
The target temperature is calculated depending on the actual time.
